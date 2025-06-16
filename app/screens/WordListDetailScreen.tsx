import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { dbService } from '../services/database';
import type { Word } from '../types/words';
import { MaterialIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

type Props = NativeStackScreenProps<RootStackParamList, 'WordListDetail'>;

const MIN_WORDS = 2;
const MAX_WORDS = 5;

export const WordListDetailScreen: React.FC<Props> = ({ route, navigation }): React.ReactElement => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const { listId, listName } = route.params;
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [showMaxWordsMessage, setShowMaxWordsMessage] = useState(false);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const searchInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadWords();
    navigation.setOptions({
      title: listName,
    });
  }, [listId, listName]);

  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    
    // Don't search for very short queries to improve performance
    if (searchQuery.trim().length > 0 && searchQuery.trim().length < 2) {
      return;
    }
    
    // Debounce user input
    const timeoutId = setTimeout(() => {
      filterWords();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, words]);

  const loadWords = async () => {
    try {
      setLoading(true);
      const listWords = await dbService.getWordsFromList(Number(listId));
      setWords(listWords);
      setFilteredWords(listWords);
    } catch (error) {
      console.error('Error loading word list items:', error);
      setWords([]);
      setFilteredWords([]);
    } finally {
      setLoading(false);
    }
  };

  const filterWords = () => {
    if (!searchQuery.trim()) {
      setFilteredWords(words);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = words.filter(word => 
      word.word.toLowerCase().includes(query) || 
      word.meaning.toLowerCase().includes(query)
    );
    setFilteredWords(filtered);
  };

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const isScrollingDown = currentScrollY > lastScrollY.current;
    const isScrollingUp = currentScrollY < lastScrollY.current;
    const hasScrolledEnough = Math.abs(currentScrollY - lastScrollY.current) > 20;

    if (hasScrolledEnough) {
      Animated.timing(headerTranslateY, {
        toValue: isScrollingDown ? -100 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setIsHeaderVisible(!isScrollingDown);
    }

    lastScrollY.current = currentScrollY;
  };

  const handleRemoveWord = async (word: string) => {
    try {
      await dbService.removeWordFromList(Number(listId), word);
      // Refresh the list
      loadWords();
    } catch (error) {
      console.error('Error removing word from list:', error);
    }
  };

  const speakText = (text: string) => {
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1,
      rate: 0.8,
    });
  };

  const handleWordSelect = (word: Word) => {
    if (selectedWords.some(w => w.word === word.word)) {
      setSelectedWords(selectedWords.filter(w => w.word !== word.word));
    } else if (selectedWords.length < MAX_WORDS) {
      setSelectedWords([...selectedWords, word]);
    } else {
      showMaxWordsToast();
    }
  };

  const showMaxWordsToast = () => {
    setShowMaxWordsMessage(true);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(4000),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowMaxWordsMessage(false);
    });
  };

  const handleContinue = () => {
    if (selectedWords.length >= MIN_WORDS && selectedWords.length <= MAX_WORDS) {
      navigation.navigate('ImageSelection', {
        wordCount: selectedWords.length,
        selectedWords: selectedWords.map(w => ({
          id: w.id,
          word: w.word,
          meaning: w.meaning,
          example: w.example,
          level: w.level
        })),
      });
    }
  };

  const formatString = (template: string, ...args: any[]): string => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };

  const renderWordItem = ({ item }: { item: Word }) => {
    const isSelected = selectedWords.some(w => w.word === item.word);
    return (
      <TouchableOpacity
        style={[
          styles.wordItemContainer,
          isSelected && styles.selectedWordItemContainer
        ]}
        onPress={() => handleWordSelect(item)}
      >
        <View style={[
          styles.wordItem,
          { 
            backgroundColor: colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}>
          <View style={styles.levelTagContainer}>
            <Text style={[styles.levelTag, { 
              backgroundColor: colors.primary + '20',
              color: colors.primary,
            }]}>
              {item.level}
            </Text>
          </View>
          
          <View style={styles.wordMain}>
            <View style={styles.wordWithSpeech}>
              <Text style={[styles.wordText, { color: colors.text.primary }]}>{item.word}</Text>
              <TouchableOpacity 
                style={styles.speakButton}
                onPress={(e) => {
                  e.stopPropagation();
                  speakText(item.word);
                }}
              >
                <MaterialIcons name="volume-up" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.meaningText, { color: colors.text.secondary }]}>{item.meaning}</Text>
            {item.example && (
              <Text style={[styles.exampleText, { color: colors.text.secondary }]}>
                <Text style={styles.examplePrefix}>{translations.dictionaryScreen?.examplePrefix || 'Örnek:'}</Text> {item.example}
              </Text>
            )}
          </View>

          <View style={styles.wordActions}>
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: colors.error + '15' }]}
              onPress={(e) => {
                e.stopPropagation();
                handleRemoveWord(item.word);
              }}
            >
              <MaterialIcons name="remove-circle-outline" size={16} color={colors.error} />
              <Text style={[styles.removeButtonText, { color: colors.error }]}>
                {translations.wordListModal?.deleteListConfirm || 'Listeden Çıkar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.selectButton, { 
                backgroundColor: isSelected ? colors.primary + '15' : 'transparent',
                borderColor: isSelected ? colors.primary : colors.border,
              }]}
              onPress={(e) => {
                e.stopPropagation();
                handleWordSelect(item);
              }}
            >
              <MaterialIcons 
                name={isSelected ? "check" : "add"} 
                size={16} 
                color={isSelected ? colors.primary : colors.text.secondary} 
              />
              <Text style={[styles.selectButtonText, { 
                color: isSelected ? colors.primary : colors.text.secondary,
              }]}>
                {isSelected ? 'Seçildi' : 'Seç'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[
        styles.headerContainer,
        !isInitialLoad && {
          transform: [{ translateY: headerTranslateY }],
        },
        {
          zIndex: 2,
          backgroundColor: colors.background,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 3,
        }
      ]}>
        <View style={styles.contentContainer}>
          <TextInput
            ref={searchInputRef}
            style={[
              styles.searchInput,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text.primary,
              }
            ]}
            placeholder={translations.dictionaryScreen?.searchPlaceholder || 'Kelime ara...'}
            placeholderTextColor={colors.text.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </Animated.View>

      {filteredWords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons 
            name="list-alt" 
            size={64} 
            color={colors.text.secondary}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            {searchQuery.trim() 
              ? translations.dictionaryScreen?.noResults || 'Sonuç bulunamadı'
              : translations.wordListModal?.noLists || 'Bu listede henüz kelime yok'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredWords}
          renderItem={renderWordItem}
          keyExtractor={(item) => item.word}
          contentContainerStyle={[styles.listContent, { paddingTop: 82, paddingBottom: 84 }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      )}

      <View style={styles.bottomContainer}>
        {showMaxWordsMessage && (
          <Animated.View style={[
            styles.maxWordsToast,
            {
              backgroundColor: colors.primary + '90',
              opacity: fadeAnim,
            }
          ]}>
            <Text style={styles.maxWordsToastText}>
              {formatString(translations.dictionaryScreen?.maxWordsLimit || 'En fazla {0} kelime seçebilirsiniz', MAX_WORDS)}
            </Text>
          </Animated.View>
        )}

        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: colors.primary },
            selectedWords.length < MIN_WORDS && { 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
          onPress={handleContinue}
          disabled={selectedWords.length < MIN_WORDS}
        >
          <Text
            style={[
              styles.continueButtonText,
              { color: colors.text.onPrimary },
              selectedWords.length < MIN_WORDS && { color: colors.text.secondary },
            ]}
          >
            {selectedWords.length < MIN_WORDS 
              ? translations.dictionaryScreen?.selectMinWords || 'En az 2 kelime seçin'
              : formatString(translations.dictionaryScreen?.continueWithWords || '{0} kelime ile devam et', selectedWords.length)
            }
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  listContent: {
    padding: 16,
  },
  wordItemContainer: {
    marginBottom: 8,
    padding: 1,
  },
  selectedWordItemContainer: {
    padding: 0,
  },
  wordItem: {
    padding: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  levelTagContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  levelTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '600',
  },
  wordMain: {
    flex: 1,
    paddingRight: 30,
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
    lineHeight: 16,
  },
  examplePrefix: {
    fontWeight: '500',
    fontStyle: 'normal',
  },
  wordWithSpeech: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakButton: {
    padding: 2,
    marginLeft: 6,
  },
  wordActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  removeButtonText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 3,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  selectButtonText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 3,
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
    fontSize: 16,
    textAlign: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    marginTop: 6,
    alignItems: 'center',
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  continueButton: {
    width: '90%',
    height: 56,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 20,
  },
  maxWordsToast: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxWordsToastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
}); 