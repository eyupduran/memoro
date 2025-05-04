import { storageService } from '../services/storage';
import { dbService } from '../services/database';
import type { Word, WordList, AsyncWordLists } from '../types/words';

const getLanguagePair = async () => {
  const nativeLanguage = await storageService.getItem('selectedLanguage') || 'tr';
  const learningLanguage = await storageService.getItem('learningLanguage') || 'en';
  return `${learningLanguage}-${nativeLanguage}`;
};

const getBaseUrl = async () => {
  const languagePair = await getLanguagePair();
  return `https://raw.githubusercontent.com/eyupduran/english-words-api/main/languages/${languagePair}`;
};

// Tüm kelime listelerini içeren dosyayı çeken fonksiyon
const fetchAllWordLists = async (): Promise<Record<string, Word[]>> => {
  try {
    const baseUrl = await getBaseUrl();
    console.log(`Fetching word lists from API: ${baseUrl}/all-words.json`);
    const response = await fetch(`${baseUrl}/all-words.json`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching all word lists:', error);
    return {};
  }
};

// Sadece SQLite'dan kelime listesini getiren fonksiyon
const fetchWordList = async (level: string): Promise<WordList> => {
  try {
    console.log(`Fetching word list for level: ${level}`);
    
    // SQLite'dan veriyi al
    const languagePair = await getLanguagePair();
    const words = await dbService.getWords(level, languagePair);
    
    console.log(`Retrieved ${words.length} words from SQLite for level ${level}`);
    
    return { words };
  } catch (error) {
    console.error(`Error fetching word list for ${level}:`, error);
    return { words: [] };
  }
};

// Verileri yüklemek için - bu sadece başlangıçta veya dil değiştiğinde çağrılmalı
// İlerleme takibi için callback ekledik
const loadWordsToDatabase = async (
  languagePair: string, 
  progressCallback?: (progress: number, levelName?: string) => void
): Promise<boolean> => {
  try {
    console.log(`Loading words to database for language pair: ${languagePair}`);
    
    // API'den verileri al
    progressCallback?.(10); // Başlangıç ilerleme bildirimi
    
    const baseUrl = `https://raw.githubusercontent.com/eyupduran/english-words-api/main/languages/${languagePair}`;
    const response = await fetch(`${baseUrl}/all-words.json`);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    progressCallback?.(20); // Veri indirme tamamlandı bildirimi
    
    const allWordLists = await response.json();
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const totalLevels = levels.length;
    let totalWords = 0;
    
    // Toplam kelime sayısını hesapla
    levels.forEach(level => {
      const words = allWordLists[level] || [];
      totalWords += words.length;
    });
    
    console.log(`Toplam ${totalWords} kelime ${totalLevels} seviyede yüklenecek`);
    
    // Her seviye için SQLite'a kaydet
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const words = allWordLists[level] || [];
      
      if (words.length > 0) {
        const levelProgress = 20 + Math.floor((i / totalLevels) * 70); // 20% - 90% arası ilerleme
        progressCallback?.(levelProgress, level);
        
        await dbService.saveWords(words, level, languagePair);
        console.log(`${languagePair} için ${level} seviyesinde ${words.length} kelime kaydedildi`);
      }
    }
    
    progressCallback?.(100); // Tamamlandı bildirimi
    return true;
  } catch (error) {
    console.error('Error loading words to database:', error);
    return false;
  }
};

// Kelime listelerini getiren fonksiyon
export const getWordLists = async (): Promise<AsyncWordLists> => {
  return {
    A1: fetchWordList('A1'),
    A2: fetchWordList('A2'),
    B1: fetchWordList('B1'),
    B2: fetchWordList('B2'),
    C1: fetchWordList('C1'),
    C2: fetchWordList('C2'),
  };
};

// Sadece SQLite'a veri yüklemek için export ediyoruz
export const loadWordsForLanguagePair = loadWordsToDatabase;

// Zorunlu güncelleme durumları için - artık API'yi SQLite'a yükleyip sonra çekiyor
export const forceUpdateWordLists = {
  A1: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('A1');
  },
  A2: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('A2');
  },
  B1: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('B1');
  },
  B2: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('B2');
  },
  C1: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('C1');
  },
  C2: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('C2');
  },
}; 