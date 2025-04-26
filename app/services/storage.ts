import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LearnedWord, WordList } from '../types/words';

const STORAGE_KEYS = {
  LEARNED_WORDS: 'learnedWords',
  OFFLINE_MODE: 'offlineMode',
  WORD_LIST_PREFIX: 'wordList_',
  LAST_SYNC_DATE: 'lastSyncDate',
  SELECTED_LANGUAGE: 'selectedLanguage'
};

class StorageService {
  async getLearnedWords(): Promise<LearnedWord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LEARNED_WORDS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting learned words:', error);
      return [];
    }
  }

  async saveLearnedWords(words: LearnedWord[]): Promise<boolean> {
    try {
      const existingWords = await this.getLearnedWords();
      const newWords = [...existingWords, ...words];
      
      // Tekrar eden kelimeleri çıkar
      const uniqueWords = newWords.filter((word, index, self) =>
        index === self.findIndex((w) => w.word === word.word)
      );
      
      await AsyncStorage.setItem(STORAGE_KEYS.LEARNED_WORDS, JSON.stringify(uniqueWords));
      return true;
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
}

export const storageService = new StorageService();

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