import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Dimensions,
  StatusBar,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/database';
import { loadWordsForLanguagePair } from '../data/wordLists';
import { fetchGithubImages } from '../services/storage';

const { width, height } = Dimensions.get('window');

interface DataLoaderProps {
  visible: boolean;
  onComplete: () => void;
  languagePair: string;
  forceUpdate?: boolean;
}

export const DataLoader: React.FC<DataLoaderProps> = ({ 
  visible, 
  onComplete,
  languagePair,
  forceUpdate = false
}) => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'loading' | 'completed' | 'error'>('loading');
  const [statusText, setStatusText] = useState('');
  const [currentLevel, setCurrentLevel] = useState<string | undefined>();
  const [loadingImages, setLoadingImages] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, languagePair]);

  const loadData = async () => {
    try {
      setStatus('loading');
      setStatusText(translations.dataLoader.loading);

      // Eğer forceUpdate true ise veya veriler henüz indirilmemişse
      const isLoaded = !forceUpdate && await dbService.isLanguageDataLoaded(languagePair);
      
      if (isLoaded) {
        console.log(`${languagePair} dil çifti için veriler zaten indirilmiş`);
        setProgress(80);
        
        await loadBackgroundImages();
        
        setProgress(100);
        setStatus('completed');
        setStatusText(translations.dataLoader.completed);
        setTimeout(onComplete, 1500);
        return;
      }

      // WordLists'teki yükleme fonksiyonunu kullan ve ilerleme takibi yap
      const success = await loadWordsForLanguagePair(
        languagePair,
        // İlerleme callback'i
        (progressValue, level) => {
          // Kelimeler %80 ilerleme olarak kabul edilsin
          setProgress(progressValue * 0.8); // 0-80 arası
          if (level) {
            setCurrentLevel(level);
          }
          setStatusText(
            `${translations.dataLoader.loading} (${Math.floor(progressValue * 0.8)}%)`
          );
        }
      );
      
      if (!success) {
        throw new Error('Veri yükleme işlemi başarısız oldu');
      }
      
      // Son güncelleme tarihini kaydet
      await dbService.setDbInfo(`lastUpdate_${languagePair}`, new Date().toISOString());
      
      // Arkaplan resimlerini indir (%20 ilerleme)
      await loadBackgroundImages();
      
      console.log(`${languagePair} dil çifti için tüm veriler başarıyla indirildi`);
      setProgress(100);
      setStatus('completed');
      setStatusText(translations.dataLoader.completed);
      
      // Tamamlandığında callback'i çağır
      setTimeout(onComplete, 1500);
    } catch (error) {
      console.error('Veri indirme hatası:', error);
      setStatus('error');
      setStatusText(translations.dataLoader.error);
    }
  };

  // Arkaplan resimlerini yükle
  const loadBackgroundImages = async () => {
    try {
      setLoadingImages(true);
      setStatusText(`${translations.dataLoader.loadingImages}`);
      
      // Arkaplan resimleri veritabanında kayıtlı mı kontrol et
      const hasImages = await dbService.hasBackgroundImagesInDb();
      
      if (!hasImages || forceUpdate) {
        // Resim URL'lerini GitHub'dan al
        const imageUrls = await fetchGithubImages();
        
        if (imageUrls.length > 0) {
          // Resimleri veritabanına kaydet
          const imageObjects = imageUrls.map(url => ({ url }));
          await dbService.saveBackgroundImages(imageObjects);
          console.log(`${imageUrls.length} arkaplan resmi veritabanına kaydedildi`);
          
          // Resimleri önbelleğe al (storage servisini import etmek yerine doğrudan dbService üzerinden çağırıyoruz)
          const { storageService } = require('../services/storage');
          await storageService.downloadAndCacheImages(imageUrls);
          console.log('Arkaplan resimleri önbelleğe alındı');
        } else {
          console.warn('Hiç arkaplan resmi bulunamadı');
        }
      } else {
        console.log('Arkaplan resimleri zaten veritabanında kayıtlı');
        
        // Veritabanında kayıtlı resimlerin yerel dosya sisteminde de var olduğundan emin ol
        const dbImages = await dbService.getBackgroundImages();
        const imageUrls = dbImages.map(img => img.url);
        
        if (imageUrls.length > 0) {
          const { storageService } = require('../services/storage');
          await storageService.downloadAndCacheImages(imageUrls);
          console.log('Arkaplan resimleri önbelleğe alındı/güncellendi');
        }
      }
      
      setLoadingImages(false);
      setProgress(100);
    } catch (error) {
      console.error('Arkaplan resimleri yüklenirken hata:', error);
      setLoadingImages(false);
      // Resim yükleme hatası olduğunda bile devam edebiliriz
      setProgress(95);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.8)" />
      <View style={styles.container}>
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {status === 'loading' ? translations.dataLoader.loading : 
              status === 'completed' ? translations.dataLoader.completed : 
              translations.dataLoader.error}
          </Text>
          
          {status === 'loading' && (
            <>
              <ActivityIndicator 
                size="large" 
                color={colors.primary} 
                style={styles.loader}
              />
              
              <View style={styles.progressContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      backgroundColor: colors.primary,
                      width: `${progress}%` 
                    }
                  ]} 
                />
              </View>
              
              <Text style={[styles.statusText, { color: colors.text.secondary }]}>
                {statusText}
              </Text>
              
              {currentLevel && !loadingImages && (
                <Text style={[styles.levelText, { color: colors.text.secondary }]}>
                  {currentLevel} seviyesi kaydediliyor...
                </Text>
              )}
              
              {loadingImages && (
                <Text style={[styles.levelText, { color: colors.text.secondary }]}>
                  Arkaplan resimleri hazırlanıyor...
                </Text>
              )}
              
              <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                {translations.dataLoader.pleaseWait}
              </Text>
            </>
          )}
          
          {status === 'completed' && (
            <Text style={[styles.statusText, { color: colors.text.secondary }]}>
              {translations.dataLoader.completed}
            </Text>
          )}
          
          {status === 'error' && (
            <Text style={[styles.statusText, { color: colors.error }]}>
              {translations.dataLoader.error}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 9999,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  content: {
    width: width * 0.85,
    minHeight: 250,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  loader: {
    marginVertical: 24,
  },
  progressContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  statusText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  levelText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
  },
}); 