import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Animated,
  Modal,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { dbService } from '../services/database';
import type { Word } from '../types/words';
import { MaterialIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { APP_CONSTANTS } from '../utils/constants/app';

type Props = NativeStackScreenProps<RootStackParamList, 'WordListDetail'>;

const MIN_WORDS = APP_CONSTANTS.MIN_WORDS;
const MAX_WORDS = APP_CONSTANTS.MAX_WORDS;

// Listede gösterilen her bir öğe: ya tek bir Word (eski davranış), ya da aynı
// `word` alanına sahip birden fazla varyantı (detay ekranından eklenmiş) içeren grup.
// Grup başlığına tıklanınca altında varyantlar genişler.
type DisplayItem =
  | { type: 'single'; word: Word }
  | { type: 'group'; key: string; word: string; variants: Word[] };

export const WordListDetailScreen: React.FC<Props> = ({ route, navigation }): React.ReactElement => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const { listId, listName } = route.params;
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [showMaxWordsMessage, setShowMaxWordsMessage] = useState(false);
  // Modal'da gösterilecek varyant grubunu tutar.
  const [variantModalGroup, setVariantModalGroup] = useState<{ word: string; variants: Word[] } | null>(null);
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
      // Kelime listesi custom tablodan geliyor — meaning/example/variantKey burada özeldir.
      const listWords = await dbService.getWordsFromList(Number(listId));

      // Her satır için ana `words` tablosundan SADECE streak değerini al.
      // Kritik: ana tablodan gelen kaydı olduğu gibi geri döndürmüyoruz çünkü custom
      // satırdaki meaning/example/variantKey farklı olabilir (ör. detay ekranından
      // gelen varyantlar). Sadece streak'i üzerine binecek şekilde birleştiriyoruz.
      const wordsWithStreaks = await Promise.all(
        listWords.map(async (w) => {
          try {
            const streakRow = await dbService.getFirstAsync<{ streak: number }>(
              'SELECT streak FROM words WHERE word = ? AND level = ? AND language_pair = ?',
              [w.word, w.level || 'A1', currentLanguagePair]
            );
            return { ...w, streak: streakRow?.streak ?? 0 };
          } catch (error) {
            console.error('Error getting word streak:', error);
            return { ...w, streak: 0 };
          }
        })
      );

      setWords(wordsWithStreaks);
      setFilteredWords(wordsWithStreaks);
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

  // filteredWords'ten aynı kelimeye ait satırları gruplayarak DisplayItem listesi üret.
  // - Aynı `word` alanına sahip 1 kayıt → single (sade kart)
  // - Aynı `word` alanına sahip 2+ kayıt → group (genişletilebilir başlık)
  // Sıra korunur: gruplar, grubun ilk görüldüğü konumda listelenir — yani mevcut
  // arama/filter sırasına sadık kalınır.
  const groupedItems = useMemo<DisplayItem[]>(() => {
    const buckets = new Map<string, Word[]>();
    const order: string[] = [];

    for (const w of filteredWords) {
      const key = w.word;
      if (!buckets.has(key)) {
        buckets.set(key, []);
        order.push(key);
      }
      buckets.get(key)!.push(w);
    }

    const items: DisplayItem[] = [];
    for (const key of order) {
      const variants = buckets.get(key)!;
      if (variants.length === 1) {
        items.push({ type: 'single', word: variants[0] });
      } else {
        items.push({ type: 'group', key: `group-${key}`, word: key, variants });
      }
    }
    return items;
  }, [filteredWords]);

  const openVariantModal = (group: { word: string; variants: Word[] }) => {
    setVariantModalGroup(group);
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

  const handleRemoveWord = async (item: Word) => {
    try {
      // variantKey tanımlıysa sadece o varyant satırı silinir; aksi halde eski davranış
      // (o kelimenin tüm satırlarını sil) geçerli olur.
      await dbService.removeWordFromList(Number(listId), item.word, item.variantKey);
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
    // Seçim karşılaştırması id üzerinden yapılıyor — aynı kelimenin birden fazla
    // varyantı (detay ekranından gelen farklı örnek/anlam) listede aynı anda
    // farklı satırlar olarak bulunabilir.
    if (selectedWords.some(w => w.id === word.id)) {
      setSelectedWords(selectedWords.filter(w => w.id !== word.id));
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

  // Bir kelime grubunun başlık kartı — varyant sayısını göstererek kullanıcıya
  // "bu kelimenin alt satırları var" ipucunu verir. Tıklanınca altındaki varyantlar
  // genişler/kapanır. Grup başlığı seçilemez (seçim sadece yaprak varyant kartlarında).
  const renderGroupHeader = (group: { key: string; word: string; variants: Word[] }) => {
    const firstVariant = group.variants[0];
    const maxStreak = group.variants.reduce((max, v) => Math.max(max, v.streak || 0), 0);
    const hasHighStreak = maxStreak >= APP_CONSTANTS.STREAK_THRESHOLD;
    const variantCountText = (translations.wordListDetail?.variantsCount || '{0} farklı anlam')
      .replace('{0}', String(group.variants.length));

    return (
      <TouchableOpacity
        style={styles.wordItemContainer}
        activeOpacity={0.8}
        onPress={() => openVariantModal({ word: group.word, variants: group.variants })}
      >
        <View style={[
          styles.wordItem,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}>
          <View style={styles.levelTagContainer}>
            <Text style={[styles.levelTag, {
              backgroundColor: colors.primary + '20',
              color: colors.primary,
            }]}>
              {firstVariant.level}
            </Text>
            {hasHighStreak && (
              <View style={[styles.streakIconContainer, { backgroundColor: colors.success + '20' }]}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
              </View>
            )}
          </View>

          <View style={styles.wordMain}>
            <View style={styles.wordWithSpeech}>
              <Text style={[styles.wordText, { color: colors.text.primary }]}>{group.word}</Text>
              <TouchableOpacity
                style={styles.speakButton}
                onPress={(e) => {
                  e.stopPropagation();
                  speakText(group.word);
                }}
              >
                <MaterialIcons name="volume-up" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.variantBadgeRow}>
              <View style={[styles.variantBadge, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="style" size={14} color={colors.primary} />
                <Text style={[styles.variantBadgeText, { color: colors.primary }]}>
                  {variantCountText}
                </Text>
              </View>
            </View>
            <Text style={[styles.meaningText, { color: colors.text.secondary }]} numberOfLines={1}>
              {firstVariant.meaning}
            </Text>
          </View>

          <View style={styles.groupChevron}>
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={colors.text.secondary}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // FlatList'teki her öğe için branch: tek satır normal kart; grup ise başlık
  // + (açıksa) altında içeriden padding'li varyant kartları.
  const renderDisplayItem = ({ item }: { item: DisplayItem }) => {
    if (item.type === 'single') {
      return renderWordItem({ item: item.word });
    }
    return renderGroupHeader(item);
  };

  const renderWordItem = ({ item }: { item: Word }) => {
    const isSelected = selectedWords.some(w => w.id === item.id);
    const hasHighStreak = (item.streak || 0) >= APP_CONSTANTS.STREAK_THRESHOLD;

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
            {hasHighStreak && (
              <View style={[styles.streakIconContainer, { backgroundColor: colors.success + '20' }]}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
              </View>
            )}
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
            {hasHighStreak && (
              <Text style={[styles.streakText, { color: colors.success }]}>
                Streak: {item.streak}
              </Text>
            )}
          </View>

          <View style={styles.wordActions}>
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: colors.error + '15' }]}
              onPress={(e) => {
                e.stopPropagation();
                handleRemoveWord(item);
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
          data={groupedItems}
          renderItem={renderDisplayItem}
          keyExtractor={(item) => item.type === 'single' ? item.word.id : item.key}
          contentContainerStyle={[styles.listContent, { paddingTop: 82, paddingBottom: 84 }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          extraData={selectedWords}
        />
      )}
      {/* Varyant detay modal'ı — aynı kelimeden birden fazla eklendiğinde alt anlamları gösterir */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={variantModalGroup !== null}
        onRequestClose={() => setVariantModalGroup(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVariantModalGroup(null)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.background }]}>
            {variantModalGroup && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleRow}>
                    <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                      {variantModalGroup.word}
                    </Text>
                    <TouchableOpacity
                      style={styles.modalSpeakButton}
                      onPress={() => speakText(variantModalGroup.word)}
                    >
                      <MaterialIcons name="volume-up" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => setVariantModalGroup(null)}
                    style={styles.modalCloseButton}
                  >
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.modalSubtitle, { color: colors.text.secondary }]}>
                  {(translations.wordListDetail?.variantsModalSubtitle || '{0} farklı anlam eklendi')
                    .replace('{0}', String(variantModalGroup.variants.length))}
                </Text>
                <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                  {variantModalGroup.variants.map((variant, index) => {
                    const isSelected = selectedWords.some(w => w.id === variant.id);
                    return (
                      <View
                        key={variant.id}
                        style={[
                          styles.modalVariantCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: isSelected ? colors.primary : colors.border,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                      >
                        <View style={styles.modalVariantIndex}>
                          <Text style={[styles.modalVariantIndexText, { color: colors.primary, backgroundColor: colors.primary + '15' }]}>
                            {index + 1}
                          </Text>
                        </View>
                        <View style={styles.modalVariantBody}>
                          <Text style={[styles.modalVariantMeaning, { color: colors.text.primary }]}>
                            {variant.meaning}
                          </Text>
                          {variant.example && (
                            <Text style={[styles.modalVariantExample, { color: colors.text.secondary }]}>
                              <Text style={styles.examplePrefix}>
                                {translations.dictionaryScreen?.examplePrefix || 'Örnek:'}
                              </Text>{' '}
                              {variant.example}
                            </Text>
                          )}
                        </View>
                        <View style={styles.modalVariantActions}>
                          <TouchableOpacity
                            style={[styles.modalActionButton, { backgroundColor: isSelected ? colors.primary + '15' : 'transparent', borderColor: isSelected ? colors.primary : colors.border }]}
                            onPress={() => handleWordSelect(variant)}
                          >
                            <MaterialIcons name={isSelected ? 'check' : 'add'} size={16} color={isSelected ? colors.primary : colors.text.secondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.modalActionButton, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}
                            onPress={() => {
                              handleRemoveWord(variant);
                              // Silinen varyant sonrası modal'ı güncelle
                              const remaining = variantModalGroup.variants.filter(v => v.id !== variant.id);
                              if (remaining.length <= 1) {
                                setVariantModalGroup(null);
                              } else {
                                setVariantModalGroup({ ...variantModalGroup, variants: remaining });
                              }
                            }}
                          >
                            <MaterialIcons name="remove-circle-outline" size={16} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {selectedWords.length > 0 && (
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
  // Grup başlığındaki varyant badge satırı ve chevron
  variantBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  variantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  variantBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  groupChevron: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -14,
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
  streakIconContainer: {
    position: 'absolute',
    top: 24,
    right: 0,
    zIndex: 2,
    padding: 2,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    fontStyle: 'italic',
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
  // Varyant modal stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalSpeakButton: {
    padding: 4,
    marginLeft: 8,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  modalScrollView: {
    flexGrow: 0,
  },
  modalVariantCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  modalVariantIndex: {
    marginRight: 10,
    marginTop: 2,
  },
  modalVariantIndexText: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  modalVariantBody: {
    flex: 1,
  },
  modalVariantMeaning: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  modalVariantExample: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  modalVariantActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  modalActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 