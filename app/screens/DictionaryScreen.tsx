import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { NumberSelector } from '../components/NumberSelector';
import { WordCard } from '../components/WordCard';
import { getWordLists } from '../data/wordLists';
import type { Word, WordList } from '../types/words';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

type DictionaryScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DictionaryScreen = () => {
  const navigation = useNavigation<DictionaryScreenNavigationProp>();
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [wordCount, setWordCount] = useState(3);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAllWords();
  }, []);

  const fetchAllWords = async () => {
    setLoading(true);
    try {
      const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'YDS'] as const;
      let allWords: Word[] = [];
      
      const wordLists = await getWordLists();
      
      for (const level of levels) {
        try {
          const data = await wordLists[level];
          if (data && data.words) {
            allWords = [...allWords, ...data.words];
          }
        } catch (error) {
          console.error(`Error fetching words for level ${level}:`, error);
        }
      }
      
      // Tekrar eden kelimeleri kaldır
      const uniqueWords = allWords.reduce((acc: Word[], current) => {
        const exists = acc.find(word => word.word.toLowerCase() === current.word.toLowerCase());
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      setWords(uniqueWords);
      setFilteredWords(uniqueWords);
    } catch (error) {
      console.error('Error fetching words:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const filtered = words.filter(word =>
      word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      word.meaning.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredWords(filtered);
  }, [searchQuery, words]);

  const handleWordSelect = (word: Word) => {
    if (selectedWords.some(w => w.word === word.word)) {
      setSelectedWords(selectedWords.filter(w => w.word !== word.word));
    } else if (selectedWords.length < wordCount) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleContinue = () => {
    if (selectedWords.length === wordCount) {
      navigation.navigate('ImageSelection', {
        level: 'custom',
        wordCount,
        selectedWords: selectedWords.map(w => ({
          word: w.word,
          meaning: w.meaning,
          example: w.example
        })),
      });
    }
  };

  const formatString = (template: string, ...args: any[]) => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };

  const renderItem = ({ item }: { item: Word }) => (
    <TouchableOpacity
      style={[
        styles.wordItem,
        { 
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        selectedWords.some(w => w.word === item.word) && [
          styles.selectedWordItem,
          { borderColor: colors.primary }
        ],
      ]}
      onPress={() => handleWordSelect(item)}
    >
      <View>
        <Text style={[styles.wordText, { color: colors.text.primary }]}>{item.word}</Text>
        <Text style={[styles.meaningText, { color: colors.text.secondary }]}>{item.meaning}</Text>
        {item.example && (
          <Text style={[styles.exampleText, { color: colors.text.secondary }]}>
            {translations.dictionaryScreen.examplePrefix} {item.example}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderWordCountSelector = () => {
    const counts = [3, 4, 5, 6];
    return (
      <View style={styles.wordCountContainer}>
        <Text style={[styles.label, { color: colors.text.primary }]}>
          {translations.dictionaryScreen.wordCount}
        </Text>
        <View style={styles.wordCountList}>
          {counts.map((count) => (
            <TouchableOpacity
              key={count}
              style={[
                styles.wordCountButton,
                { 
                  backgroundColor: colors.surface,
                },
                count === wordCount && [
                  styles.selectedWordCountButton,
                  { 
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary,
                    shadowOffset: {
                      width: 0,
                      height: 4,
                    },
                    shadowOpacity: 0.3,
                    shadowRadius: 4.65,
                    elevation: 8,
                  }
                ],
              ]}
              onPress={() => setWordCount(count)}
            >
              <Text
                style={[
                  styles.wordCountText,
                  { color: colors.text.secondary },
                  count === wordCount && { 
                    color: colors.text.onPrimary,
                    fontWeight: '700',
                  },
                ]}
              >
                {count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderWordCountSelector()}

      <View style={[styles.infoContainer, { backgroundColor: colors.surfaceVariant }]}>
        <Text style={[styles.infoText, { color: colors.text.secondary }]}>
          {formatString(translations.dictionaryScreen.infoText, wordCount)}
        </Text>
      </View>

      <TextInput
        style={[
          styles.searchInput,
          { 
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text.primary,
          }
        ]}
        placeholder={translations.dictionaryScreen.searchPlaceholder}
        placeholderTextColor={colors.text.secondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={filteredWords}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.word}-${index}`}
          style={styles.wordList}
        />
      )}

      <TouchableOpacity
        style={[
          styles.continueButton,
          { backgroundColor: colors.primary },
          selectedWords.length !== wordCount && { 
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
        onPress={handleContinue}
        disabled={selectedWords.length !== wordCount}
      >
        <Text
          style={[
            styles.continueButtonText,
            { color: colors.text.onPrimary },
            selectedWords.length !== wordCount && { color: colors.text.secondary },
          ]}
        >
          {formatString(translations.dictionaryScreen.continueButton, selectedWords.length, wordCount)}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  infoContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  wordCountContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '600',
  },
  wordCountList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  wordCountButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedWordCountButton: {
    transform: [{ scale: 1.1 }],
  },
  wordCountText: {
    fontSize: 24,
    fontWeight: '600',
  },
  wordList: {
    flex: 1,
  },
  wordItem: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedWordItem: {
    borderWidth: 2,
  },
  wordText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  meaningText: {
    fontSize: 14,
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  continueButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DictionaryScreen; 