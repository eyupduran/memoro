import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type { LearnedWord, WordList } from '../types/words';
import { dbService } from './database';
import type { UnfinishedExercise } from '../screens/ExerciseQuestionScreen';

const STORAGE_KEYS = {
  LEARNED_WORDS: 'learnedWords',
  OFFLINE_MODE: 'offlineMode',
  WORD_LIST_PREFIX: 'wordList_',
  LAST_SYNC_DATE: 'lastSyncDate',
  SELECTED_LANGUAGE: 'selectedLanguage',
  BACKGROUND_IMAGES: 'backgroundImages',
  CACHED_IMAGES: 'cachedImages'
};

// Resimleri saklayacağımız klasör
const IMAGE_CACHE_DIR = `${FileSystem.cacheDirectory}background_images/`;

class StorageService {
  async getLearnedWords(languagePair: string): Promise<LearnedWord[]> {
    try {
      // SQLite veritabanından öğrenilen kelimeleri getir
      return await dbService.getLearnedWords(languagePair);
    } catch (error) {
      console.error('Error getting learned words:', error);
      return [];
    }
  }

  async saveLearnedWords(words: LearnedWord[], languagePair: string): Promise<boolean> {
    try {
      // SQLite veritabanına öğrenilen kelimeleri kaydet
      return await dbService.saveLearnedWords(words, languagePair);
    } catch (error) {
      console.error('Error saving learned words:', error);
      return false;
    }
  }

