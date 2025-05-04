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
import { dbService } from '../services/database';
import type { Word, WordList } from '../types/words';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { DataLoader } from '../components/DataLoader';
import { storageService } from '../services/storage';

type DictionaryScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DictionaryScreen = () => {
  const navigation = useNavigation<DictionaryScreenNavigationProp>();
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [wordCount, setWordCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showDataLoader, setShowDataLoader] = useState(false);
  
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    checkDataAndFetchWords();
  }, []);

  // SQLite'da veri var mı kontrol et, yoksa indirme ekranını göster
  const checkDataAndFetchWords = async () => {
    try {
      const isLoaded = await dbService.isLanguageDataLoaded(currentLanguagePair);
      
      if (!isLoaded) {
        console.log('Dictionary: Veri bulunamadı, indirme başlatılıyor');
        setShowDataLoader(true);
      } else {
        console.log('Dictionary: Veri bulundu, kelimeler yükleniyor');
        // İlk yüklemede fetchWords'ü çağırmıyoruz, aşağıdaki useEffect onu çağıracak
      }
    } catch (error) {
      console.error('Dictionary: Veri kontrolü hatası', error);
    }
  };
  
  // Veri indirme tamamlandı
  const onDataLoadComplete = () => {
    setShowDataLoader(false);
    fetchWords(); // Burada çağrı yapılması sorun değil çünkü indirme sonrasında tek sefer çalışacak
  };

  // Sayfalama ile kelimeleri yükle
  const fetchWords = async () => {
    setLoading(true);
    try {
      let results: Word[];
      
      if (searchQuery.trim()) {
        results = await dbService.searchWords(searchQuery, currentLanguagePair, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      } else {
        results = await dbService.getAllWords(currentLanguagePair, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      }

      console.log(`Dictionary: ${results.length} kelime yüklendi`);
      
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

  // Arama yapıldığında veya sayfa ilk kez yüklendiğinde kelimeleri getir
  useEffect(() => {
    // Sayfa durumunu sıfırla
    setPage(0);
    
    // Kullanıcı bir şeyler yazarken bekleyelim (debounce)
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        // Arama terimine göre ara
        fetchWords();
      } else {
        // Arama terimi yoksa ilk sayfayı göster
        fetchWords();
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentLanguagePair]); // currentLanguagePair ekledik ki dil değiştiğinde tekrar sorgu yapılsın

  // Daha fazla kelime yükle
  const loadMoreWords = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      fetchWords();
    }
  };

  const handleWordSelect = (word: Word) => {
    if (selectedWords.some(w => w.word === word.word)) {
      setSelectedWords(selectedWords.filter(w => w.word !== word.word));
    } else if (selectedWords.length < wordCount) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleContinue = () => {
    if (selectedWords.length === wordCount) {
      // Öğrenilen kelimeleri kaydet
      const now = new Date().toISOString();
      const learnedWords = selectedWords.map(word => ({
        word: word.word,
        meaning: word.meaning,
        example: word.example || '',
        level: word.level || 'custom', // Level yoksa custom kullan
        learnedAt: now
      }));
      
      // Kelimeleri öğrenilmiş olarak kaydet
      storageService.saveLearnedWords(learnedWords);
      
      // Görüntü seçim ekranına git
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
      <View style={styles.wordHeader}>
        <View style={styles.wordMain}>
          <Text style={[styles.wordText, { color: colors.text.primary }]}>{item.word}</Text>
          <Text style={[styles.meaningText, { color: colors.text.secondary }]}>{item.meaning}</Text>
          {item.example && (
            <Text style={[styles.exampleText, { color: colors.text.secondary }]}>
              {translations.dictionaryScreen.examplePrefix} {item.example}
            </Text>
          )}
        </View>
        <View style={styles.wordMeta}>
          <Text style={[styles.levelTag, { 
            backgroundColor: colors.primary + '20',
            color: colors.primary,
          }]}>
            {item.level}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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

  const renderWordCountSelector = () => {
    const counts = [2, 3, 4, 5];
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

      {loading && page === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={filteredWords}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.word}-${index}`}
          style={styles.wordList}
          onEndReached={loadMoreWords}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
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
      
      <DataLoader 
        visible={showDataLoader} 
        onComplete={onDataLoadComplete}
        languagePair={currentLanguagePair}
      />
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
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wordMain: {
    flex: 1,
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
  wordMeta: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  levelTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '600',
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
  footer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  footerText: {
    fontSize: 14,
    marginLeft: 8,
  },
});

export default DictionaryScreen; 