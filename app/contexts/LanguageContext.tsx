import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '../services/storage';
import tr from '../locales/tr';
import pt from '../locales/pt';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NativeLanguage = 'tr' | 'pt';
type LearningLanguage = 'en';

interface LanguageContextType {
  nativeLanguage: NativeLanguage;
  learningLanguage: LearningLanguage;
  setNativeLanguage: (lang: NativeLanguage) => void;
  setLearningLanguage: (lang: LearningLanguage) => void;
  translations: typeof tr;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<NativeLanguage, typeof tr> = {
  tr,
  pt,
};

const WORD_LIST_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'YDS'];
const DEFAULT_LANGUAGE: NativeLanguage = 'tr';
const DEFAULT_LEARNING_LANGUAGE: LearningLanguage = 'en';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nativeLanguage, setNativeLanguageState] = useState<NativeLanguage>(DEFAULT_LANGUAGE);
  const [learningLanguage, setLearningLanguageState] = useState<LearningLanguage>(DEFAULT_LEARNING_LANGUAGE);

  useEffect(() => {
    const loadLanguages = async () => {
      const savedNativeLanguage = await storageService.getItem('selectedLanguage');
      const savedLearningLanguage = await storageService.getItem('learningLanguage');

      if (savedNativeLanguage && (savedNativeLanguage === 'tr' || savedNativeLanguage === 'pt')) {
        setNativeLanguageState(savedNativeLanguage as NativeLanguage);
      } else {
        await storageService.setItem('selectedLanguage', DEFAULT_LANGUAGE);
      }

      if (savedLearningLanguage === 'en') {
        setLearningLanguageState(savedLearningLanguage);
      } else {
        await storageService.setItem('learningLanguage', DEFAULT_LEARNING_LANGUAGE);
      }
    };
    loadLanguages();
  }, []);

  const setNativeLanguage = async (lang: NativeLanguage) => {
    await storageService.setItem('selectedLanguage', lang);
    
    // Dil değiştiğinde tüm kelime listelerini temizle
    for (const level of WORD_LIST_LEVELS) {
      const key = `wordList_${level}`;
      await AsyncStorage.removeItem(key);
    }
    
    setNativeLanguageState(lang);
  };

  const setLearningLanguage = async (lang: LearningLanguage) => {
    await storageService.setItem('learningLanguage', lang);
    
    // Öğrenme dili değiştiğinde tüm kelime listelerini temizle
    for (const level of WORD_LIST_LEVELS) {
      const key = `wordList_${level}`;
      await AsyncStorage.removeItem(key);
    }
    
    setLearningLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{
      nativeLanguage,
      learningLanguage,
      setNativeLanguage,
      setLearningLanguage,
      translations: translations[nativeLanguage],
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}; 