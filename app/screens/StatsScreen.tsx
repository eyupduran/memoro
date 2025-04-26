import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { storageService } from '../services/storage';
import type { LearnedWord } from '../types/words';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

const LEVELS = [
  { id: 'A1', name: 'A1', description: 'Beginner' },
  { id: 'A2', name: 'A2', description: 'Elementary' },
  { id: 'B1', name: 'B1', description: 'Pre-Intermediate' },
  { id: 'B2', name: 'B2', description: 'Upper Intermediate' },
  { id: 'C1', name: 'C1', description: 'Advanced' },
  { id: 'C2', name: 'C2', description: 'Proficiency' },
  { id: 'YDS', name: 'YDS', description: 'Sınav Hazırlık' },
  { id: 'custom', name: 'Sözlük', description: 'Sözlükten Seçilenler' },
];

export const StatsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWords, setTotalWords] = useState(0);
  const [selectedWords, setSelectedWords] = useState<LearnedWord[]>([]);

  useEffect(() => {
    loadWords();
  }, [selectedLevel]);

  const loadWords = async () => {
    try {
      setLoading(true);
      const allWords = await storageService.getLearnedWords();
      const filteredWords = selectedLevel === 'all' 
        ? allWords 
        : allWords.filter(word => word.level === selectedLevel);
      
      setWords(filteredWords);
      setTotalWords(allWords.length);
    } catch (error) {
      console.error('Error loading learned words:', error);
      setWords([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleWordSelect = (word: LearnedWord) => {
    if (selectedWords.some(w => w.word === word.word)) {
      setSelectedWords(selectedWords.filter(w => w.word !== word.word));
    } else if (selectedWords.length < 6) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleReinforce = () => {
    if (selectedWords.length >= 3 && selectedWords.length <= 6) {
      navigation.navigate('ImageSelection', {
        level: 'custom',
        wordCount: selectedWords.length,
        selectedWords: selectedWords.map(w => ({
          word: w.word,
          meaning: w.meaning,
          example: w.example || ''
        })),
        isReinforcement: true
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          İstatistikler
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Toplam {totalWords} kelime öğrenildi
        </Text>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.levelScroll}
        contentContainerStyle={styles.levelScrollContent}
      >
        <TouchableOpacity
          style={[
            styles.levelButton,
            { 
              backgroundColor: selectedLevel === 'all' ? colors.primary : colors.surface,
              borderColor: selectedLevel === 'all' ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setSelectedLevel('all')}
        >
          <Text
            style={[
              styles.levelName,
              { 
                color: selectedLevel === 'all' ? colors.text.onPrimary : colors.text.primary,
              },
            ]}
          >
            Tümü
          </Text>
          <Text
            style={[
              styles.levelDescription,
              { 
                color: selectedLevel === 'all' ? colors.text.onPrimary : colors.text.secondary,
              },
            ]}
          >
            Tüm Kelimeler
          </Text>
        </TouchableOpacity>
        {LEVELS.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.levelButton,
              { 
                backgroundColor: selectedLevel === level.id ? colors.primary : colors.surface,
                borderColor: selectedLevel === level.id ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSelectedLevel(level.id)}
          >
            <Text
              style={[
                styles.levelName,
                { 
                  color: selectedLevel === level.id ? colors.text.onPrimary : colors.text.primary,
                },
              ]}
            >
              {level.name}
            </Text>
            <Text
              style={[
                styles.levelDescription,
                { 
                  color: selectedLevel === level.id ? colors.text.onPrimary : colors.text.secondary,
                },
              ]}
            >
              {level.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : words.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons 
            name="school" 
            size={64} 
            color={colors.text.secondary}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            {selectedLevel === 'all' 
              ? 'Henüz öğrenilen kelime yok'
              : 'Bu seviyede henüz öğrenilen kelime yok'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
            Yeni kelimeler öğrendikçe burada listelenecek
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.infoContainer}>
            <MaterialIcons 
              name="info-outline" 
              size={20} 
              color={colors.text.secondary}
              style={styles.infoIcon}
            />
            <Text style={[styles.infoText, { color: colors.text.secondary }]}>
              Öğrendiğiniz kelimeleri pekiştirmek için 3-6 arası kelime seçebilirsiniz. 
              Seçtiğiniz kelimelerle görsel eşleştirme yaparak tekrar çalışabilirsiniz.
            </Text>
          </View>

          <ScrollView 
            style={[
              styles.wordList, 
              selectedWords.length >= 3 && selectedWords.length <= 6 && styles.wordListWithButton
            ]} 
            showsVerticalScrollIndicator={false}
          >
            {words.map((word, index) => (
              <TouchableOpacity
                key={`${word.word}-${index}`}
                onPress={() => handleWordSelect(word)}
                style={[
                  styles.wordCard,
                  { 
                    backgroundColor: colors.surface,
                    borderColor: selectedWords.some(w => w.word === word.word) 
                      ? colors.primary 
                      : colors.border,
                    borderWidth: selectedWords.some(w => w.word === word.word) ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.wordHeader}>
                  <View style={styles.wordMainContent}>
                    <Text style={[styles.wordText, { color: colors.text.primary }]}>
                      {word.word}
                    </Text>
                    <Text style={[styles.meaningText, { color: colors.text.secondary }]}>
                      {word.meaning}
                    </Text>
                  </View>
                  <View style={styles.wordMeta}>
                    <Text style={[styles.levelTag, { 
                      backgroundColor: colors.primary + '20',
                      color: colors.primary,
                    }]}>
                      {word.level.toUpperCase()}
                    </Text>
                    <Text style={[styles.dateText, { color: colors.text.secondary }]}>
                      {formatDate(word.learnedAt)}
                    </Text>
                  </View>
                </View>
                {word.example && (
                  <Text style={[styles.exampleText, { color: colors.text.secondary }]}>
                    {word.example}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedWords.length >= 3 && selectedWords.length <= 6 && (
            <TouchableOpacity
              style={[styles.reinforceButton, { backgroundColor: colors.primary }]}
              onPress={handleReinforce}
            >
              <Text style={[styles.reinforceButtonText, { color: colors.text.onPrimary }]}>
                {selectedWords.length} Kelimeyi Pekiştir
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  levelScroll: {
    maxHeight: 80,
    marginBottom: 16,
  },
  levelScrollContent: {
    paddingRight: 20,
  },
  levelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    minWidth: 120,
  },
  levelName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  levelDescription: {
    fontSize: 12,
  },
  loader: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  wordList: {
    flex: 1,
  },
  wordListWithButton: {
    marginBottom: 80,
  },
  wordCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wordMainContent: {
    flex: 1,
    marginRight: 12,
  },
  wordMeta: {
    alignItems: 'flex-end',
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  meaningText: {
    fontSize: 14,
  },
  levelTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  dateText: {
    fontSize: 11,
  },
  reinforceButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reinforceButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});