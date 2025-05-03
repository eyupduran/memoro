import { storageService } from '../services/storage';
import type { Word, WordList, AsyncWordLists } from '../types/words';

const getBaseUrl = async () => {
  const nativeLanguage = await storageService.getItem('selectedLanguage') || 'tr';
  const learningLanguage = await storageService.getItem('learningLanguage') || 'en';
  return `https://raw.githubusercontent.com/eyupduran/english-words-api/main/languages/${learningLanguage}-${nativeLanguage}`;
};

// Tüm kelime listelerini içeren dosyayı çeken fonksiyon
const fetchAllWordLists = async (): Promise<Record<string, Word[]>> => {
  try {
    const baseUrl = await getBaseUrl();
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

const fetchWordList = async (level: string): Promise<WordList> => {
  // Önce offline modda mı kontrol et
  const offlineData = await storageService.getWordList(level);
  if (offlineData) {
    return offlineData;
  }

  // Offline data yoksa API'den al
  try {
    const allWordLists = await fetchAllWordLists();
    const words = allWordLists[level] || [];
    const data = { words };
    
    // Yeni veriyi offline storage'a kaydet
    await storageService.saveWordList(level, data);
    return data;
  } catch (error) {
    console.error(`Error fetching word list for ${level}:`, error);
    return { words: [] };
  }
};

// API'den zorla yeni veri çekmek için kullanılır
const forceFetchWordList = async (level: string): Promise<WordList> => {
  try {
    const allWordLists = await fetchAllWordLists();
    const words = allWordLists[level] || [];
    const data = { words };
    
    // Yeni veriyi offline storage'a kaydet
    await storageService.saveWordList(level, data);
    return data;
  } catch (error) {
    console.error(`Error fetching word list for ${level}:`, error);
    return { words: [] };
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
    YDS: fetchWordList('YDS'),
  };
};

export const forceUpdateWordLists = {
  A1: () => forceFetchWordList('A1'),
  A2: () => forceFetchWordList('A2'),
  B1: () => forceFetchWordList('B1'),
  B2: () => forceFetchWordList('B2'),
  C1: () => forceFetchWordList('C1'),
  C2: () => forceFetchWordList('C2'),
  YDS: () => forceFetchWordList('YDS'),
}; 