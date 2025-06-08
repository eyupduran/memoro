import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { dbService } from './database';
import { storageService } from './storage';

// Yedekleme için kullanılacak dizin
const BACKUP_DIRECTORY = `${FileSystem.documentDirectory}backups/`;

// Yedeklenecek verilerin türleri
interface BackupData {
  learnedWords: any[];
  exerciseResults: any[];
  exerciseDetails: any[];
  customWordLists: any[];
  customWordListItems: any[];
  settings: Record<string, any>;
  timestamp: string;
  version: string;
  languagePair: string;
}

interface RestoreResult {
  success: boolean;
  languagePair?: string;
}

class BackupService {
  // Yedekleme dizininin varlığını kontrol et, yoksa oluştur
  private async ensureBackupDirectoryExists(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIRECTORY);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIRECTORY, { intermediates: true });
    }
  }

  // Yedekleme dosyası için benzersiz bir ad oluştur
  private generateBackupFileName(): string {
    const date = new Date();
    const formattedDate = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
    return `memoro_backup_${formattedDate}.json`;
  }

  // Kullanıcı ayarlarını AsyncStorage'dan al
  private async getSettings(): Promise<Record<string, any>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const settingsKeys = keys.filter(key => 
        !key.startsWith('wordList_') && 
        key !== 'hasSeenOnboarding' && 
        !key.includes('cache') &&
        !key.includes('expo')
      );
      
      const settingsItems = await AsyncStorage.multiGet(settingsKeys);
      const settings: Record<string, any> = {};
      
      settingsItems.forEach(([key, value]) => {
        if (value) {
          try {
            // JSON olarak parse etmeyi dene
            settings[key] = JSON.parse(value);
          } catch (e) {
            // Parse edilemiyorsa string olarak kullan
            settings[key] = value;
          }
        }
      });
      
      return settings;
    } catch (error) {
      console.error('Ayarlar alınırken hata:', error);
      return {};
    }
  }

  // Tüm verileri yedekle
  public async backupData(languagePair: string): Promise<string | null> {
    try {
      await this.ensureBackupDirectoryExists();
      
      // Veritabanından verileri al
      const learnedWords = await dbService.getLearnedWords(languagePair);
      const exerciseResults = await dbService.getExerciseResults(languagePair);
      
      // Egzersiz detaylarını al
      const exerciseDetails = [];
      for (const result of exerciseResults) {
        const details = await dbService.getExerciseDetails(result.id);
        if (details) {
          exerciseDetails.push(details);
        }
      }
      
      // Özel kelime listelerini al
      const customWordLists = await dbService.getWordLists(languagePair);
      
      // Her liste için kelimeleri al
      const customWordListItems = [];
      for (const list of customWordLists) {
        const words = await dbService.getWordsFromList(list.id);
        customWordListItems.push({
          listId: list.id,
          words
        });
      }
      
      // Ayarları al
      const settings = await this.getSettings();
      
      // Yedekleme verisi oluştur
      const backupData: BackupData = {
        learnedWords,
        exerciseResults,
        exerciseDetails,
        customWordLists,
        customWordListItems,
        settings,
        timestamp: new Date().toISOString(),
        version: '1.0',
        languagePair
      };
      
      // Dosya adı oluştur ve kaydet
      const fileName = this.generateBackupFileName();
      const filePath = `${BACKUP_DIRECTORY}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backupData, null, 2));
      
      // Dosyayı paylaş
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Memoro Veri Yedekleme',
          UTI: 'public.json'
        });
      }
      
      return filePath;
    } catch (error) {
      console.error('Veri yedekleme hatası:', error);
      return null;
    }
  }

  // Yedekten geri yükle
  public async restoreData(onSettingsRestored?: () => void): Promise<RestoreResult> {
    try {
      // Dosya seçiciyi aç
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { success: false };
      }
      
      const fileUri = result.assets[0].uri;
      
      // Dosyayı oku
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      const backupData: BackupData = JSON.parse(fileContent);
      
      // Versiyon kontrolü
      if (!backupData.version || !backupData.timestamp || !backupData.languagePair) {
        throw new Error('Geçersiz yedekleme dosyası');
      }
      
      // Verileri sırayla işleyelim, transaction kullanmadan
      
      // 1. Öğrenilen kelimeleri geri yükle
      if (backupData.learnedWords && backupData.learnedWords.length > 0) {
        try {
          await dbService.saveLearnedWords(backupData.learnedWords, backupData.languagePair);
        } catch (error) {
          console.warn('Öğrenilen kelimeler kaydedilirken hata:', error);
          // Hata olsa bile devam et
        }
      }
      
      // 2. Egzersiz sonuçlarını ve detaylarını geri yükle
      if (backupData.exerciseResults && backupData.exerciseResults.length > 0) {
        for (const result of backupData.exerciseResults) {
          try {
            const newExerciseId = await dbService.saveExerciseResult(
              result.exercise_type,
              result.score,
              result.total_questions,
              backupData.languagePair,
              result.word_source || 'learned',
              result.level || null,
              result.word_list_id || null,
              result.word_list_name || null
            );
            
            // İlgili egzersiz detayını bul ve kaydet
            if (newExerciseId) {
              const details = backupData.exerciseDetails.find(
                detail => detail.exerciseId === result.id
              );
              
              if (details) {
                try {
                  await dbService.saveExerciseDetails(
                    newExerciseId,
                    details.details,
                    backupData.languagePair
                  );
                } catch (detailError) {
                  console.warn(`Egzersiz detayı kaydedilirken hata: ${newExerciseId}`, detailError);
                  // Hata olsa bile devam et
                }
              }
            }
          } catch (resultError) {
            console.warn(`Egzersiz sonucu kaydedilirken hata: ${result.id}`, resultError);
            // Hata olsa bile devam et
          }
        }
      }
      
      // 3. Özel kelime listelerini geri yükle
      if (backupData.customWordLists && backupData.customWordLists.length > 0) {
        // Önce mevcut listeleri al
        const existingLists = await dbService.getWordLists(backupData.languagePair);
        
        for (const list of backupData.customWordLists) {
          // Aynı isimde liste var mı kontrol et
          const existingList = existingLists.find(l => l.name === list.name);
          
          let newListId: number | null;
          
          if (existingList) {
            // Aynı isimde liste varsa, önce mevcut listeyi sil
            await dbService.deleteWordList(existingList.id);
            // Sonra yeni listeyi oluştur
            newListId = await dbService.createWordList(list.name, backupData.languagePair);
          } else {
            // Yeni liste oluştur
            newListId = await dbService.createWordList(list.name, backupData.languagePair);
          }
          
          if (newListId) {
            // Bu liste için kelimeleri bul ve kaydet
            const listItems = backupData.customWordListItems.find(
              item => item.listId === list.id
            );
            
            if (listItems && listItems.words) {
              for (const word of listItems.words) {
                try {
                  await dbService.addWordToList(newListId, word);
                } catch (error) {
                  console.warn(`Kelime eklenirken hata: ${word.word}`, error);
                  // Hata olsa bile devam et
                }
              }
            }
          }
        }
      }
      
      // 4. Ayarları geri yükle
      if (backupData.settings) {
        for (const [key, value] of Object.entries(backupData.settings)) {
          if (value !== null && value !== undefined) {
            await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          }
        }
        
        // Ayarlar geri yüklendikten sonra callback'i çağır
        if (onSettingsRestored) {
          onSettingsRestored();
        }
      }
      
      return { success: true, languagePair: backupData.languagePair };
    } catch (error) {
      console.error('Veri geri yükleme hatası:', error);
      return { success: false };
    }
  }
}

export const backupService = new BackupService(); 