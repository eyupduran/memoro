import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { fetchGithubImages } from '../services/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = (width - 48) / 2;

// Fisher-Yates shuffle algoritması
const shuffleArray = (array: string[]) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

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
      
      // Çevrimdışı mod kontrolü
      const isOfflineMode = await AsyncStorage.getItem('offlineMode');
      
      if (isOfflineMode === 'true') {
        // Çevrimdışı modda AsyncStorage'dan resimleri al
        const cachedImages = await AsyncStorage.getItem('backgroundImages');
        if (cachedImages) {
          const images = JSON.parse(cachedImages);
          setBackgrounds(shuffleArray(images));
        } else {
          // Cache'de resim yoksa GitHub'dan çek ve kaydet
          const images = await fetchGithubImages();
          await AsyncStorage.setItem('backgroundImages', JSON.stringify(images));
          setBackgrounds(shuffleArray(images));
        }
      } else {
        // Çevrimiçi modda direkt GitHub'dan çek
        const images = await fetchGithubImages();
        setBackgrounds(shuffleArray(images));
      }
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
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
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {translations.imageSelection.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          {translations.imageSelection.subtitle}
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.imageGrid}
      >
        {backgrounds.map((imageUrl, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.imageCard,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.border,
                width: CARD_WIDTH,
              },
            ]}
            onPress={() => handleImageSelect(imageUrl)}
          >
            <Image source={{ uri: imageUrl }} style={styles.image} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  imageCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    resizeMode: 'cover',
  },
}); 