  async isOfflineModeEnabled(): Promise<boolean> {
    try {
      const status = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_MODE);
      return status === 'true';
    } catch (error) {
      console.error('Error checking offline mode:', error);
      return false;
    }
  }

  async getWordList(level: string): Promise<WordList | null> {
    try {
      const isOffline = await this.isOfflineModeEnabled();
      if (isOffline) {
        const cachedData = await AsyncStorage.getItem(`${STORAGE_KEYS.WORD_LIST_PREFIX}${level}`);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting word list:', error);
      return null;
    }
  }

  async saveWordList(level: string, data: WordList): Promise<boolean> {
    try {
      await AsyncStorage.setItem(`${STORAGE_KEYS.WORD_LIST_PREFIX}${level}`, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving word list:', error);
      return false;
    }
  }

  async getLastSyncDate(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_DATE);
    } catch (error) {
      console.error('Error getting last sync date:', error);
      return null;
    }
  }

  async setLastSyncDate(date: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_DATE, date);
      return true;
    } catch (error) {
      console.error('Error setting last sync date:', error);
      return false;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Error setting item:', error);
      return false;
    }
  }
  
  // Görselleri getiren yeni fonksiyon - öncelikle SQLite veritabanından, yoksa API'den alıp kaydeder
  async getBackgroundImages(): Promise<string[]> {
    try {
      // Önce SQLite veritabanından resimleri kontrol edelim
      const dbImages = await dbService.getBackgroundImages();
      
      // Yerel dosya yolları olan resimleri filtreleyelim
      const cachedImages = dbImages
        .filter(img => img.localPath !== null)
        .map(img => img.localPath as string);
      
      if (cachedImages.length > 0) {
        console.log('Veritabanı önbelleğinden resimler yükleniyor...');
        
        // Dosyaların gerçekten var olduğunu doğrulayalım
        const validImages = await this.validateCachedImages(cachedImages);
        
        if (validImages.length > 0) {
          return validImages;
        }
      }
      
      // Yerel dosyalarda yoksa, URL listesini API'den al
      console.log('API\'den resim listesi alınıyor...');
      const imageUrls = await this.fetchImageUrls();
      
      if (imageUrls.length === 0) {
        console.error('Resim URL\'leri yüklenemedi!');
        return [];
      }
      
      // Resimleri indir ve önbelleğe al
      console.log('Resimler indiriliyor ve önbelleğe alınıyor...');
      const newCachedImages = await this.downloadAndCacheImages(imageUrls);
      
      return newCachedImages;
    } catch (error) {
      console.error('Resimleri getirirken hata:', error);
      
      // Hata durumunda API'den alınan URL'leri döndürelim
      const fallbackImages = await fetchGithubImages().catch(() => []);
      return fallbackImages;
    }
  }

  // Yerel dosyaları doğrulama (dosyalar gerçekten var mı?)
  private async validateCachedImages(imagePaths: string[]): Promise<string[]> {
    const validImages: string[] = [];
    
    for (const path of imagePaths) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (fileInfo.exists) {
          validImages.push(path);
        }
      } catch (error) {
        console.warn(`Dosya kontrolü başarısız: ${path}`, error);
      }
    }
    
    return validImages;
  }

  // API'den resim URL'lerini al
  private async fetchImageUrls(): Promise<string[]> {
    // Önce veritabanında kayıtlı URL'leri kontrol et
    const dbImageUrls = await dbService.getBackgroundImageUrls();
    
    if (dbImageUrls.length > 0) {
      return dbImageUrls;
    }
    
    // Veritabanında yoksa API'den al ve kaydet
    const urls = await fetchGithubImages();
    
    // Yeni URL'leri veritabanına kaydet
    if (urls.length > 0) {
      const imageObjects = urls.map(url => ({ url }));
      await dbService.saveBackgroundImages(imageObjects);
    }
    
    return urls;
  }

  // Resimleri indir ve yerel dosya sistemine kaydet
  async downloadAndCacheImages(imageUrls: string[]): Promise<string[]> {
    // Önce cache dizininin var olduğundan emin olalım
    await this.ensureCacheDirectoryExists();
    
    const cachedPaths: string[] = [];
    const downloadPromises: Promise<void>[] = [];
    
    // Her resim için
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const fileName = this.getFileNameFromUrl(url);
      const localFilePath = `${IMAGE_CACHE_DIR}${fileName}`;
      
      // Önce dosyanın var olup olmadığını kontrol et
      const fileInfo = await FileSystem.getInfoAsync(localFilePath);
      
      // Eğer dosya zaten varsa, doğrudan listeye ekle
      if (fileInfo.exists) {
        cachedPaths.push(localFilePath);
        // Veritabanında da güncelleyelim
        await dbService.updateBackgroundImageLocalPath(url, localFilePath);
        continue;
      }
      
      // Dosya yoksa indirme işlemini ekle
      downloadPromises.push(
        this.downloadImage(url, localFilePath)
          .then(() => {
            cachedPaths.push(localFilePath);
            // Yerel yolu veritabanında da güncelleyelim
            dbService.updateBackgroundImageLocalPath(url, localFilePath);
          })
          .catch(err => {
            console.error(`Resim indirme hatası (${url}):`, err);
            // Hata durumunda orijinal URL'yi listeye ekleyelim
            cachedPaths.push(url);
          })
      );
    }
    
    // Tüm indirme işlemlerinin tamamlanmasını bekleyelim
    if (downloadPromises.length > 0) {
      await Promise.all(downloadPromises);
    }
    
    return cachedPaths;
  }
  
  // Cache dizinin var olduğundan emin ol
  private async ensureCacheDirectoryExists(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
    }
  }
  
  // URL'den dosya adını çıkar
  private getFileNameFromUrl(url: string): string {
    // Son / karakterinden sonraki kısmı al ve dosya adı olarak kullan
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
  
  // Resmi belirtilen yola indir
  private async downloadImage(url: string, filePath: string): Promise<void> {
    // Dosya zaten varsa tekrar indirmeye gerek yok
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      return;
    }
    
    // Resmi indir
    const downloadResult = await FileSystem.downloadAsync(url, filePath);
    
    if (downloadResult.status !== 200) {
      throw new Error(`İndirme başarısız: ${downloadResult.status}`);
    }
  }
  
  // Önbelleği temizle ve tüm resimleri yeniden indir
  async clearImageCache(): Promise<boolean> {
    try {
      // Önbellek dizinini sil
      const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(IMAGE_CACHE_DIR);
      }
      
      // Veritabanındaki yerel yolları temizle
      await dbService.clearBackgroundImageCache();
      
      return true;
    } catch (error) {
      console.error('Önbellek temizleme hatası:', error);
      return false;
    }
  }

  // Yarım kalan egzersizi kaydet
  async saveUnfinishedExercise(exercise: UnfinishedExercise): Promise<void> {
    try {
      await AsyncStorage.setItem('unfinished_exercise', JSON.stringify(exercise));
    } catch (error) {
      console.error('Error saving unfinished exercise:', error);
      throw error;
    }
  }

  // Yarım kalan egzersizi getir
  async getUnfinishedExercise(): Promise<UnfinishedExercise | null> {
    try {
      const exerciseStr = await AsyncStorage.getItem('unfinished_exercise');
      if (!exerciseStr) return null;
      return JSON.parse(exerciseStr);
    } catch (error) {
      console.error('Error getting unfinished exercise:', error);
      return null;
    }
  }

  // Yarım kalan egzersizi sil
  async clearUnfinishedExercise(): Promise<void> {
    try {
      await AsyncStorage.removeItem('unfinished_exercise');
    } catch (error) {
      console.error('Error clearing unfinished exercise:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();

// API'den görsel listesini getir - bu fonksiyon sadece gerektiğinde kullanılmalı
export const fetchGithubImages = async (): Promise<string[]> => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/eyupduran/english-words-api/main/assets/images/background-images.json');
    const data = await response.json();
    return data.images;
  } catch (error) {
    console.error('Error fetching GitHub images:', error);
    return [];
  }
}; 