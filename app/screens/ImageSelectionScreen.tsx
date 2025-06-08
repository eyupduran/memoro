import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { storageService } from '../services/storage';
import { dbService } from '../services/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type { Word } from '../types/words';

const { width } = Dimensions.get('window');
// Kenar boşluklarını dikkate alarak hesaplama yapalım
const CONTAINER_PADDING = 16;
const GRID_SPACING = 16;
// Her kart için eşit genişlik (container padding ve kartlar arası boşluk dahil)
const CARD_WIDTH = (width - (CONTAINER_PADDING * 2) - GRID_SPACING) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.5; // 3:2 aspect ratio

// Fisher-Yates (Knuth) Shuffle
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

type Props = NativeStackScreenProps<RootStackParamList, 'ImageSelection'>;

export const ImageSelectionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const { selectedWords, level, wordCount } = route.params;
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      
      // Doğrudan veritabanından kaydedilmiş resimleri al
      const dbImages = await dbService.getBackgroundImages();
      
      if (dbImages.length > 0) {
        // Resimler veritabanından alınıyor
        console.log('Arkaplan resimleri veritabanından alındı');
        
        // Yerel dosya yolları olan resimleri öncelikle kullan
        const localImages = dbImages
          .filter(img => img.localPath !== null)
          .map(img => img.localPath as string);
          
        if (localImages.length > 0) {
          // Yerel dosyaların gerçekten var olduğunu kontrol et
          const validLocalImages = await validateLocalImages(localImages);
          
          if (validLocalImages.length > 0) {
            // Yerel dosyalara öncelik ver
            setBackgrounds(shuffleArray(validLocalImages));
            setLoading(false);
            return;
          }
        }
        
        // Yerel dosya yoksa veya geçersizse URL'leri kullan
        // Ancak önce bu URL'leri indirmeye çalış
        const imageUrls = dbImages.map(img => img.url);
        
        // İnternet bağlantısı kontrolü
        const isConnected = await checkInternetConnection();
        
        if (isConnected) {
          // İnternet varsa resimleri indir
          console.log('İnternet bağlantısı var, resimleri indirmeye çalışılıyor...');
          try {
            const { storageService } = require('../services/storage');
            const cachedImages = await storageService.downloadAndCacheImages(imageUrls);
            
            if (cachedImages.length > 0) {
              setBackgrounds(shuffleArray(cachedImages));
              setLoading(false);
              return;
            }
          } catch (downloadError) {
            console.error('Resim indirme hatası:', downloadError);
            // İndirme başarısız olursa URL'leri kullan
          }
        }
        
        // İndirme başarısız olduysa veya internet yoksa URL'leri kullan
        setBackgrounds(shuffleArray(imageUrls));
      } else {
        // Veritabanında resim yok, StorageService üzerinden yükle
        console.log('Veritabanında resim bulunamadı, StorageService kullanılıyor');
        const images = await storageService.getBackgroundImages();
        setBackgrounds(shuffleArray(images));
      }
    } catch (error) {
      console.error('Resimler yüklenirken hata oluştu:', error);
      // Hata durumunda boş bile olsa bir array dönmeli
      setBackgrounds([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Yerel dosyaların var olup olmadığını kontrol et
  const validateLocalImages = async (imagePaths: string[]): Promise<string[]> => {
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
  };
  
  // Basit internet bağlantısı kontrolü
  const checkInternetConnection = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://www.google.com', { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('İnternet bağlantısı yok veya zayıf');
      return false;
    }
  };

  const handleImageSelect = (imageUrl: string) => {
    navigation.navigate('WordOverlay', {
      selectedWords,
      selectedImage: imageUrl,
      level,
      wordCount,
      isReinforcement: route.params.isReinforcement
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          {translations.imageSelection.loading}
        </Text>
      </View>
    );
  }

  if (backgrounds.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          {translations.imageSelection.error}
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={loadImages}
        >
          <Text style={[styles.retryButtonText, { color: colors.background }]}>
            {translations.imageSelection.retry}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>
        {translations.imageSelection.title}
      </Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
        {translations.imageSelection.subtitle}
      </Text>
      
      <FlatList
        data={backgrounds}
        numColumns={2}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.imageCard,
              { backgroundColor: colors.card.background }
            ]}
            onPress={() => handleImageSelect(item)}
          >
            <Image
              source={{ uri: item }}
              style={styles.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: CONTAINER_PADDING,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  grid: {
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    width: '100%',
  },
  imageCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: GRID_SPACING,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 