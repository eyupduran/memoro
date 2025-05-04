import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { dbService } from '../services/database';
import { storageService } from '../services/storage';
import type { Word, LearnedWord } from '../types/words';

type Props = NativeStackScreenProps<RootStackParamList, 'WordList'>;

export const WordListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const { level, wordCount } = route.params;
  const [availableWords, setAvailableWords] = useState<Word[]>([]);
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedWordDetail, setSelectedWordDetail] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailableWords();
  }, []);

  // Sadece seçilen seviyedeki kelimeleri getir
  const loadAvailableWords = async () => {
    try {
      setLoading(true);
      console.log(`Seçilen seviye için kelimeler getiriliyor: ${level}, ${wordCount} kelime`);
      
      // Daha önce öğrenilen kelimeleri al
      const learnedWords = await storageService.getLearnedWords();
      
      // Sadece seçilen seviyedeki kelimeleri yükle
      const levelWords = await dbService.getWords(level, currentLanguagePair);
      console.log(`Seviye ${level} için ${levelWords.length} kelime getirildi`);
      
      // Öğrenilmemiş kelimeleri filtrele
      const unlearned = levelWords.filter(word => 
        !learnedWords.some(learned => learned.word === word.word)
      );
      console.log(`Öğrenilmemiş ${unlearned.length} kelime bulundu`);

      // Rastgele kelime seçimi
      const shuffled = shuffleArray(unlearned);
      const selected = shuffled.slice(0, wordCount);
      
      setAvailableWords(unlearned);
      setSelectedWords(selected);
    } catch (error) {
      console.error('Error loading words:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Fisher-Yates (Knuth) Shuffle - daha etkili rastgele dizilim için
  const shuffleArray = (array: Word[]): Word[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const showWordDetail = (word: Word) => {
    setSelectedWordDetail(word);
    setModalVisible(true);
  };

  const handleContinue = () => {
    if (selectedWords.length === wordCount) {
      navigation.navigate('ImageSelection', {
        selectedWords,
        level,
        wordCount,
      });
    }
  };

  const formatString = (template: string, ...args: any[]) => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          {translations.wordList.loading}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>
        {formatString(translations.wordList.title, wordCount)}
      </Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
        {translations.wordList.subtitle}
      </Text>
      
      <ScrollView style={styles.wordList}>
        {selectedWords.map((word) => (
          <TouchableOpacity
            key={word.word}
            style={[
              styles.wordItem,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }
            ]}
            onPress={() => showWordDetail(word)}
          >
            <View style={styles.wordContent}>
              <Text style={[styles.word, { color: colors.text.primary }]}>
                {word.word}
              </Text>
              <Text style={[styles.meaning, { color: colors.text.secondary }]}>
                {word.meaning}
              </Text>
            </View>
            <MaterialIcons
              name="info-outline"
              size={24}
              color={colors.text.secondary}
              onPress={() => showWordDetail(word)}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            {selectedWordDetail && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                    {selectedWordDetail.word}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                      {translations.wordList.wordDetail.meaning}
                    </Text>
                    <Text style={[styles.detailText, { color: colors.text.primary }]}>
                      {selectedWordDetail.meaning}
                    </Text>
                  </View>
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                      {translations.wordList.wordDetail.example}
                    </Text>
                    <Text style={[styles.detailText, { color: colors.text.primary }]}>
                      {selectedWordDetail.example}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            { 
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.primary,
              marginRight: 12,
            }
          ]}
          onPress={loadAvailableWords}
        >
          <View style={styles.buttonContent}>
            <MaterialIcons
              name="refresh"
              size={20}
              color={colors.primary}
              style={styles.buttonIcon}
            />
            <Text style={[styles.buttonText, { color: colors.primary }]}>
              {translations.wordList.buttons.regenerate}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { 
              backgroundColor: colors.primary,
            }
          ]}
          onPress={handleContinue}
        >
          <View style={styles.buttonContent}>
            <MaterialIcons
              name="arrow-forward"
              size={20}
              color={colors.text.onPrimary}
              style={styles.buttonIcon}
            />
            <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
              {translations.wordList.buttons.continue}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  wordList: {
    flex: 1,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  wordContent: {
    flex: 1,
  },
  word: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  meaning: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    paddingBottom: 32,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 16,
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 16,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 