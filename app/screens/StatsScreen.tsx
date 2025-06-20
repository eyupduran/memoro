import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  Alert,
  TextInput,
  Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { dbService } from '../services/database';
import type { LearnedWord } from '../types/words';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

type LevelTranslationKey = 'beginner' | 'elementary' | 'preIntermediate' | 'upperIntermediate' | 'advanced' | 'proficiency' | 'examPrep';

const LEVELS : { id: string; name: string; translationKey: LevelTranslationKey }[] = [
  { id: 'A1', name: 'A1', translationKey: 'beginner' satisfies LevelTranslationKey },
  { id: 'A2', name: 'A2', translationKey: 'elementary' satisfies LevelTranslationKey },
  { id: 'B1', name: 'B1', translationKey: 'preIntermediate' satisfies LevelTranslationKey },
  { id: 'B2', name: 'B2', translationKey: 'upperIntermediate' satisfies LevelTranslationKey },
  { id: 'C1', name: 'C1', translationKey: 'advanced' satisfies LevelTranslationKey },
  { id: 'C2', name: 'C2', translationKey: 'proficiency' satisfies LevelTranslationKey },
];

const ITEMS_PER_PAGE = 10;

// Tab types
type TabType = 'learnedWords' | 'wordLists';

export const StatsScreen: React.FC<Props> = ({ navigation }): React.ReactElement => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [selectedTab, setSelectedTab] = useState<TabType>('wordLists');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWords, setTotalWords] = useState(0);
  const [selectedWords, setSelectedWords] = useState<LearnedWord[]>([]);
  const [wordLists, setWordLists] = useState<{ id: number; name: string; created_at: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredWords, setFilteredWords] = useState<LearnedWord[]>([]);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const searchInputRef = useRef<TextInput>(null);
  const activeSearchId = useRef(0);
  const [wordListStreaks, setWordListStreaks] = useState<{ [key: number]: boolean }>({});
  
  // Pagination için state'ler
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allWords, setAllWords] = useState<LearnedWord[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [newWordListName, setNewWordListName] = useState('');

  useEffect(() => {
    loadAllWords();
    loadWordLists();
  }, [currentLanguagePair]);
  
  useEffect(() => {
    // Seviye değiştiğinde sayfa numarasını sıfırla ve kelimeleri filtrele
    setPage(0);
    if (allWords.length > 0) {
      applyLevelFilter();
    }
  }, [selectedLevel, allWords]);

  // Add search functionality
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
      filterWords();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedLevel, allWords]);

  // Tüm kelimeleri yükle
  const loadAllWords = async () => {
    try {
      setLoading(true);
      console.log('Loading words for language pair:', currentLanguagePair);
      const loadedWords = await dbService.getLearnedWords(currentLanguagePair);
      console.log('Loaded words:', loadedWords);
      
      // Gelen verilerin yapısını kontrol et ve düzelt
      const formattedWords = loadedWords.map(word => ({
        id: word.word,
        word: word.word,
        meaning: word.meaning,
        example: word.example || '',
        level: word.level,
        learnedAt: word.learnedAt || new Date().toISOString()
      }));
      
      setAllWords(formattedWords);
      setTotalWords(formattedWords.length);
      setWords(formattedWords.slice(0, ITEMS_PER_PAGE));
      setHasMore(formattedWords.length > ITEMS_PER_PAGE);
      
    } catch (error) {
      console.error('Error loading learned words:', error);
      setAllWords([]);
      setWords([]);
    } finally {
      setLoading(false);
    }
  };

  // Kelime listelerini yükle
  const loadWordLists = async () => {
    try {
      setLoadingLists(true);
      const lists = await dbService.getWordLists(currentLanguagePair);
      setWordLists(lists);

      // Her liste için streak durumunu kontrol et
      const streaks: { [key: number]: boolean } = {};
      for (const list of lists) {
        const hasStreak = await dbService.checkWordListStreak(list.id, currentLanguagePair);
        streaks[list.id] = hasStreak;
      }
      setWordListStreaks(streaks);
    } catch (error) {
      console.error('Error loading word lists:', error);
      setWordLists([]);
    } finally {
      setLoadingLists(false);
    }
  };
  
  // Seçilen seviyeye göre kelimeleri filtrele
  const applyLevelFilter = () => {
    console.log('Applying level filter:', selectedLevel, 'allWords length:', allWords.length);
    if (!allWords.length) {
      setWords([]);
      setHasMore(false);
      return;
    }

    const filteredWords = selectedLevel === 'all' 
      ? allWords
      : allWords.filter(word => word.level === selectedLevel);
    
    console.log('Filtered words:', filteredWords.length, 'for level:', selectedLevel);
    
    // İlk sayfayı ayarla
    const firstPageWords = filteredWords.slice(0, ITEMS_PER_PAGE);
    console.log('Setting words:', firstPageWords.length);
    setWords(firstPageWords);
    setHasMore(filteredWords.length > ITEMS_PER_PAGE);
  };
  
  // Daha fazla kelime yükle
  const loadMoreWords = () => {
    if (loading || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    
    try {
      const nextPage = page + 1;
      const start = nextPage * ITEMS_PER_PAGE;
      
      // Seviyeye göre filtrelenmiş tüm kelimeler
      const filteredWords = selectedLevel === 'all'
        ? allWords
        : allWords.filter(word => word.level === selectedLevel);
      
      // Sonraki sayfayı al
      const nextPageWords = filteredWords.slice(start, start + ITEMS_PER_PAGE);
      
      // Kelimeleri ekle
      if (nextPageWords.length > 0) {
        setWords(prev => [...prev, ...nextPageWords]);
        setPage(nextPage);
        setHasMore(start + ITEMS_PER_PAGE < filteredWords.length);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more words:', error);
    } finally {
      setLoadingMore(false);
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
    } else if (selectedWords.length < 5) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleReinforce = () => {
    if (selectedWords.length >= 2 && selectedWords.length <= 5) {
      navigation.navigate('ImageSelection', {
        wordCount: selectedWords.length,
        selectedWords: selectedWords.map(w => ({
          id: w.word,
          word: w.word,
          meaning: w.meaning,
          example: w.example || '',
          level: w.level
        })),
        isReinforcement: true
      });
    }
  };

  const formatString = (template: string, ...args: any[]) => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };
  
  const handleDeleteWord = async (word: string) => {
    try {
      // Kelimeyi veritabanından sil
      const success = await dbService.deleteLearnedWord(word, currentLanguagePair);
      
      if (success) {
        // State'i güncelle
        setAllWords(prevWords => prevWords.filter(w => w.word !== word));
        
        // Başarılı silme mesajı göster
        Alert.alert(
          translations.stats.success || 'Başarılı',
          translations.stats.wordDeletedSuccessfully || 'Kelime başarıyla silindi',
          [{ text: translations.stats.ok || 'Tamam' }]
        );
      } else {
        // Silme başarısız olduğunda hata mesajı göster
        Alert.alert(
          translations.stats.error || 'Hata',
          translations.stats.errorDeletingWord || 'Kelime silinirken bir hata oluştu',
          [{ text: translations.stats.ok || 'Tamam' }]
        );
      }
    } catch (error) {
      console.error('Error deleting word:', error);
      Alert.alert(
        translations.stats.error || 'Hata',
        translations.stats.errorDeletingWord || 'Kelime silinirken bir hata oluştu',
        [{ text: translations.stats.ok || 'Tamam' }]
      );
    }
  };

  const filterWords = () => {
    const searchId = ++activeSearchId.current;
    
    let filtered = allWords;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(word => 
        word.word.toLowerCase().includes(query) || 
        word.meaning.toLowerCase().includes(query)
      );
    }
    
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(word => word.level === selectedLevel);
    }
    
    if (searchId === activeSearchId.current) {
      setFilteredWords(filtered);
      setWords(filtered.slice(0, ITEMS_PER_PAGE));
      setHasMore(filtered.length > ITEMS_PER_PAGE);
    }
  };

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const isScrollingDown = currentScrollY > lastScrollY.current;
    const isScrollingUp = currentScrollY < lastScrollY.current;
    const hasScrolledEnough = Math.abs(currentScrollY - lastScrollY.current) > 20;

    if (hasScrolledEnough) {
      Animated.timing(headerTranslateY, {
        toValue: isScrollingDown ? -200 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setIsHeaderVisible(!isScrollingDown);
    }

    lastScrollY.current = currentScrollY;
  };

  // Kelime kartını render et
  const renderWordItem = ({ item }: { item: LearnedWord }) => {
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

          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.error + '15' }]}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert(
                translations.stats.deleteWordTitle || 'Kelimeyi Sil',
                translations.stats.deleteWordMessage || 'Bu kelimeyi silmek istediğinizden emin misiniz?',
                [
                  {
                    text: translations.stats.deleteWordCancel || 'İptal',
                    style: 'cancel'
                  },
                  {
                    text: translations.stats.deleteWordConfirm || 'Evet, Sil',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await handleDeleteWord(item.word);
                      } catch (error) {
                        console.error('Error deleting word:', error);
                      }
                    }
                  }
                ]
              );
            }}
          >
            <MaterialIcons name="delete-outline" size={16} color={colors.error} />
          </TouchableOpacity>
          
          <View style={styles.wordMain}>
            <View style={styles.wordWithSpeech}>
              <Text style={[styles.wordText, { color: colors.text.primary }]}>{item.word}</Text>
              <TouchableOpacity 
                style={styles.speakButton}
                onPress={(e) => {
                  e.stopPropagation();
                  // Add speech functionality if needed
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
              style={[styles.addToListButton, { backgroundColor: colors.primary + '15' }]}
              onPress={(e) => {
                e.stopPropagation();
                // Add to list functionality if needed
              }}
            >
              <MaterialIcons name="playlist-add" size={16} color={colors.primary} />
              <Text style={[styles.addToListButtonText, { color: colors.primary }]}>
                {translations.wordListModal?.addToList || 'Listeye Ekle'}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.rightActions}>
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
        </View>
      </TouchableOpacity>
    );
  };

  // Kelime listesi silme işlemini yönet
  const handleDeleteWordList = (listId: number, listName: string) => {
    Alert.alert(
      translations.wordListModal?.deleteListTitle || 'Listeyi Sil',
      translations.wordListModal?.deleteListMessage || 'Bu listeyi silmek istediğinizden emin misiniz? Listeyle birlikte içindeki tüm kelimeler de silinecektir.',
      [
        {
          text: translations.wordListModal?.deleteListCancel || 'İptal',
          style: 'cancel'
        },
        {
          text: translations.wordListModal?.deleteListConfirm || 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await dbService.deleteWordList(listId);
              
              if (success) {
                // Listeleri yeniden yükle
                loadWordLists();
                // Başarı mesajı göster
                Alert.alert(
                  translations.wordListModal?.success || 'Başarılı',
                  translations.wordListModal?.deleteListSuccess || 'Liste başarıyla silindi'
                );
              } else {
                // Hata mesajı göster
                Alert.alert(
                  translations.wordListModal?.error || 'Hata',
                  translations.wordListModal?.deleteListError || 'Liste silinirken bir hata oluştu'
                );
              }
            } catch (error) {
              console.error('Error deleting word list:', error);
              Alert.alert(
                translations.wordListModal?.error || 'Hata',
                translations.wordListModal?.deleteListError || 'Liste silinirken bir hata oluştu'
              );
            }
          }
        }
      ]
    );
  };

  // Yeni kelime listesi oluştur
  const handleCreateWordList = async () => {
    if (!newWordListName.trim()) {
      Alert.alert(
        translations.wordListModal?.error || 'Hata',
        translations.wordListModal?.emptyListName || 'Liste adı gereklidir',
        [{ text: 'Tamam' }]
      );
      return;
    }

    try {
      const success = await dbService.createWordList(newWordListName.trim(), currentLanguagePair);
      
      if (success) {
        // Input'u temizle
        setNewWordListName('');
        // Listeleri yeniden yükle
        loadWordLists();
        // Başarı mesajı göster
        Alert.alert(
          translations.wordListModal?.success || 'Başarılı',
          translations.wordListModal?.addSuccess || 'Liste başarıyla oluşturuldu'
        );
      } else {
        // Hata mesajı göster
        Alert.alert(
          translations.wordListModal?.error || 'Hata',
          translations.wordListModal?.createError || 'Liste oluşturulurken bir hata oluştu'
        );
      }
    } catch (error) {
      console.error('Error creating word list:', error);
      Alert.alert(
        translations.wordListModal?.error || 'Hata',
        translations.wordListModal?.createError || 'Liste oluşturulurken bir hata oluştu'
      );
    }
  };

  // Kelime listesi kartını render et
  const renderWordListItem = ({ item }: { item: { id: number; name: string; created_at: string } }) => (
    <TouchableOpacity
      style={[
        styles.wordListCard,
        { 
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={() => navigation.navigate('WordListDetail', { listId: item.id.toString(), listName: item.name })}
    >
      <View style={styles.wordListHeader}>
        <View style={styles.wordListInfo}>
          <View style={styles.wordListNameContainer}>
            <Text style={[styles.wordListName, { color: colors.text.primary }]}>
              {item.name}
            </Text>
            {wordListStreaks[item.id] && (
              <MaterialIcons
                name="check-circle"
                size={16}
                color={colors.primary}
                style={styles.streakIcon}
              />
            )}
          </View>
          <Text style={[styles.wordListDate, { color: colors.text.secondary }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
        <View style={styles.wordListActions}>
          <TouchableOpacity
            style={[styles.deleteListButton, { backgroundColor: `${colors.error}15` }]}
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteWordList(item.id, item.name);
            }}
          >
            <MaterialIcons 
              name="delete-outline" 
              size={22} 
              color={colors.error || '#f44336'} 
            />
          </TouchableOpacity>
          <MaterialIcons 
            name="chevron-right" 
            size={24} 
            color={colors.text.secondary}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
  
  // Liste altındaki yükleniyor göstergesini render et
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingMoreText, { color: colors.text.secondary }]}>
        </Text>
      </View>
    );
  };

  // Kelime Listeleri tab içeriği
  const renderWordListsTab = () => {
  return (
      <View style={styles.tabContent}>
        {/* Yeni liste oluşturma bölümü */}
        <View style={[styles.createListContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[
              styles.createListInput,
              { 
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text.primary,
              }
            ]}
            placeholder={translations.wordListModal?.newListPlaceholder || 'Yeni liste adı...'}
            placeholderTextColor={colors.text.secondary}
            value={newWordListName}
            onChangeText={setNewWordListName}
            onSubmitEditing={handleCreateWordList}
          />
          <TouchableOpacity
            style={[
              styles.createListButton,
              { 
                backgroundColor: newWordListName.trim() ? colors.primary : colors.surface,
                borderColor: colors.border,
              }
            ]}
            onPress={handleCreateWordList}
            disabled={!newWordListName.trim()}
          >
            <MaterialIcons 
              name="add" 
              size={20} 
              color={newWordListName.trim() ? colors.text.onPrimary : colors.text.secondary} 
            />
            <Text style={[
              styles.createListButtonText,
              { 
                color: newWordListName.trim() ? colors.text.onPrimary : colors.text.secondary,
              }
            ]}>
              {translations.wordListModal?.create || 'Oluştur'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingLists ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : wordLists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons 
              name="list" 
              size={64} 
              color={colors.text.secondary}
              style={styles.emptyIcon}
            />
            <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
              {translations.wordListModal?.noLists || 'Henüz liste oluşturulmamış'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
              {translations.wordListModal?.noLists ? 'Kelimelerinizi organize etmek için listeler oluşturabilirsiniz' : 'Kelimelerinizi organize etmek için listeler oluşturabilirsiniz'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={wordLists}
            renderItem={renderWordListItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.wordListsGridContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  // Öğrenilen Kelimeler tab içeriği
  const renderLearnedWordsTab = () => {
    return (
      <View style={styles.tabContent}>
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
            <View style={styles.levelScrollWrapper}>
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
                    {translations.stats.levels.all}
                  </Text>
                  <Text
                    style={[
                      styles.levelDescription,
                      { 
                        color: selectedLevel === 'all' ? colors.text.onPrimary : colors.text.secondary,
                      },
                    ]}
                  >
                    {translations.stats.levels.allDescription}
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
                      {translations.stats.levels[level.translationKey]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

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

        <View style={styles.learnedWordsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : words.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons 
                name="school" 
                size={64} 
                color={colors.text.secondary}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                {searchQuery.trim() 
                  ? translations.dictionaryScreen?.noResults || 'Sonuç bulunamadı'
                  : selectedLevel === 'all' 
                    ? translations.stats.noWords?.allLevels || 'Henüz öğrenilen kelime yok'
                    : translations.stats.noWords?.specificLevel || 'Bu seviyede öğrenilen kelime yok'}
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
                {translations.stats.noWords?.subtext || 'Kelime öğrenmeye başlamak için egzersizleri tamamlayın'}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <FlatList
                data={words}
                renderItem={renderWordItem}
                keyExtractor={(item) => item.word}
                style={[styles.wordList, selectedWords.length > 0 && styles.wordListWithButton]}
                contentContainerStyle={{ paddingTop: 162, paddingBottom: selectedWords.length > 0 ? 80 : 0 }}
                showsVerticalScrollIndicator={false}
                onEndReached={loadMoreWords}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              />

              {selectedWords.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.reinforceButton, 
                    { 
                      backgroundColor: selectedWords.length >= 2 ? colors.primary : colors.surface,
                      borderWidth: selectedWords.length < 2 ? 1 : 0,
                      borderColor: selectedWords.length < 2 ? colors.border : undefined,
                    }
                  ]}
                  onPress={handleReinforce}
                  disabled={selectedWords.length < 2}
                >
                  <Text 
                    style={[
                      styles.reinforceButtonText, 
                      { 
                        color: selectedWords.length >= 2 ? colors.text.onPrimary : colors.text.secondary 
                      }
                    ]}
                  >
                    {selectedWords.length < 2 
                      ? translations.dictionaryScreen?.selectMinWords || 'En az 2 kelime seçin'
                      : formatString(translations.stats.reinforcement?.button || '{0} kelimeyi pekiştir', selectedWords.length)
                    }
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Navigation */}
      <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'wordLists' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setSelectedTab('wordLists')}
        >
          <MaterialIcons
            name="list"
            size={24}
            color={selectedTab === 'wordLists' ? colors.primary : colors.text.secondary}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'wordLists' ? colors.primary : colors.text.secondary }
            ]}
          >
            {translations.stats.wordLists || 'Kelime Listeleri'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'learnedWords' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => {
            setSelectedTab('learnedWords');
            // Reset header visibility when switching to learned words tab
            headerTranslateY.setValue(0);
            setIsHeaderVisible(true);
          }}
        >
          <MaterialIcons
            name="school"
            size={24}
            color={selectedTab === 'learnedWords' ? colors.primary : colors.text.secondary}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'learnedWords' ? colors.primary : colors.text.secondary }
            ]}
          >
            {translations.stats.learnedWords || 'Görsel Kelimelerim'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {selectedTab === 'wordLists' ? renderWordListsTab() : renderLearnedWordsTab()}
      </View>

      {/* Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showInfoModal}
        onRequestClose={() => setShowInfoModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowInfoModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <MaterialIcons 
                name="error-outline" 
                size={24} 
                color={colors.primary}
              />
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                {translations.stats.information || 'Bilgilendirme'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowInfoModal(false)}
                style={styles.closeButton}
              >
                <MaterialIcons 
                  name="close" 
                  size={24} 
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalText, { color: colors.text.secondary }]}>
              {translations.stats.reinforcement?.info || 'Pekiştirmek istediğiniz 2-5 kelime seçin'}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabIcon: {
    marginRight: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  levelScrollWrapper: {
    paddingTop: 0,
    paddingBottom: 8,
  },
  levelSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  levelScroll: {
    maxHeight: 50,
    marginBottom: 12,
  },
  levelScrollContent: {
    paddingHorizontal: 0,
  },
  levelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
    minWidth: 100,
  },
  levelName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  levelDescription: {
    fontSize: 10,
  },
  wordListsContainer: {
    paddingHorizontal: 20,
  },
  wordListsGridContainer: {
    padding: 20,
  },
  wordListCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wordListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordListInfo: {
    flex: 1,
  },
  wordListNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordListName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  streakIcon: {
    marginLeft: 4,
  },
  wordListDate: {
    fontSize: 12,
    opacity: 0.5,
  },
  learnedWordsContainer: {
    flex: 1,
  },
  wordList: {
    flex: 1,
    paddingHorizontal: 20,
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
    marginHorizontal: 20,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 14,
    marginLeft: 8,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  infoButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
  closeButton: {
    padding: 4,
  },
  levelSeparator: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    opacity: 0.5,
  },
  wordListActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteListButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: 32,
    right: 8,
    padding: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
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
  wordMain: {
    flex: 1,
    paddingRight: 30,
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
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  addToListButtonText: {
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
  examplePrefix: {
    fontWeight: '500',
    fontStyle: 'normal',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createListContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  createListInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  createListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  createListButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});