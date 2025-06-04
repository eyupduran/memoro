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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { storageService } from '../services/storage';
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

export const StatsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWords, setTotalWords] = useState(0);
  const [selectedWords, setSelectedWords] = useState<LearnedWord[]>([]);
  
  // Pagination için state'ler
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allWords, setAllWords] = useState<LearnedWord[]>([]);

  useEffect(() => {
    loadAllWords();
  }, [currentLanguagePair]);
  
  useEffect(() => {
    // Seviye değiştiğinde sayfa numarasını sıfırla ve kelimeleri filtrele
    setPage(0);
    applyLevelFilter();
  }, [selectedLevel, allWords]);

  // Tüm kelimeleri yükle
  const loadAllWords = async () => {
    try {
      setLoading(true);
      const loadedWords = await storageService.getLearnedWords(currentLanguagePair);
      setAllWords(loadedWords);
      setTotalWords(loadedWords.length);
      applyLevelFilter();
    } catch (error) {
      console.error('Error loading learned words:', error);
      setAllWords([]);
      setWords([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Seçilen seviyeye göre kelimeleri filtrele
  const applyLevelFilter = () => {
    const filteredWords = selectedLevel === 'all' 
      ? allWords
      : allWords.filter(word => word.level === selectedLevel);
    
    // İlk sayfayı ayarla
    const firstPageWords = filteredWords.slice(0, ITEMS_PER_PAGE);
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
          word: w.word,
          meaning: w.meaning,
          example: w.example || ''
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {translations.stats.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          {formatString(translations.stats.totalWords, totalWords)}
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
              ? translations.stats.noWords.allLevels
              : translations.stats.noWords.specificLevel}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
            {translations.stats.noWords.subtext}
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
              {translations.stats.reinforcement.info}
            </Text>
          </View>

          <FlatList
            data={words}
            renderItem={renderWordItem}
            keyExtractor={(item, index) => `${item.word}-${index}`}
            style={[
              styles.wordList, 
              selectedWords.length >= 2 && selectedWords.length <= 5 && styles.wordListWithButton
            ]}
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
                {formatString(translations.stats.reinforcement.button, selectedWords.length)}
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
});