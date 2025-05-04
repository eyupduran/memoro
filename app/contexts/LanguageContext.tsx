import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '../services/storage';
import tr from '../locales/tr';
import pt from '../locales/pt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dbService } from '../services/database';

type NativeLanguage = 'tr' | 'pt';
type LearningLanguage = 'en';

interface LanguageContextType {
  nativeLanguage: NativeLanguage;
  learningLanguage: LearningLanguage;
  setNativeLanguage: (lang: NativeLanguage) => void;
  setLearningLanguage: (lang: LearningLanguage) => void;
  translations: typeof tr;
  isLoadingData: boolean;
  currentLanguagePair: string;
  checkAndLoadLanguageData: (callback?: () => void) => Promise<void>;
  showDataLoader: boolean;
  setShowDataLoader: React.Dispatch<React.SetStateAction<boolean>>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<NativeLanguage, typeof tr> = {
  tr,
  pt,
};

const WORD_LIST_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DEFAULT_LANGUAGE: NativeLanguage = 'tr';
const DEFAULT_LEARNING_LANGUAGE: LearningLanguage = 'en';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nativeLanguage, setNativeLanguageState] = useState<NativeLanguage>(DEFAULT_LANGUAGE);
  const [learningLanguage, setLearningLanguageState] = useState<LearningLanguage>(DEFAULT_LEARNING_LANGUAGE);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showDataLoader, setShowDataLoader] = useState(false);

  // Mevcut dil çifti bilgisi
  const currentLanguagePair = `${learningLanguage}-${nativeLanguage}`;

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

  // Dil çifti için verinin olup olmadığını kontrol et ve gerekirse indir
  const checkAndLoadLanguageData = async (callback?: () => void) => {
    try {
      console.log(`Dil çifti kontrolü: ${currentLanguagePair}`);
      
      // SQLite'da bu dil çifti için veri var mı kontrol et
      const isLoaded = await dbService.isLanguageDataLoaded(currentLanguagePair);
      
      if (!isLoaded) {
        console.log(`${currentLanguagePair} dil çifti için veri bulunamadı, indirme işlemi başlatılıyor...`);
        setIsLoadingData(true);
        setShowDataLoader(true); // DataLoader'ı göster
        
        return;
      } else {
        console.log(`${currentLanguagePair} dil çifti için veri zaten yüklü`);
        setIsDataLoaded(true);
        
        if (callback) {
          callback();
        }
      }
    } catch (error) {
      console.error('Dil verisi kontrol hatası:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const setNativeLanguage = async (lang: NativeLanguage) => {
    await storageService.setItem('selectedLanguage', lang);
    
    // Dil değiştiğinde tüm kelime listelerini temizle
    for (const level of WORD_LIST_LEVELS) {
      const key = `wordList_${level}`;
      await AsyncStorage.removeItem(key);
    }
    
    setNativeLanguageState(lang);
    
    // Yeni dil çifti için veriyi kontrol et ve gerekirse DataLoader'ı göster
    const newLangPair = `${learningLanguage}-${lang}`;
    const isLoaded = await dbService.isLanguageDataLoaded(newLangPair);
    
    if (!isLoaded) {
      // Veri yoksa DataLoader'ı hemen göster
      setShowDataLoader(true);
    }
    
    // Yeni dil için verileri kontrol et
    setTimeout(() => {
      checkAndLoadLanguageData();
    }, 500);
  };

  const setLearningLanguage = async (lang: LearningLanguage) => {
    await storageService.setItem('learningLanguage', lang);
    
    // Öğrenme dili değiştiğinde tüm kelime listelerini temizle
    for (const level of WORD_LIST_LEVELS) {
      const key = `wordList_${level}`;
      await AsyncStorage.removeItem(key);
    }
    
    setLearningLanguageState(lang);
    
    // Yeni dil çifti için veriyi kontrol et ve gerekirse DataLoader'ı göster
    const newLangPair = `${lang}-${nativeLanguage}`;
    const isLoaded = await dbService.isLanguageDataLoaded(newLangPair);
    
    if (!isLoaded) {
      // Veri yoksa DataLoader'ı hemen göster
      setShowDataLoader(true);
    }
    
    // Yeni dil için verileri kontrol et
    setTimeout(() => {
      checkAndLoadLanguageData();
    }, 500);
  };

  return (
    <LanguageContext.Provider value={{
      nativeLanguage,
      learningLanguage,
      setNativeLanguage,
      setLearningLanguage,
      translations: translations[nativeLanguage],
      isLoadingData,
      currentLanguagePair,
      checkAndLoadLanguageData,
      showDataLoader,
      setShowDataLoader
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