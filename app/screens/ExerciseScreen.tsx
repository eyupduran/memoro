import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { dbService } from '../services/database';
import { storageService } from '../services/storage';
import type { LearnedWord, ExerciseResult, Word, Level } from '../types/words';
import type { UnfinishedExercise } from './ExerciseQuestionScreen';

type ExerciseScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Exercise'>;

// Tıklama sesi için global değişken
let clickSound: Audio.Sound | null = null;

const ExerciseScreen: React.FC = () => {
  const navigation = useNavigation<ExerciseScreenNavigationProp>();
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [learnedWords, setLearnedWords] = useState<LearnedWord[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'exercises' | 'history'>('exercises');
  
  // Yeni state'ler
  const [modalVisible, setModalVisible] = useState(false);
  const [exerciseMode, setExerciseMode] = useState<'learned' | 'dictionary'>('learned');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [dictionaryWordCount, setDictionaryWordCount] = useState(0);
  
  // Pagination için state'ler
  const [historyPage, setHistoryPage] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const ITEMS_PER_PAGE = 10;

  const [wordLists, setWordLists] = useState<{ id: number; name: string }[]>([]);
  const [selectedWordList, setSelectedWordList] = useState<number | null>(null);
  const [wordListModalVisible, setWordListModalVisible] = useState(false);

  const [unfinishedExercises, setUnfinishedExercises] = useState<UnfinishedExercise[]>([]);

  // Tıklama sesini yükle
  useEffect(() => {
    async function loadClickSound() {
      try {
        const sound = new Audio.Sound();
        await sound.loadAsync(require('../../assets/voices/click.mp3'));
        clickSound = sound;
      } catch (error) {
        console.error('Tıklama sesi yüklenirken hata:', error);
      }
    }
    
    loadClickSound();
    
    // Temizleme fonksiyonu
    return () => {
      if (clickSound) {
        clickSound.unloadAsync().catch(error => {
          console.error('Tıklama sesi temizlenirken hata:', error);
        });
      }
    };
  }, []);

  // Tıklama sesini çal
  const playClickSound = async () => {
    try {
      if (clickSound) {
        await clickSound.setPositionAsync(0);
        await clickSound.playAsync();
      }
    } catch (error) {
      // console.error('Tıklama sesi çalınırken hata:', error);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Öğrenilen kelimeleri yükle
      const words = await storageService.getLearnedWords(currentLanguagePair);
      setLearnedWords(words);

      // Egzersiz geçmişini yükle - ilk sayfayı al
      await loadExerciseHistory(0, true);
      
      // Mevcut seviyeleri al
      const result = await dbService.getFirstAsync<{count: number}>(
        'SELECT COUNT(*) as count FROM words WHERE language_pair = ?',
        [currentLanguagePair]
      );
      setDictionaryWordCount(result?.count || 0);
      
      // Mevcut seviyeleri al
      const levels = await dbService.getAllAsync<{level: string}>(
        'SELECT DISTINCT level FROM words WHERE language_pair = ? ORDER BY level',
        [currentLanguagePair]
      );
      setAvailableLevels(levels.map(level => level.level));
      
      // Kelime listelerini yükle
      const lists = await dbService.getWordLists(currentLanguagePair);
      setWordLists(lists);
      
    } catch (error) {
      console.error('Error loading exercise data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentLanguagePair]);

  // Geçmiş egzersizleri sayfalandırma ile yükle
  const loadExerciseHistory = async (page: number, reset: boolean = false) => {
    if (historyLoading) return;
    
    setHistoryLoading(true);
    try {
      const offset = page * ITEMS_PER_PAGE;
      // Detaylarla birlikte egzersiz sonuçlarını al
      const history = await dbService.getExerciseResultsWithDetails(
        currentLanguagePair, 
        ITEMS_PER_PAGE, 
        offset
      );
      
      // Eğer reset parametresi true ise, önceki sayfaları silip sadece bu sayfayı göster
      if (reset) {
        setExerciseHistory(history);
        setHistoryPage(0);
      } else {
        setExerciseHistory(prev => [...prev, ...history]);
      }
      
      // Daha fazla sayfa var mı kontrol et
      setHistoryHasMore(history.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading exercise history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Daha fazla geçmiş egzersiz yükle
  const loadMoreExerciseHistory = () => {
    if (historyHasMore && !historyLoading) {
      const nextPage = historyPage + 1;
      setHistoryPage(nextPage);
      loadExerciseHistory(nextPage);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Ekran her odaklandığında verileri yeniden yükle
      loadData();
      // Yarım kalan egzersizleri kontrol et
      checkUnfinishedExercise();
    });

    // Cleanup fonksiyonu
    return unsubscribe;
  }, [navigation, loadData]);

  useEffect(() => {
    checkUnfinishedExercise();
  }, []);

  const checkUnfinishedExercise = async () => {
    const exercises = await storageService.getUnfinishedExercises(currentLanguagePair);
    setUnfinishedExercises(exercises);
  };

  const continueExercise = async (exercise: UnfinishedExercise) => {
    if (!exercise) return;

    // Egzersizi devam ettir
    navigation.navigate('ExerciseQuestion', {
      exerciseType: exercise.exerciseType,
      questionIndex: exercise.questionIndex,
      totalQuestions: exercise.totalQuestions,
      score: exercise.score,
      askedWords: exercise.askedWords,
      previousType: exercise.previousType,
      wordSource: exercise.wordSource,
      level: exercise.level,
      wordListId: exercise.wordListId,
      wordListName: exercise.wordListName,
      questionDetails: exercise.questionDetails
    });

    // Yarım kalan egzersizi sil
    await storageService.deleteUnfinishedExercise(exercise.timestamp);
    // State'i güncelle
    setUnfinishedExercises(prev => prev.filter(ex => ex.timestamp !== exercise.timestamp));
  };

  const deleteUnfinishedExercise = async (timestamp: number) => {
    Alert.alert(
      translations.exercise.unfinishedExercise.deleteTitle,
      translations.exercise.unfinishedExercise.deleteMessage,
      [
        {
          text: translations.exercise.exitWarning?.cancel || 'İptal',
          style: 'cancel'
        },
        {
          text: translations.exercise.unfinishedExercise.deleteConfirm,
          style: 'destructive',
          onPress: async () => {
            await storageService.deleteUnfinishedExercise(timestamp);
            // State'i güncelle
            setUnfinishedExercises(prev => prev.filter(ex => ex.timestamp !== timestamp));
          }
        }
      ]
    );
  };

  const startNewExercise = (type: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'mixed') => {
    navigation.navigate('ExerciseQuestion', {
      exerciseType: type,
      questionIndex: 0,
      totalQuestions: 10,
      score: 0,
      askedWords: [],
      questionDetails: [],
      wordSource: 'learned', // Default to learned words
      level: null,
      wordListId: 0,
      wordListName: ''
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(currentLanguagePair.startsWith('en-pt') ? 'pt-BR' : 'tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatString = (template: string, ...args: any[]) => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };

  const getExerciseTypeName = (type: string, wordSource?: string, wordListName?: string, level?: string | null) => {
    // Kelime listesi kaynağı
    if (wordSource === 'wordlist' && wordListName) {
      return formatString(translations.exercise.wordListSource || 'Listemden ({0})', wordListName);
    }
    
    // Öğrenilen kelimeler kaynağı
    if (wordSource === 'learned') {
      return translations.exercise.learnedSource || 'Öğrendiklerimden';
    }
    
    // Sözlük kaynağı
    if (wordSource === 'dictionary') {
      // Seviye belirtildiyse
      if (level) {
        return formatString(translations.exercise.dictionaryLevelSource || '{0} Seviye Karışık', level);
      }
      // Tüm seviyeler
      return translations.exercise.dictionaryAllSource || 'Tüm Kelimeler Karışık';
    }
    
    // Egzersiz tipine göre özel başlıklar
    if (type === 'sentenceOrdering') {
      return translations.exercise.exercises.sentenceOrdering || 'Kelime Sıralama';
    }
    
    // Varsayılan olarak sadece egzersiz tipini döndür
    return translations.exercise.exercises[type as keyof typeof translations.exercise.exercises] || type;
  };

  const startExerciseWithLearnedWords = () => {
    // Tıklama sesini çal
    playClickSound();
    
    if (learnedWords.length < 2) {
      // Eğer öğrenilen kelime sayısı 2'den azsa, kullanıcıya bir uyarı göster
      alert(translations.exercise.noWords);
      return;
    }
    
    navigation.navigate('ExerciseQuestion', {
      exerciseType: 'mixed', // Tek bir "mixed" egzersiz tipi
      questionIndex: 0,
      totalQuestions: Math.min(learnedWords.length, 10),
      score: 0,
      askedWords: [], // Initialize askedWords as an empty array
      previousType: undefined, // Initialize previousType as undefined
      wordSource: 'learned',
      level: null,
    });
  };
  
  const openExerciseOptions = () => {
    // Tıklama sesini çal
    playClickSound();
    
    setModalVisible(true);
    // Sözlük kelimelerini seçtiğimizde dictionary modunu ayarla
    setExerciseMode('dictionary');
  };
  
  const startExerciseWithOptions = () => {
    // Tıklama sesini çal
    playClickSound();
    
    setModalVisible(false);
    
    navigation.navigate('ExerciseQuestion', {
      exerciseType: 'mixed',
      questionIndex: 0,
      totalQuestions: 10, // Sabit 10 soru
      score: 0,
      askedWords: [],
      previousType: undefined,
      wordSource: 'dictionary', // Her zaman dictionary kelimelerini kullan
      level: selectedLevel,
    });
  };

  const startExerciseWithWordList = async () => {
    // Tıklama sesini çal
    playClickSound();
    
    if (!selectedWordList) return;
    
    try {
      // Seçilen listenin adını al
      const selectedList = wordLists.find(list => list.id === selectedWordList);
      const wordListName = selectedList ? selectedList.name : '';
      
      const words = await dbService.getWordsFromList(selectedWordList);
      if (words.length < 2) {
        alert(translations.exercise.noWords);
        return;
      }
      
      setWordListModalVisible(false);
      navigation.navigate('ExerciseQuestion', {
        exerciseType: 'mixed',
        questionIndex: 0,
        totalQuestions: Math.min(words.length, 10),
        score: 0,
        askedWords: [],
        previousType: undefined,
        wordSource: 'wordlist',
        wordListId: selectedWordList,
        wordListName: wordListName // Liste adını da gönder
      });
    } catch (error) {
      console.error('Error starting word list exercise:', error);
    }
  };

  const renderExerciseTab = () => {
    return (
      <View style={styles.exercisesContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {translations.exercise.title}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.text.secondary }]}>
          {translations.exercise.subtitle}
        </Text>

        {/* Kelime listeleriyle egzersiz kartı */}
        <TouchableOpacity
          style={[
            styles.exerciseCard,
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}
          onPress={() => setWordListModalVisible(true)}
        >
          <View style={[styles.exerciseIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <MaterialIcons name="format-list-bulleted" size={26} color={colors.primary} />
          </View>
          <View style={styles.exerciseContent}>
            <Text style={[styles.exerciseTitle, { color: colors.text.primary }]}>
              {translations.exercise.wordListExercise}
            </Text>
            <Text style={[styles.exerciseDescription, { color: colors.text.secondary }]}>
              {translations.exercise.wordListExerciseDesc}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.text.secondary} />
        </TouchableOpacity>
        
        {/* Öğrenilen kelimelerle egzersiz kartı */}
        <TouchableOpacity
          style={[
            styles.exerciseCard,
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}
          onPress={() => startExerciseWithLearnedWords()}
        >
          <View style={[styles.exerciseIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <MaterialIcons name="school" size={26} color={colors.primary} />
          </View>
          <View style={styles.exerciseContent}>
            <Text style={[styles.exerciseTitle, { color: colors.text.primary }]}>
              {translations.exercise.learnedWordsExercise}
            </Text>
            <Text style={[styles.exerciseDescription, { color: colors.text.secondary }]}>
              {formatString(translations.exercise.learnedWordsExerciseDesc, learnedWords.length)}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.text.secondary} />
        </TouchableOpacity>
        
        {/* Tüm kelimelerle egzersiz kartı */}
        <TouchableOpacity
          style={[
            styles.exerciseCard,
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}
          onPress={openExerciseOptions}
        >
          <View style={[styles.exerciseIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <MaterialIcons name="library-books" size={26} color={colors.primary} />
          </View>
          <View style={styles.exerciseContent}>
            <Text style={[styles.exerciseTitle, { color: colors.text.primary }]}>
              {translations.exercise.dictionaryExercise}
            </Text>
            <Text style={[styles.exerciseDescription, { color: colors.text.secondary }]}>
              {formatString(translations.exercise.dictionaryExerciseDesc, dictionaryWordCount)}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.text.secondary} />
        </TouchableOpacity>
        
        {learnedWords.length < 2 && dictionaryWordCount < 2 && (
          <View style={styles.warningContainer}>
            <Text style={[styles.warningText, { color: colors.text.secondary }]}>
              {translations.exercise.noWords}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderWordListItem = ({ item }: { item: any }) => {
    const hasDetails = item.details && item.details.length > 0;
    
    // Kelime listesi adını al (eğer varsa)
    let wordListName = '';
    if (item.word_source === 'wordlist' && item.word_list_id) {
      const list = wordLists.find(list => list.id === item.word_list_id);
      if (list) {
        wordListName = list.name;
      }
    }
    
    // Daha koyu renkler için özel bir renk fonksiyonu
    const getScoreColor = (score: number, total: number) => {
      const percentage = (score / total) * 100;
      
      if (percentage === 100) {
        return '#006E00'; // Daha koyu yeşil
      } else if (percentage >= 80) {
        return '#006E00'; // Daha koyu yeşil
      } else if (percentage >= 60) {
        return '#0057B3'; // Daha koyu mavi
      } else {
        return '#CC7000'; // Daha koyu turuncu
      }
    };
    
    return (
      <TouchableOpacity
        style={[
          styles.historyCard,
          { backgroundColor: colors.surface, borderColor: colors.border }
        ]}
        onPress={() => {
          if (hasDetails) {
            navigation.navigate('ExerciseDetail', {
              exerciseId: item.id,
              score: item.score,
              totalQuestions: item.total_questions,
              exerciseType: item.exercise_type,
              wordSource: item.word_source || 'learned',
              wordListName: wordListName,
              level: item.level,
              date: item.date,
              languagePair: item.language_pair,
              details: item.details
            });
          }
        }}
        disabled={!hasDetails}
      >
        <View style={styles.historyHeader}>
          <Text style={[styles.historyTitle, { color: colors.text.primary }]}>
            {getExerciseTypeName(item.exercise_type, item.word_source, wordListName, item.level)}
          </Text>
        </View>
        <View style={styles.historyDetails}>
          <View style={styles.scoreAndDateContainer}>
            <Text style={[styles.historyScore, { color: colors.text.primary }]}>
              {formatString(translations.exercise.historyItem.score, item.score, item.total_questions)}
            </Text>
            <Text style={[styles.historyDate, { color: colors.text.secondary }]}>
              {formatDate(item.date)}
            </Text>
          </View>
          <View
            style={[
              styles.scoreBar,
              { backgroundColor: colors.border }
            ]}
          >
            <View
              style={[
                styles.scoreProgress,
                { 
                  backgroundColor: getScoreColor(item.score, item.total_questions),
                  width: `${(item.score / item.total_questions) * 100}%`
                }
              ]}
            />
          </View>
          
          {hasDetails && (
            <View style={styles.detailsButton}>
              <MaterialIcons name="info" size={16} color={colors.primary} />
              <Text style={[styles.detailsButtonText, { color: colors.primary }]}>
                {translations.exercise.result.viewDetails || 'Detayları Görüntüle'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistoryTab = () => {
    if (exerciseHistory.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="history" size={64} color={colors.text.secondary} />
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            {translations.exercise.egsersizeHistory.empty}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={exerciseHistory}
        keyExtractor={(item) => item.id?.toString() || item.date}
        renderItem={renderWordListItem}
        contentContainerStyle={styles.historyList}
        onEndReached={loadMoreExerciseHistory}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => 
          historyLoading && historyPage > 0 ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingMoreText, { color: colors.text.secondary }]}>
              </Text>
            </View>
          ) : null
        }
      />
    );
  };
  
  const renderExerciseOptionsModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                {translations.exercise.exerciseOptions}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalSectionTitle, { color: colors.text.secondary }]}>
              {translations.exercise.selectLevel}
            </Text>
            
            <ScrollView style={styles.levelSelector}>
              <TouchableOpacity
                style={[
                  styles.levelOption,
                  selectedLevel === null && { backgroundColor: colors.primary + '30' },
                  { borderColor: colors.border }
                ]}
                onPress={() => setSelectedLevel(null)}
              >
                <Text style={[styles.levelText, { color: colors.text.primary }]}>
                  {translations.dictionaryScreen.allLevels}
                </Text>
                {selectedLevel === null && (
                  <MaterialIcons name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
              
              {availableLevels.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.levelOption,
                    selectedLevel === level && { backgroundColor: colors.primary + '30' },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setSelectedLevel(level)}
                >
                  <Text style={[styles.levelText, { color: colors.text.primary }]}>
                    {level}
                  </Text>
                  {selectedLevel === level && (
                    <MaterialIcons name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={startExerciseWithOptions}
            >
              <Text style={[styles.startButtonText, { color: colors.text.onPrimary }]}>
                {translations.exercise.startExercise}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderWordListModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={wordListModalVisible}
        onRequestClose={() => setWordListModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                {translations.exercise.selectWordList || 'Kelime Listesi Seç'}
              </Text>
              <TouchableOpacity onPress={() => setWordListModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.levelSelector}>
              {wordLists.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                  {translations.exercise.noWordLists || 'Henüz kelime listesi oluşturulmamış'}
                </Text>
              ) : (
                wordLists.map((list) => (
                  <TouchableOpacity
                    key={list.id}
                    style={[
                      styles.levelOption,
                      selectedWordList === list.id && { backgroundColor: colors.primary + '30' },
                      { borderColor: colors.border }
                    ]}
                    onPress={() => setSelectedWordList(list.id)}
                  >
                    <Text style={[styles.levelText, { color: colors.text.primary }]}>
                      {list.name}
                    </Text>
                    {selectedWordList === list.id && (
                      <MaterialIcons name="check" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {wordLists.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.startButton,
                  { 
                    backgroundColor: selectedWordList ? colors.primary : colors.border,
                    opacity: selectedWordList ? 1 : 0.5
                  }
                ]}
                onPress={startExerciseWithWordList}
                disabled={!selectedWordList}
              >
                <Text style={[styles.startButtonText, { color: colors.text.onPrimary }]}>
                  {translations.exercise.startExercise || 'Egzersizi Başlat'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          {translations.exercise.subtitle}
        </Text>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'exercises' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('exercises')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.text.secondary },
              activeTab === 'exercises' && { color: colors.primary }
            ]}
          >
            {translations.exercise.title}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'history' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('history')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.text.secondary },
              activeTab === 'history' && { color: colors.primary }
            ]}
          >
            {translations.exercise.egsersizeHistory.title}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'exercises' ? renderExerciseTab() : renderHistoryTab()}
      </View>
      
      {renderExerciseOptionsModal()}
      {renderWordListModal()}

      {unfinishedExercises.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={[styles.unfinishedExerciseHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.unfinishedExerciseHeaderText, { color: colors.text.primary }]}>
              {translations.exercise.unfinishedExercise?.title || 'Tamamlanmayan Egzersizler'}
            </Text>
          </View>
          {unfinishedExercises.length === 1 ? (
            // Tek egzersiz varsa normal bir görünüm kullan
            <TouchableOpacity
              style={[styles.unfinishedExerciseCard, 
                { backgroundColor: colors.primary + '20', marginHorizontal: 16 }]}
              onPress={() => continueExercise(unfinishedExercises[0])}
            >
              <View style={styles.unfinishedExerciseContent}>
                <MaterialIcons name="play-circle-outline" size={24} color={colors.primary} />
                <View style={styles.unfinishedExerciseInfo}>
                  <Text style={[styles.unfinishedExerciseTitle, { color: colors.text.primary }]}>
                    {translations.exercise.continueExercise || 'Egzersize Devam Et'}
                  </Text>
                  <Text style={[styles.unfinishedExerciseDetails, { color: colors.text.secondary }]}>
                    {formatString(translations.exercise.unfinishedExercise?.progress || 'İlerleme: {0}/{1}', 
                      unfinishedExercises[0].score, 
                      unfinishedExercises[0].totalQuestions)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteUnfinishedExerciseButton}
                onPress={() => deleteUnfinishedExercise(unfinishedExercises[0].timestamp)}
              >
                <MaterialIcons name="delete" size={24} color={colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            // Birden fazla egzersiz varsa yatay kaydırılabilir liste kullan
            <FlatList
              horizontal
              data={unfinishedExercises}
              keyExtractor={(item) => item.timestamp.toString()}
              renderItem={({ item: exercise }) => (
                <TouchableOpacity
                  style={[styles.unfinishedExerciseCard, 
                    { backgroundColor: colors.primary + '20', width: Dimensions.get('window').width * 0.8 }]}
                  onPress={() => continueExercise(exercise)}
                >
                  <View style={styles.unfinishedExerciseContent}>
                    <MaterialIcons name="play-circle-outline" size={24} color={colors.primary} />
                    <View style={styles.unfinishedExerciseInfo}>
                      <Text style={[styles.unfinishedExerciseTitle, { color: colors.text.primary }]}>
                        {translations.exercise.continueExercise || 'Egzersize Devam Et'}
                      </Text>
                      <Text style={[styles.unfinishedExerciseDetails, { color: colors.text.secondary }]}>
                        {formatString(translations.exercise.unfinishedExercise?.progress || 'İlerleme: {0}/{1}', 
                          exercise.score, 
                          exercise.totalQuestions)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteUnfinishedExerciseButton}
                    onPress={(e) => {
                      e.stopPropagation(); // Prevent card press
                      deleteUnfinishedExercise(exercise.timestamp);
                    }}
                  >
                    <MaterialIcons name="delete" size={24} color={colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.unfinishedExerciseList}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  exercisesContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  exerciseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  exerciseContent: {
    flex: 1,
    height: 65,
    justifyContent: 'center',
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  exerciseDescription: {
    fontSize: 13,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  historyList: {
    paddingBottom: 20,
  },
  historyCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  historyDate: {
    fontSize: 11,
    textAlign: 'right',
  },
  historyDetails: {
    marginTop: 8,
  },
  scoreAndDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyScore: {
    fontSize: 14,
  },
  scoreBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreProgress: {
    height: '100%',
  },
  warningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  warningText: {
    fontSize: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  levelSelector: {
    maxHeight: 300,
    marginBottom: 20,
  },
  levelOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  levelText: {
    fontSize: 16,
  },
  startButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  speakButton: {
    padding: 4,
    marginLeft: 8,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  detailsButtonText: {
    fontSize: 12,
    marginLeft: 4,
  },
  unfinishedExerciseList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  unfinishedExerciseHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  unfinishedExerciseHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  unfinishedExerciseCard: {
    marginRight: 12, // Kartlar arası boşluk
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unfinishedExerciseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // İçeriğin genişlemesini sağla
  },
  unfinishedExerciseInfo: {
    marginLeft: 12,
    flex: 1, // Metinlerin genişlemesini sağla
  },
  unfinishedExerciseTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  unfinishedExerciseDetails: {
    fontSize: 14,
    marginTop: 4,
  },
  deleteUnfinishedExerciseButton: {
    padding: 8,
    marginLeft: 8,
  }
});

export default ExerciseScreen;
