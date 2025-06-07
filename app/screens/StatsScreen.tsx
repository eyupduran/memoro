import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { storageService } from '../services/storage';
import { dbService } from '../services/database';
import type { LearnedWord } from '../types/words';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

type LevelTranslationKey = 'beginner' | 'elementary' | 'preIntermediate' | 'upperIntermediate' | 'advanced' | 'proficiency' | 'examPrep';

const LEVELS = [
  { id: 'A1', name: 'A1', translationKey: 'beginner' as LevelTranslationKey },
  { id: 'A2', name: 'A2', translationKey: 'elementary' as LevelTranslationKey },
  { id: 'B1', name: 'B1', translationKey: 'preIntermediate' as LevelTranslationKey },
  { id: 'B2', name: 'B2', translationKey: 'upperIntermediate' as LevelTranslationKey },
  { id: 'C1', name: 'C1', translationKey: 'advanced' as LevelTranslationKey },
  { id: 'C2', name: 'C2', translationKey: 'proficiency' as LevelTranslationKey },
];

const ITEMS_PER_PAGE = 10;

// Tab types
type TabType = 'learnedWords' | 'wordLists';

export const StatsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [selectedTab, setSelectedTab] = useState<TabType>('learnedWords');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWords, setTotalWords] = useState(0);
  const [selectedWords, setSelectedWords] = useState<LearnedWord[]>([]);
  const [wordLists, setWordLists] = useState<{ id: number; name: string; created_at: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  
  // Pagination için state'ler
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allWords, setAllWords] = useState<LearnedWord[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);

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
        level: word.level || 'A1',
        learnedAt: word.learnedAt || new Date().toISOString()
      }));
      
      console.log('Formatted words:', formattedWords);
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
        level: 'custom',
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
  
  // Kelime kartını render et
  const renderWordItem = ({ item }: { item: LearnedWord }) => {
    const isSelected = selectedWords.some(w => w.word === item.word);
    return (
      <TouchableOpacity
        onPress={() => handleWordSelect(item)}
        style={[
          styles.wordCard,
          { 
            backgroundColor: colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
      >
        <View style={styles.wordHeader}>
          <View style={styles.wordMainContent}>
            <Text style={[styles.wordText, { color: colors.text.primary }]}>
              {item.word}
            </Text>
            <Text style={[styles.meaningText, { color: colors.text.secondary }]}>
              {item.meaning}
            </Text>
          </View>
          <View style={styles.wordMeta}>
            <Text style={[styles.levelTag, { 
              backgroundColor: colors.primary + '20',
              color: colors.primary,
            }]}>
              {item.level.toUpperCase()}
            </Text>
            <Text style={[styles.dateText, { color: colors.text.secondary }]}>
              {formatDate(item.learnedAt)}
            </Text>
          </View>
        </View>
        {item.example && (
          <Text style={[styles.exampleText, { color: colors.text.secondary }]}>
            {item.example}
          </Text>
        )}
      </TouchableOpacity>
    );
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
          <Text style={[styles.wordListName, { color: colors.text.primary }]}>
            {item.name}
          </Text>
          <Text style={[styles.wordListDate, { color: colors.text.secondary }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
        <MaterialIcons 
          name="chevron-right" 
          size={24} 
          color={colors.text.secondary}
        />
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

        <View style={[styles.levelSeparator, { backgroundColor: colors.border }]} />

        <View style={styles.learnedWordsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {translations.stats.learnedWords} ({totalWords})
            </Text>
            <TouchableOpacity
              onPress={() => setShowInfoModal(true)}
              style={styles.infoButton}
            >
              <MaterialIcons 
                name="error-outline" 
                size={24} 
                color={colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

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
                {selectedLevel === 'all' 
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
                style={[styles.wordList, selectedWords.length >= 2 && styles.wordListWithButton]}
                contentContainerStyle={{ paddingBottom: selectedWords.length >= 2 ? 80 : 0 }}
                showsVerticalScrollIndicator={false}
                onEndReached={loadMoreWords}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
              />

              {selectedWords.length >= 2 && selectedWords.length <= 5 && (
                <TouchableOpacity
                  style={[styles.reinforceButton, { backgroundColor: colors.primary }]}
                  onPress={handleReinforce}
                >
                  <Text style={[styles.reinforceButtonText, { color: colors.text.onPrimary }]}>
                    {formatString(translations.stats.reinforcement?.button || '{0} kelimeyi pekiştir', selectedWords.length)}
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
            selectedTab === 'learnedWords' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setSelectedTab('learnedWords')}
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
            {translations.stats.learnedWords || 'Öğrenilen Kelimeler'}
          </Text>
        </TouchableOpacity>
        
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
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {selectedTab === 'learnedWords' ? renderLearnedWordsTab() : renderWordListsTab()}
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
    paddingTop: 12,
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
    paddingHorizontal: 20,
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
  },
  wordListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordListInfo: {
    flex: 1,
    marginRight: 8,
  },
  wordListName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  wordListDate: {
    fontSize: 12,
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
});