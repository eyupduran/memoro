import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { NumberSelector } from '../components/NumberSelector';
import { WordCard } from '../components/WordCard';
import { dbService } from '../services/database';
import type { Word, WordList, Level } from '../types/words';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { storageService } from '../services/storage';
import { WordListModal } from '../components/WordListModal';
import * as Speech from 'expo-speech';
import { MaterialIcons } from '@expo/vector-icons';
import { DetailedDictionaryScreen } from './DetailedDictionaryScreen';

type DictionaryScreenNavigationProp = StackNavigationProp<RootStackParamList>;

type DictionaryScreenProps = {
  isModal?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  openDetailedAsModal?: boolean;
};

const DictionaryScreen: React.FC<DictionaryScreenProps> = ({ 
  isModal = false,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  openDetailedAsModal
}) => {
  const navigation = useNavigation<DictionaryScreenNavigationProp>();
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchQueryChange || setInternalSearchQuery;
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [showMaxWordsMessage, setShowMaxWordsMessage] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const headerHeight = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const [selectedWordForList, setSelectedWordForList] = useState<Word | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const activeSearchId = useRef(0);
  
  // State for detailed dictionary modal
  const [isDetailedDictionaryModalVisible, setIsDetailedDictionaryModalVisible] = useState(false);
  const [selectedWordForDetail, setSelectedWordForDetail] = useState<string>('');
  
  const ITEMS_PER_PAGE = 50;
  const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const MIN_WORDS = 2;
  const MAX_WORDS = 5;
  const SCROLL_THRESHOLD = 50; // Minimum scroll distance to trigger header animation
  const SCROLL_OFFSET_TRIGGER = 20; // Minimum difference in scroll position to trigger change

  useEffect(() => {
    // In modal mode, words are fetched based on search input.
    // Otherwise, fetch the initial list of words.
    if (!isModal) {
      fetchWords();
    }
  }, []);

  useEffect(() => {
    if (isModal && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300); // Add a small delay to ensure the modal animation is complete
    }
  }, [isModal]);

  // Daha fazla kelime yükle
  const loadMoreWords = () => {
    if (!loading && hasMore && (!isModal || searchQuery.trim())) {
      setPage(prev => prev + 1);
      fetchWords();
    }
  };

  const fetchWords = async () => {
    // Increment and assign a unique ID for this search operation.
    const searchId = ++activeSearchId.current;

    // Don't fetch if it's a modal without a search query.
    if (isModal && !searchQuery.trim()) {
      setWords([]);
      setFilteredWords([]);
      return;
    }

    setLoading(true);
    try {
      let results: Word[];
      
      if (searchQuery.trim() && selectedLevel) {
        results = await dbService.searchWordsByQueryAndLevel(searchQuery, selectedLevel, currentLanguagePair, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      } else if (searchQuery.trim()) {
        results = await dbService.searchWords(searchQuery, currentLanguagePair, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      } else if (selectedLevel) {
        results = await dbService.searchWordsByLevel(selectedLevel, currentLanguagePair, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      } else {
        results = await dbService.getAllWords(currentLanguagePair, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      }

      // If this is not the most recent search, ignore its results.
      if (searchId !== activeSearchId.current) {
        return;
      }

      if (page === 0) {
        setWords(results);
        setFilteredWords(results);
      } else {
        setWords(prev => [...prev, ...results]);
        setFilteredWords(prev => [...prev, ...results]);
      }
      
      setHasMore(results.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching words:', error);
    }
    setLoading(false);
  };

  // Arama yapıldığında veya filtre değiştiğinde kelimeleri getir
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    
    // Reset page state
    setPage(0);

    // Don't search for very short queries to improve performance
    if (searchQuery.trim().length > 0 && searchQuery.trim().length < 2) {
      return;
    }
    
    // Debounce user input
    const timeoutId = setTimeout(() => {
      fetchWords();
    }, 300); // Reduced debounce time for a snappier feel
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentLanguagePair, selectedLevel]);

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

  const handleWordSelect = (word: Word) => {
    if (selectedWords.some(w => w.word === word.word)) {
      setSelectedWords(selectedWords.filter(w => w.word !== word.word));
    } else if (selectedWords.length < MAX_WORDS) {
      setSelectedWords([...selectedWords, word]);
    } else {
      showMaxWordsToast();
    }
  };

  const handleContinue = () => {
    if (selectedWords.length >= MIN_WORDS && selectedWords.length <= MAX_WORDS) {
      // Öğrenilen kelimeleri kaydet
      const now = new Date().toISOString();
      const learnedWords = selectedWords.map(word => ({
        id: word.id,
        word: word.word,
        meaning: word.meaning,
        example: word.example || '',
        level: word.level || '',
        learnedAt: now
      }));
      
      // Kelimeleri öğrenilmiş olarak kaydet
      storageService.saveLearnedWords(learnedWords, currentLanguagePair);
      
      // Görüntü seçim ekranına git
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

  const formatString = (template: string, ...args: any[]) => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };

  // Metni sesli okuma fonksiyonu
  const speakText = (text: string) => {
    // Mevcut konuşma varsa durdur
    Speech.stop();
    
    // Metni seslendir
    Speech.speak(text, {
      language: currentLanguagePair.split('-')[0], // İlk dil kodu (örn: "en-tr" -> "en")
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const renderItem = ({ item }: { item: Word }) => {
    const isSelected = !isModal && selectedWords.some(w => w.word === item.word);
    return (
      <TouchableOpacity
        style={[
          styles.wordItemContainer,
          isSelected && styles.selectedWordItemContainer
        ]}
        onPress={() => !isModal && handleWordSelect(item)}
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
                <Text style={styles.examplePrefix}>{translations.dictionaryScreen.examplePrefix}</Text> {item.example}
              </Text>
            )}
          </View>

          <View style={styles.wordActions}>
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.addToListButton, { backgroundColor: colors.primary + '15' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedWordForList(item);
                }}
              >
                <MaterialIcons name="playlist-add" size={16} color={colors.primary} />
                <Text style={[styles.addToListButtonText, { color: colors.primary }]}>
                  {translations.wordListModal?.addToList || 'Listeye Ekle'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.detailButton, { backgroundColor: colors.primary + '15' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (openDetailedAsModal) {
                    setSelectedWordForDetail(item.word);
                    setIsDetailedDictionaryModalVisible(true);
                  } else {
                    navigation.navigate('DetailedDictionary', { wordName: item.word });
                  }
                }}
              >
                <MaterialIcons name="info" size={16} color={colors.primary} />
                <Text style={[styles.detailButtonText, { color: colors.primary }]}>
                  Detay
                </Text>
              </TouchableOpacity>
            </View>
            
            {!isModal && (
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
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loading || page === 0) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.text.secondary }]}>
          {translations.dictionaryScreen.loadingMore}
        </Text>
      </View>
    );
  };

  const renderLevelSelector = () => {
    return (
      <View style={styles.levelSelectorContainer}>
        <Text style={[styles.label, { color: colors.text.primary }]}>
          {translations.dictionaryScreen.levelFilter || 'Seviye Filtresi'}
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.levelButtonsContainer}
        >
          <TouchableOpacity
            style={[
              styles.levelButton,
              { 
                backgroundColor: selectedLevel === null ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {
              if (selectedLevel !== null) {
                setSelectedLevel(null);
                // Sayfa durumunu sıfırla ve yeni sorgu yap
                setPage(0);
                // Seçim değiştiğinde doğrudan fetchWords çağırmıyoruz
                // useEffect içinde selectedLevel değiştiğinde otomatik olarak çağrılacak
              }
            }}
          >
            <Text 
              style={[
                styles.levelButtonText, 
                { 
                  color: selectedLevel === null ? colors.text.onPrimary : colors.text.secondary 
                }
              ]}
            >
              {translations.dictionaryScreen.allLevels || 'Tümü'}
            </Text>
          </TouchableOpacity>
          
          {LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.levelButton,
                { 
                  backgroundColor: selectedLevel === level ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                // Aynı seviyeye tekrar tıklandığında seçimi kaldır
                if (selectedLevel === level) {
                  setSelectedLevel(null);
                } else {
                  setSelectedLevel(level);
                }
                // Sayfa durumunu sıfırla ve yeni sorgu yap
                setPage(0);
                // Seçim değiştiğinde doğrudan fetchWords çağırmıyoruz
                // useEffect içinde selectedLevel değiştiğinde otomatik olarak çağrılacak
              }}
            >
              <Text 
                style={[
                  styles.levelButtonText, 
                  { 
                    color: selectedLevel === level ? colors.text.onPrimary : colors.text.secondary 
                  }
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const handleScroll = (event: any) => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.current;
    
    if (Math.abs(scrollDiff) < SCROLL_OFFSET_TRIGGER) {
      return;
    }
    
    if (scrollDiff > 0 && isHeaderVisible && currentScrollY > SCROLL_THRESHOLD) {
      setIsHeaderVisible(false);
      Animated.timing(headerHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (scrollDiff < -SCROLL_OFFSET_TRIGGER && !isHeaderVisible) {
      setIsHeaderVisible(true);
      Animated.timing(headerHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    
    lastScrollY.current = currentScrollY;
  };

  const headerTranslateY = headerHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -200],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && page === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={filteredWords}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.word}-${index}`}
          style={styles.wordList}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingTop: isModal ? 82 : 162, paddingBottom: isModal ? 20 : 84 } 
          ]}
          onEndReached={loadMoreWords}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                {isModal && !searchQuery.trim() 
                  ? translations.dictionaryScreen.searchPrompt || 'Aramak istediğiniz kelimeyi yazın'
                  : translations.dictionaryScreen.noResults || 'Sonuç bulunamadı'}
              </Text>
            </View>
          )}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        />
      )}

      <Animated.View style={[
        styles.headerContainer,
        !isInitialLoad && {
          transform: [{ translateY: headerTranslateY }],
        },
        {
          zIndex: 2,
        },
        {
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
          {!isModal && renderLevelSelector()}

          <View style={styles.searchInputContainer}>
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
              placeholder={translations.dictionaryScreen.searchPlaceholder}
              placeholderTextColor={colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <MaterialIcons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {!isModal && (
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
                {formatString(translations.dictionaryScreen.maxWordsLimit, MAX_WORDS)}
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
                ? translations.dictionaryScreen.selectMinWords
                : formatString(translations.dictionaryScreen.continueWithWords, selectedWords.length)
              }
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <WordListModal
        visible={!!selectedWordForList}
        onClose={() => setSelectedWordForList(null)}
        word={selectedWordForList!}
      />

      {/* Detailed Dictionary Modal */}
      {isDetailedDictionaryModalVisible && selectedWordForDetail && (
        <View style={[styles.detailedDictionaryModal, { backgroundColor: colors.background }]}>
          <View style={[styles.detailedDictionaryModalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity 
              onPress={() => setIsDetailedDictionaryModalVisible(false)}
              style={styles.closeDetailedDictionaryButton}
            >
              <MaterialIcons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.detailedDictionaryModalTitle, { color: colors.text.primary }]}>
              {selectedWordForDetail}
            </Text>
            <View style={{ width: 24 }}>
              <Text> </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <DetailedDictionaryScreen 
              route={{ params: { wordName: selectedWordForDetail } } as any}
              navigation={navigation as any}
              isModal={true}
            />
          </View>
        </View>
      )}
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
  wordList: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  searchInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: '10%',
    padding: 4,
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
    borderWidth: 1,
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
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  addToListButtonText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 3,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  detailButtonText: {
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
    justifyContent: 'center',
  },
  selectButtonText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 3,
  },
  bottomContainer: {
    width: '100%',
    marginTop: 6,
    alignItems: 'center',
    paddingBottom: 4,
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
  footer: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
  },
  levelSelectorContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  levelButtonsContainer: {
    paddingHorizontal: 0,
  },
  levelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  levelButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  detailedDictionaryModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 1000,
  },
  detailedDictionaryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  detailedDictionaryModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeDetailedDictionaryButton: {
    padding: 4,
  },
});

export default DictionaryScreen; 