import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  ScrollView,
  Easing,
  Modal,
  Alert,
  BackHandler,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { storageService } from '../services/storage';
import { dbService } from '../services/database';
import type { LearnedWord, Word, WordSource } from '../types/words';
import DictionaryScreen from './DictionaryScreen';
import { APP_CONSTANTS } from '../utils/constants/app';

type ExerciseQuestionScreenProps = NativeStackScreenProps<RootStackParamList, 'ExerciseQuestion'>;
type ExerciseQuestionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Soru detayları için tip tanımı
export type QuestionDetail = {
  questionType: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'sentenceOrdering';
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
  // Tam kelime bilgileri
  word: string;
  meaning: string;
  example: string;
  level: string;
  pronunciation?: string;
  partOfSpeech?: string;
  difficulty?: number;
  id?: string;
  streak?: number;
};

// Yarım kalan egzersiz için tip tanımı
export type UnfinishedExercise = {
  exerciseType: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'mixed' | 'sentenceOrdering';
  questionIndex: number;
  totalQuestions: number;
  score: number;
  askedWords: string[];
  previousType?: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'sentenceOrdering';
  wordSource?: WordSource;
  level?: string | null;
  wordListId?: number;
  wordListName?: string;
  questionDetails: QuestionDetail[];
  languagePair: string;
  timestamp: number;
}

// Ses nesnelerini tanımla
const sounds = {
  correct: null as Audio.Sound | null,
  wrong: null as Audio.Sound | null,
  click: null as Audio.Sound | null,
};

const ExerciseQuestionScreen: React.FC = () => {
  const route = useRoute<ExerciseQuestionScreenProps['route']>();
  const navigation = useNavigation<ExerciseQuestionScreenNavigationProp>();
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  
  const { 
    exerciseType, 
    questionIndex, 
    totalQuestions, 
    score,
    // Params for smarter question selection
    askedWords: askedWordsFromPreviousQuestion, 
    previousType: previousTypeOfQuestion,
    // Yeni parametreler
    wordSource = 'learned', // Varsayılan olarak öğrenilen kelimeler
    level = null, // Varsayılan olarak tüm seviyeler
    wordListId = 0,
    wordListName = '', // Liste adı
    questionDetails: previousQuestionDetails = [], // Önceki sorular
    customWords = [] // Özel kelime listesi
  } = route.params;
  
  const [words, setWords] = useState<(LearnedWord | Word)[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<LearnedWord | Word | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [answerShown, setAnswerShown] = useState(false);
  const [missingWordIndex, setMissingWordIndex] = useState(-1);
  const [sentence, setSentence] = useState<string[]>([]);
  const [currentQuestionType, setCurrentQuestionType] = useState<'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'sentenceOrdering'>('fillInTheBlank');
  // İlerleme çubuğu animasyonu için ref
  const progressAnimValue = useRef(new Animated.Value(0)).current;
  const progressBlinkAnim = useRef(new Animated.Value(1)).current;
  const progressNextSectionAnim = useRef(new Animated.Value(0)).current;

  // This state will hold the list of words asked in this session, to be passed to the NEXT question
  const [askedWordsForNextQuestion, setAskedWordsForNextQuestion] = useState<string[]>([]);

  const fadeAnim = new Animated.Value(1);
  const slideAnim = new Animated.Value(0);

  const [wordLists, setWordLists] = useState<{ id: number; name: string }[]>([]);
  const [selectedWordList, setSelectedWordList] = useState<number | null>(null);
  const [wordListModalVisible, setWordListModalVisible] = useState(false);

  // Tüm soruları ve cevapları kaydetmek için state
  const [questionDetails, setQuestionDetails] = useState<QuestionDetail[]>([]);

  const [isDictionaryModalVisible, setIsDictionaryModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [orderingOptions, setOrderingOptions] = useState<Array<{ word: string; index: number }>>([]);
  const [orderingSelected, setOrderingSelected] = useState<Array<{ word: string; index: number }>>([]);

  // Önceki sayfadan gelen soru detaylarını yükle
  useEffect(() => {
    // Eğer route.params.questionDetails varsa, bu değeri state'e yükle
    if (previousQuestionDetails.length > 0) {
      setQuestionDetails(previousQuestionDetails);
    }
  }, []);

  // Sesleri yükle
  useEffect(() => {
    async function loadSounds() {
      try {
        // Doğru cevap sesi
        const correctSound = new Audio.Sound();
        await correctSound.loadAsync(require('../../assets/voices/correct.mp3'));
        sounds.correct = correctSound;
        
        // Yanlış cevap sesi
        const wrongSound = new Audio.Sound();
        await wrongSound.loadAsync(require('../../assets/voices/wrong.mp3'));
        sounds.wrong = wrongSound;
        
        // Tıklama sesi
        const clickSound = new Audio.Sound();
        await clickSound.loadAsync(require('../../assets/voices/click.mp3'));
        sounds.click = clickSound;
      } catch (error) {
        console.error('Ses dosyaları yüklenirken hata:', error);
      }
    }
    
    loadSounds();
    
    // Temizleme fonksiyonu
    return () => {
      async function unloadSounds() {
        try {
          if (sounds.correct) await sounds.correct.unloadAsync();
          if (sounds.wrong) await sounds.wrong.unloadAsync();
          if (sounds.click) await sounds.click.unloadAsync();
        } catch (error) {
          console.error('Ses dosyaları temizlenirken hata:', error);
        }
      }
      
      unloadSounds();
    };
  }, []);

  // Tıklama sesini çal
  const playClickSound = async () => {
    try {
      if (sounds.click) {
        await sounds.click.setPositionAsync(0);
        await sounds.click.playAsync();
      }
    } catch (error) {
      // console.error('Tıklama sesi çalınırken hata:', error);
    }
  };
  
  // Doğru cevap sesini çal
  const playCorrectSound = async () => {
    try {
      if (sounds.correct) {
        await sounds.correct.setPositionAsync(0);
        await sounds.correct.playAsync();
      }
    } catch (error) {
      console.error('Doğru cevap sesi çalınırken hata:', error);
    }
  };
  
  // Yanlış cevap sesini çal
  const playWrongSound = async () => {
    try {
      if (sounds.wrong) {
        await sounds.wrong.setPositionAsync(0);
        await sounds.wrong.playAsync();
      }
    } catch (error) {
      console.error('Yanlış cevap sesi çalınırken hata:', error);
    }
  };

  // Geri tuşu için uyarı
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Eğer cevap gösterilmişse veya yükleme durumundaysa, normal geri tuşu davranışını engelleme
        if (answerShown || loading) return false;
        
        // Kullanıcıya egzersizi tamamlamadığı için uyarı göster
        Alert.alert(
          translations.exercise.exitWarning?.title || 'Egzersizden Çıkış',
          translations.exercise.exitWarning?.message || 'Egzersizi tamamlamadınız. Çıkmak istediğinizden emin misiniz?',
          [
            {
              text: translations.exercise.exitWarning?.cancel || 'İptal',
              onPress: () => {},
              style: 'cancel',
            },
            {
              text: translations.exercise.exitWarning?.confirm || 'Çıkış',
              onPress: async () => {
                await saveUnfinishedExercise();
                navigation.goBack();
              },
              style: 'destructive',
            },
          ],
          { cancelable: true }
        );
        
        // Geri tuşunun varsayılan davranışını engelle
        return true;
      };

      // Android geri tuşu için event listener ekle
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      // Navigation header'ındaki geri tuşunu özelleştir
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => onBackPress()}
            style={{ marginLeft: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ),
      });

      return () => {
        // Component unmount olduğunda event listener'ı kaldır
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      };
    }, [navigation, answerShown, loading, translations, questionIndex, score, askedWordsForNextQuestion])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: translations.exercise.question.screenTitle,
      // Geri tuşuna basıldığında özel fonksiyon çalıştır
      headerBackVisible: false, // Varsayılan geri tuşunu gizle
    });
  }, [navigation, translations]);

  useEffect(() => {
    loadWords();
  }, []);

  // Soru yüklendiğinde otomatik okuma için useEffect
  useEffect(() => {
    if (currentQuestion && !loading && currentQuestionType !== 'sentenceMatch') {
      // Soru tipine göre okunacak metni belirle
      if (currentQuestionType === 'wordMatch') {
        // Kelime eşleştirme sorusunda kelimeyi oku
        speakText(currentQuestion.word);
      } else if (currentQuestionType === 'fillInTheBlank' && currentQuestion.example) {
        // Boşluk doldurma sorusunda cümleyi parçalara ayır
        const wordBase = currentQuestion.word.replace(/ed$|ing$|s$/, '');
        const regex = new RegExp(`\\b${wordBase}\\w*\\b`, 'i');
        const parts = currentQuestion.example.split(regex);
        
        // İlk parçayı oku
        if (parts[0]) {
          speakText(parts[0]);
        }

        // Boşluktan sonraki kısmı 1 saniye bekleyip oku
        if (parts[1]) {
          setTimeout(() => {
            speakText(parts[1]);
          }, 1000);
        }
      }
    }
  }, [currentQuestion, currentQuestionType, loading]);

  const loadWords = async () => {
    setLoading(true);
    try {
      let loadedWords: (LearnedWord | Word)[] = [];
      
      // Eğer customWords varsa, bunları kullan
      if (wordSource === 'custom' && customWords.length > 0) {
        loadedWords = customWords.map(word => ({
          ...word,
          streak: word.streak || 0,
          level: word.level || 'A1'
        }));
      } else {
        // Kelime kaynağına göre yükleme yap
        if (wordSource === 'learned') {
          // Öğrenilen kelimeleri yükle
          loadedWords = await storageService.getLearnedWords(currentLanguagePair);
        } else if (wordSource === 'wordlist' && wordListId) {
          // Kelime listesinden kelimeleri yükle
          loadedWords = await dbService.getWordsFromList(wordListId);
        } else {
          // Sözlükteki kelimeleri yükle
          if (level) {
            // Belirli bir seviyedeki kelimeleri yükle
            loadedWords = await dbService.getWords(level, currentLanguagePair);
          } else {
            // Tüm seviyelerdeki kelimeleri yükle (limit 100)
            loadedWords = await dbService.getAllWords(currentLanguagePair, 100);
          }
        }
      }
      
      if (loadedWords.length < 2) { // En az 2 kelime gerekli
        alert(translations.exercise.noWords);
        navigation.replace('Exercise'); // Geri dön
        return;
      }

      // Streak öncelik sistemi sadece wordlist kaynağı için aktif
      if (wordSource === 'wordlist') {
        // Kelimeleri streak değerleriyle birlikte yükle
        const wordsWithStreaks = await Promise.all(
          loadedWords.map(async (word) => {
            try {
              // Get the word with streak from the main words table
              const wordWithStreak = await dbService.getFirstAsync<Word>(
                'SELECT word, meaning, example, level, streak FROM words WHERE word = ? AND level = ? AND language_pair = ?',
                [word.word, word.level || 'A1', currentLanguagePair]
              );
              
              return wordWithStreak || { ...word, streak: 0 };
            } catch (error) {
              console.error('Error getting word streak:', error);
              return { ...word, streak: 0 };
            }
          })
        );

        // Kelimeleri öncelik sırasına göre sırala
        const prioritizedWords = prioritizeWordsByStreak(wordsWithStreaks);
        setWords(prioritizedWords);
        prepareQuestion(prioritizedWords, askedWordsFromPreviousQuestion || [], previousTypeOfQuestion);
      } else {
        // Diğer kaynaklar için normal davranış (custom, learned, dictionary)
        setWords(loadedWords);
        prepareQuestion(loadedWords, askedWordsFromPreviousQuestion || [], previousTypeOfQuestion);
      }
    } catch (error) {
      console.error('Error loading words:', error);
      navigation.replace('Exercise');
    } finally {
      setLoading(false);
    }
  };

  // Kelimeleri streak değerlerine göre öncelik sırasına koy
  const prioritizeWordsByStreak = (words: (LearnedWord | Word)[]): (LearnedWord | Word)[] => {
    // Streak değeri threshold'un altında olan kelimeleri önce al
    const belowThreshold = words.filter(word => (word.streak || 0) < APP_CONSTANTS.STREAK_THRESHOLD);
    const aboveThreshold = words.filter(word => (word.streak || 0) >= APP_CONSTANTS.STREAK_THRESHOLD);
    
    // Threshold'un altındaki kelimeleri karıştır
    const shuffledBelowThreshold = [...belowThreshold].sort(() => Math.random() - 0.5);
    
    // Threshold'un üstündeki kelimeleri karıştır
    const shuffledAboveThreshold = [...aboveThreshold].sort(() => Math.random() - 0.5);
    
    // Önce threshold'un altındaki kelimeleri, sonra üstündekileri ekle
    return [...shuffledBelowThreshold, ...shuffledAboveThreshold];
  };

  const prepareQuestion = (
    allWords: (LearnedWord | Word)[], 
    sessionAskedWords: string[],
    previousQuestionType?: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'sentenceOrdering'
  ) => {
    let newSessionAskedWords = [...sessionAskedWords];
    
    let selectableWords: (LearnedWord | Word)[] = [];

    // Streak öncelik sistemi sadece wordlist kaynağı için aktif
    if (wordSource === 'wordlist') {
      // Kelimeleri streak değerlerine göre kategorize et
      const belowThreshold = allWords.filter(w => 
        !newSessionAskedWords.includes(w.word) && 
        (w.streak || 0) < APP_CONSTANTS.STREAK_THRESHOLD
      );
      const aboveThreshold = allWords.filter(w => 
        !newSessionAskedWords.includes(w.word) && 
        (w.streak || 0) >= APP_CONSTANTS.STREAK_THRESHOLD
      );

      // Öncelik sırası: threshold'un altındaki kelimeler
      if (belowThreshold.length > 0) {
        selectableWords = belowThreshold;
      } else if (aboveThreshold.length > 0) {
        // Eğer threshold'un altında kelime kalmadıysa, üstündekileri kullan
        selectableWords = aboveThreshold;
      } else {
        // Eğer hiç kelime kalmadıysa, tüm kelimeleri yeniden kullan
        selectableWords = allWords.filter(w => !newSessionAskedWords.includes(w.word));
        
        if (selectableWords.length === 0 && allWords.length > 0) {
          // All unique words have been asked in this cycle, reset for repetition
          selectableWords = allWords;
          newSessionAskedWords = []; // Reset the list for the next cycle
        }
      }
    } else {
      // Diğer kaynaklar için normal davranış (custom, learned, dictionary)
      selectableWords = allWords.filter(w => !newSessionAskedWords.includes(w.word));
      
      if (selectableWords.length === 0 && allWords.length > 0) {
        // All unique words have been asked in this cycle, reset for repetition
        selectableWords = allWords;
        newSessionAskedWords = []; // Reset the list for the next cycle
      }
    }
    
    if (selectableWords.length === 0) {
        // Should not happen if allWords has items, but as a safeguard:
        console.error('No selectable words left, navigating back.');
        navigation.replace('Exercise');
        return;
    }

    // Shuffle and pick a question
    const shuffledSelectableWords = [...selectableWords].sort(() => Math.random() - 0.5);
    const question = shuffledSelectableWords[0]; // Pick the first one

    if (!question) {
      console.error('Failed to select a question, navigating back.');
      navigation.replace('Exercise');
      return;
    }

    setCurrentQuestion(question);
    
    // Add the current question to the list for the *next* screen's context
    const updatedAskedWordsForSession = [...newSessionAskedWords, question.word];
    setAskedWordsForNextQuestion(updatedAskedWordsForSession);

    // Determine question type
    let finalQuestionType: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'sentenceOrdering';

    if (exerciseType === 'mixed') {
      let typeChoices: Array<'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'sentenceOrdering'> = [];
      if (question.example && question.example.toLowerCase().includes(question.word.toLowerCase()) && question.example !== question.word) {
        typeChoices.push('fillInTheBlank');
      }
      if (question.example && question.example.length > 10 && question.example !== question.word) { 
        typeChoices.push('sentenceMatch');
        typeChoices.push('sentenceOrdering'); // sentenceOrdering ekle
      }
      typeChoices.push('wordMatch');

      if (previousQuestionType && typeChoices.length > 1) {
        const filteredChoices = typeChoices.filter(t => t !== previousQuestionType);
        if (filteredChoices.length > 0) {
          finalQuestionType = filteredChoices[Math.floor(Math.random() * filteredChoices.length)];
        } else {
          finalQuestionType = typeChoices[Math.floor(Math.random() * typeChoices.length)];
        }
      } else {
        finalQuestionType = typeChoices[Math.floor(Math.random() * typeChoices.length)];
      }
    } else if (exerciseType === 'sentenceOrdering') {
      if (!question.example || question.example.length <= 10 || question.example === question.word) {
        finalQuestionType = 'wordMatch';
      } else {
        finalQuestionType = 'sentenceOrdering';
      }
    } else {
      // For specific exercise types, force that type, but validate if possible
      if (exerciseType === 'sentenceMatch' && (!question.example || question.example.length <= 10 || question.example === question.word)) {
        console.warn("SentenceMatch exercise chosen, but word has no suitable example. Falling back to WordMatch.");
        finalQuestionType = 'wordMatch';
      } else if (exerciseType === 'fillInTheBlank' && (!question.example || !question.example.toLowerCase().includes(question.word.toLowerCase()) || question.example === question.word)) {
        console.warn("FillInTheBlank exercise chosen, but word has no suitable example. Falling back to WordMatch.");
        finalQuestionType = 'wordMatch';
      } else {
        finalQuestionType = exerciseType;
      }
    }
    
    setCurrentQuestionType(finalQuestionType);

    // Prepare question based on the determined type
    if (finalQuestionType === 'fillInTheBlank') {
      prepareFillInTheBlankQuestion(question, allWords);
    } else if (finalQuestionType === 'sentenceMatch') {
      prepareSentenceMatchQuestion(question, allWords);
    } else if (finalQuestionType === 'sentenceOrdering') {
      prepareSentenceOrderingQuestion(question);
    } else {
      prepareWordMatchQuestion(question, allWords);
    }
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const prepareFillInTheBlankQuestion = (question: LearnedWord | Word, allWords: (LearnedWord | Word)[]) => {
    if (question.example && question.example.toLowerCase().includes(question.word.toLowerCase())) {
      // Kelimenin tüm formlarını (geçmiş zamanlı dahil) bulmak için daha esnek bir regex kullan
      // Kelimenin kökünü al ve sonuna opsiyonel karakterler ekle
      const wordBase = question.word.replace(/ed$|ing$|s$/, ''); // Sonundaki -ed, -ing veya -s eklerini kaldır
      const regex = new RegExp(`\\b${wordBase}\\w*\\b`, 'i'); // \w* ile herhangi bir karakter eklenebilir
      const match = question.example.match(regex);
      
      if (match) {
        const actualWordInSentence = match[0]; // Cümlede geçen gerçek kelime formu
        const parts = question.example.split(regex);
        setSentence(parts);
        setMissingWordIndex(parts.length - 1);
        
        // Şıklarda doğru cevap olarak cümlede geçen kelime formunu kullan
        const otherWords = allWords
          .filter(w => w.word !== question.word && w.word && w.word.trim() !== '')
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(w => w.word);
        
        const allOptions = [actualWordInSentence, ...otherWords]
          .filter(word => word && word.trim() !== '') // Boş word değerlerini filtrele
          .sort(() => Math.random() - 0.5);
        setOptions(allOptions);
      } else {
        // Eğer kelime bulunamazsa, normal işleme devam et
        const regex = new RegExp(`\\b${question.word}\\b`, 'i');
        const parts = question.example.split(regex);
        setSentence(parts);
        setMissingWordIndex(parts.length - 1);
        
        const otherWords = allWords
          .filter(w => w.word !== question.word && w.word && w.word.trim() !== '')
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(w => w.word);
        
        const allOptions = [question.word, ...otherWords]
          .filter(word => word && word.trim() !== '') // Boş word değerlerini filtrele
          .sort(() => Math.random() - 0.5);
        setOptions(allOptions);
      }
    } else {
      setSentence(['Fill in the blank: ', '']);
      setMissingWordIndex(1);
      
      const otherWords = allWords
        .filter(w => w.word !== question.word && w.word && w.word.trim() !== '')
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.word);
      
      const allOptions = [question.word, ...otherWords]
        .filter(word => word && word.trim() !== '') // Boş word değerlerini filtrele
        .sort(() => Math.random() - 0.5);
      setOptions(allOptions);
    }
  };

  const prepareWordMatchQuestion = (question: LearnedWord | Word, allWords: (LearnedWord | Word)[]) => {
    const otherWords = allWords
      .filter(w => w.word !== question.word && w.meaning && w.meaning.trim() !== '')
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const allOptions = [question.meaning, ...otherWords.map(w => w.meaning)]
      .filter(meaning => meaning && meaning.trim() !== '') // Boş meaning değerlerini filtrele
      .sort(() => Math.random() - 0.5);
    
    setOptions(allOptions);
  };

  const prepareSentenceMatchQuestion = (question: LearnedWord | Word, allWords: (LearnedWord | Word)[]) => {
    if (!question.example) {
        // Fallback to wordMatch if somehow called without an example
        setCurrentQuestionType('wordMatch');
        prepareWordMatchQuestion(question, allWords);
        return;
    }

    const correctAnswerSentence = question.example;
    
    const otherSentences = allWords
        .filter(w => 
            w.word !== question.word && 
            w.example && 
            w.example.trim() !== '' &&
            w.example !== correctAnswerSentence &&
            w.example.length > 10 && // Ensure distractor sentences are also decent
            !w.example.toLowerCase().includes(question.word.toLowerCase()) // Ensure distractor doesn't contain target word
        )
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.example!);

    let allOptions = [correctAnswerSentence, ...otherSentences]
        .filter(example => example && example.trim() !== ''); // Boş example değerlerini filtrele

    // If not enough options (e.g. less than 2), fallback to wordMatch for this question
    if (allOptions.length < 2) {
        console.warn("Not enough distinct example sentences for SentenceMatch, falling back to WordMatch for this question.");
        setCurrentQuestionType('wordMatch');
        prepareWordMatchQuestion(question, allWords);
        return;
    }
    // Ensure we have at most 4 options
    if (allOptions.length > 4) {
        allOptions = allOptions.slice(0,4);
    }


    setOptions(allOptions.sort(() => Math.random() - 0.5));
  };

  const prepareSentenceOrderingQuestion = (question: LearnedWord | Word) => {
    if (!question.example) {
      setOrderingOptions([]);
      setOrderingSelected([]);
      return;
    }
    let words = question.example.trim().split(/\s+/);
    // İlk kelimenin baş harfini küçült
    if (words.length > 0) {
      words[0] = words[0].charAt(0).toLocaleLowerCase() + words[0].slice(1);
    }
    // Son kelimenin sonundaki noktalama işaretini kaldır
    if (words.length > 0) {
      words[words.length - 1] = words[words.length - 1].replace(/[.!?]+$/, '');
    }
    // Her kelimeye bir indeks ekle
    const wordsWithIndices = words.map((word, index) => ({ word, index }));
    const shuffled = [...wordsWithIndices].sort(() => Math.random() - 0.5);
    setOrderingOptions(shuffled);
    setOrderingSelected([]);
  };

  // İlerleme çubuğu animasyonunu başlat
  useEffect(() => {
    // Sayfa yüklendiğinde, ilerleme çubuğunu mevcut konumuna getir
    Animated.timing(progressAnimValue, {
      toValue: questionIndex / totalQuestions,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [questionIndex, totalQuestions]);
  
  // Cevap seçildiğinde yanıp sönme animasyonu
  useEffect(() => {
    if (answerShown) {
      // Sürekli yanıp sönme animasyonu
      Animated.loop(
        Animated.sequence([
          // Parla
          Animated.timing(progressBlinkAnim, {
            toValue: 0.4,
            duration: 500,
            easing: Easing.linear,
            useNativeDriver: false
          }),
          // Normal
          Animated.timing(progressBlinkAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.linear,
            useNativeDriver: false
          })
        ])
      ).start();
      
      // İlerleme çubuğunu mevcut konumda tut
      progressAnimValue.setValue(questionIndex / totalQuestions);
      
      // Bir sonraki kısım için animasyon değerini ayarla
      progressNextSectionAnim.setValue(1);
    }
  }, [answerShown]);

  const handleOptionSelect = (option: string) => {
    if (answerShown) return;
    if (currentQuestionType === 'sentenceOrdering') return; // sentenceOrdering için farklı handler var
    
    setSelectedOption(option);
    
    let correct = false;
    // No need to check exerciseType here as currentQuestionType determines the logic
    if (currentQuestionType === 'fillInTheBlank') {
        // Kelimenin cümlede geçen formu ile karşılaştır
        const wordBase = currentQuestion?.word.replace(/ed$|ing$|s$/, '');
        const regex = new RegExp(`\\b${wordBase}\\w*\\b`, 'i');
        const match = currentQuestion?.example?.match(regex);
        const actualWordInSentence = match ? match[0] : currentQuestion?.word;
        
        correct = option === actualWordInSentence;
    } else if (currentQuestionType === 'wordMatch') {
        correct = option === currentQuestion?.meaning;
    } else if (currentQuestionType === 'sentenceMatch') {
        correct = option === currentQuestion?.example;
    }
    
    setIsCorrect(correct);
    setAnswerShown(true);
    
    // Doğru/yanlış sesini çal
    if (correct) {
      playCorrectSound();
      // Doğru cevap verildiğinde streak değerini artır (wordlist ve custom için)
      if (currentQuestion && (wordSource === 'wordlist' || wordSource === 'custom')) {
        incrementWordStreak(currentQuestion);
      }
    } else {
      playWrongSound();
      // Yanlış cevap verildiğinde streak değerini azalt (wordlist ve custom için)
      if (currentQuestion && (wordSource === 'wordlist' || wordSource === 'custom')) {
        decrementWordStreak(currentQuestion);
      }
    }

    // Soru tipine göre cevaptan sonra okuma yap
    setTimeout(() => {
      if (currentQuestionType === 'fillInTheBlank' && currentQuestion?.example) {
        // Boşluk doldurma sorularında tüm cümleyi oku
        speakText(currentQuestion.example);
      } else if (currentQuestionType === 'sentenceMatch' && currentQuestion?.example) {
        // Cümle eşleştirme sorularında doğru cevabı oku
        speakText(currentQuestion.example);
      }
    }, 150); // 0.15 saniye bekle
    
    // Soru detaylarını kaydet
    if (currentQuestion) {
      // Doğru cevabı belirle
      let correctAnswer = '';
      if (currentQuestionType === 'fillInTheBlank') {
        const wordBase = currentQuestion.word.replace(/ed$|ing$|s$/, '');
        const regex = new RegExp(`\\b${wordBase}\\w*\\b`, 'i');
        const match = currentQuestion.example?.match(regex);
        correctAnswer = match ? match[0] : currentQuestion.word;
      } else if (currentQuestionType === 'wordMatch') {
        correctAnswer = currentQuestion.meaning;
      } else if (currentQuestionType === 'sentenceMatch') {
        correctAnswer = currentQuestion.example || '';
      } else if (currentQuestionType === 'sentenceOrdering') {
        correctAnswer = currentQuestion.example || '';
      }
      
      const questionDetail: QuestionDetail = {
        questionType: currentQuestionType,
        question: currentQuestionType === 'wordMatch' ? currentQuestion.word : 
                 currentQuestionType === 'sentenceMatch' ? currentQuestion.meaning :
                 currentQuestion.example || '',
        options: options,
        correctAnswer: correctAnswer,
        userAnswer: option,
        isCorrect: correct,
        word: currentQuestion.word,
        meaning: currentQuestion.meaning,
        example: currentQuestion.example || '',
        level: currentQuestion.level || 'A1',
        pronunciation: (currentQuestion as any)?.pronunciation,
        partOfSpeech: (currentQuestion as any)?.partOfSpeech,
        difficulty: (currentQuestion as any)?.difficulty,
        id: currentQuestion.id,
        streak: currentQuestion.streak
      };
      
      // Mevcut soru detaylarına ekle
      const updatedQuestionDetails = [...questionDetails, questionDetail];
      setQuestionDetails(updatedQuestionDetails);
    }
  };

  const handleOrderingSelect = (wordObj: { word: string; index: number }) => {
    if (answerShown) return;
    // Aynı indekse sahip kelime seçilmiş mi diye kontrol et
    if (orderingSelected.some(selected => selected.index === wordObj.index)) return;
    setOrderingSelected([...orderingSelected, wordObj]);
  };

  const handleOrderingRemove = (index: number) => {
    if (answerShown) return;
    setOrderingSelected(orderingSelected.filter((_, i) => i !== index));
  };

  const handleOrderingSubmit = () => {
    if (answerShown || !currentQuestion) return;

    // Normalize both the example sentence and user's answer for comparison
    const normalizeText = (text: string) => {
      return text.trim()
        .toLowerCase()
        .replace(/[.!?]+$/, '') // Remove ending punctuation
        .split(/\s+/) // Split into words
        .join(' '); // Join back with single spaces
    };

    const normalizedExample = normalizeText(currentQuestion.example || '');
    const normalizedAnswer = normalizeText(orderingSelected.map(item => item.word).join(' '));
    
    const correct = normalizedExample === normalizedAnswer;
    setIsCorrect(correct);
    setAnswerShown(true);
    if (correct) {
      playCorrectSound();
      if (currentQuestion && (wordSource === 'wordlist' || wordSource === 'custom')) {
        incrementWordStreak(currentQuestion);
      }
    } else {
      playWrongSound();
      if (currentQuestion && (wordSource === 'wordlist' || wordSource === 'custom')) {
        decrementWordStreak(currentQuestion);
      }
    }
    // Soru detaylarını kaydet (normalize edilmiş versiyonlarla)
    const questionDetail: QuestionDetail = {
      questionType: 'sentenceOrdering',
      question: currentQuestion.meaning,
      options: orderingOptions.map(opt => opt.word),
      correctAnswer: normalizedExample, // Normalize edilmiş doğru cevap
      userAnswer: normalizedAnswer, // Normalize edilmiş kullanıcı cevabı
      isCorrect: correct,
      word: currentQuestion.word,
      meaning: currentQuestion.meaning,
      example: currentQuestion.example || '',
      level: currentQuestion.level || 'A1',
      pronunciation: (currentQuestion as any)?.pronunciation,
      partOfSpeech: (currentQuestion as any)?.partOfSpeech,
      difficulty: (currentQuestion as any)?.difficulty,
      id: currentQuestion.id,
      streak: currentQuestion.streak
    };
    setQuestionDetails([...questionDetails, questionDetail]);
  };

  // Kelime streak değerini artır
  const incrementWordStreak = async (word: LearnedWord | Word) => {
    // Streak artırma sadece wordlist kaynağı için aktif
    if (wordSource !== 'wordlist') return;
    
    try {
      await dbService.incrementWordStreak(word.word, word.level || 'A1', currentLanguagePair);
    } catch (error) {
      console.error('Error incrementing word streak:', error);
    }
  };

  const decrementWordStreak = async (word: LearnedWord | Word) => {
    // Streak azaltma sadece wordlist kaynağı için aktif
    if (wordSource !== 'wordlist') return;
    
    try {
      await dbService.decrementWordStreak(word.word, word.level || 'A1', currentLanguagePair);
    } catch (error) {
      console.error('Error decrementing word streak:', error);
    }
  };

  const goToNextQuestion = () => {
    // Devam eden konuşmayı durdur
    Speech.stop();

    const nextQuestionIndex = questionIndex + 1;
    const currentScore = isCorrect ? score + 1 : score;

    if (nextQuestionIndex < totalQuestions) {
      navigation.replace('ExerciseQuestion', {
        exerciseType,
        questionIndex: nextQuestionIndex,
        totalQuestions,
        score: currentScore,
        askedWords: askedWordsForNextQuestion,
        previousType: currentQuestionType as 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'sentenceOrdering',
        wordSource,
        level,
        wordListId,
        wordListName,
        questionDetails: questionDetails, // Soru detaylarını bir sonraki soruya aktar
        customWords // Özel kelime listesini de geçir
      });
    } else {
      // Sonuç sayfasına geçerken navigation stack'i temizle
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'ExerciseResult',
            params: {
              score: currentScore,
              totalQuestions,
              exerciseType,
              wordSource,
              level,
              wordListId,
              wordListName,
              languagePair: currentLanguagePair,
              questionDetails: questionDetails
            }
          }
        ]
      });
    }
  };

  const formatString = (template: string, ...args: any[]) => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };

  const renderFillInTheBlankQuestion = () => {
    if (!currentQuestion) {
      return (
        <View style={styles.questionContainer}>
          <Text style={[styles.questionLabel, { color: colors.text.secondary }]}>
            {translations.exercise.question.fillInTheBlank}
          </Text>
          <Text style={[styles.sentencePart, { color: colors.text.primary }]}>
            Loading question...
          </Text>
        </View>
      );
    }
    
    // Doğru cevabı belirle
    const correctAnswer = currentQuestion.word;
    
    return (
      <View style={styles.questionContainer}>
        <Text style={[styles.questionLabel, { color: colors.text.secondary }]}>
          {translations.exercise.question.fillInTheBlank}
        </Text>
        
        <View style={styles.sentenceContainer}>
          {sentence.map((part, index) => (
            <React.Fragment key={index}>
              <Text style={[styles.sentencePart, { color: colors.text.primary }]}>
                {part}
              </Text>
              {index === missingWordIndex - 1 && (
                <View style={[styles.blankSpace, { borderBottomColor: colors.primary }]} />
              )}
            </React.Fragment>
          ))}
        </View>
        
        <View style={styles.optionsContainer}>
          {options.map((option, index) => {
            // Seçenek doğru cevap mı?
            const isCorrectOption = option === correctAnswer;
            // Yanlış cevap verildiğinde doğru cevabı göster
            const shouldHighlightCorrect = answerShown && !isCorrect && isCorrectOption;
            
            // Daha koyu renkler kullan
            const successColor = '#006E00'; // Daha koyu yeşil
            const errorColor = '#B30000'; // Daha koyu kırmızı
            
            return (
              <TouchableOpacity
                key={`${option}-${index}`}
                style={[
                  styles.optionButton,
                  { 
                    backgroundColor: colors.surface,
                    borderColor: shouldHighlightCorrect 
                      ? successColor
                      : selectedOption === option
                        ? isCorrect
                          ? successColor
                          : errorColor
                        : colors.border,
                    borderWidth: (shouldHighlightCorrect || selectedOption === option) ? 2 : 1,
                  },
                ]}
                onPress={() => handleOptionSelect(option)}
                disabled={answerShown}
              >
                <View style={styles.optionWithSpeech}>
                  <Text style={[
                    styles.optionText, 
                    { 
                      color: shouldHighlightCorrect ? successColor : 
                            selectedOption === option ? 
                              isCorrect ? successColor : errorColor 
                              : colors.text.primary,
                      flex: 1,
                    }
                  ]}>
                    {option}
                  </Text>
                  <TouchableOpacity 
                    style={styles.speakOptionButton}
                    onPress={() => speakText(option)}
                  >
                    <MaterialIcons name="volume-up" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderWordMatchQuestion = () => {
    if (!currentQuestion) {
      return (
        <View style={styles.questionContainer}>
          <Text style={[styles.questionLabel, { color: colors.text.secondary }]}>
            {translations.exercise.question.wordMatch}
          </Text>
          <Text style={[styles.wordText, { color: colors.text.primary }]}>
            Loading question...
          </Text>
        </View>
      );
    }
    
    // Doğru cevabı belirle
    const correctAnswer = currentQuestion.meaning;
    
    // Daha koyu renkler kullan
    const successColor = '#006E00'; // Daha koyu yeşil
    const errorColor = '#B30000'; // Daha koyu kırmızı
    
    return (
      <View style={styles.questionContainer}>
        <Text style={[styles.questionLabel, { color: colors.text.secondary }]}>
          {translations.exercise.question.wordMatch}
        </Text>
        
        <View style={styles.wordContainer}>
          <View style={styles.wordWithSpeech}>
            <Text style={[styles.wordText, { color: colors.text.primary }]}>
              {currentQuestion.word}
            </Text>
            <TouchableOpacity 
              style={styles.speakButton}
              onPress={() => speakText(currentQuestion.word)}
            >
              <MaterialIcons name="volume-up" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.optionsContainer}>
          {options.map((option, index) => {
            // Seçenek doğru cevap mı?
            const isCorrectOption = option === correctAnswer;
            // Yanlış cevap verildiğinde doğru cevabı göster
            const shouldHighlightCorrect = answerShown && !isCorrect && isCorrectOption;
            
            return (
              <TouchableOpacity
                key={`${option}-${index}`}
                style={[
                  styles.optionButton,
                  { 
                    backgroundColor: colors.surface,
                    borderColor: shouldHighlightCorrect 
                      ? successColor
                      : selectedOption === option
                        ? isCorrect
                          ? successColor
                          : errorColor
                        : colors.border,
                    borderWidth: (shouldHighlightCorrect || selectedOption === option) ? 2 : 1,
                  },
                ]}
                onPress={() => handleOptionSelect(option)}
                disabled={answerShown}
              >
                <Text style={[
                  styles.optionText, 
                  { 
                    color: shouldHighlightCorrect ? successColor : 
                          selectedOption === option ? 
                            isCorrect ? successColor : errorColor 
                            : colors.text.primary
                  }
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSentenceMatchQuestion = () => {
    if (!currentQuestion || !currentQuestion.meaning) {
      return (
        <View style={styles.questionContainer}>
          <Text style={[styles.questionLabel, { color: colors.text.secondary }]}>
            {translations.exercise.question.sentenceMatchQuestionPrompt}
          </Text>
          <Text style={[styles.wordText, { color: colors.text.primary }]}>
            Loading question...
          </Text>
        </View>
      );
    }
    
    // Doğru cevabı belirle
    const correctAnswer = currentQuestion.example;
    
    // Daha koyu renkler kullan
    const successColor = '#006E00'; // Daha koyu yeşil
    const errorColor = '#B30000'; // Daha koyu kırmızı
    
    return (
      <View style={styles.questionContainer}>
        <Text style={[styles.questionLabel, { color: colors.text.secondary, textAlign: 'center', marginBottom: 8 }]}>
          {translations.exercise.question.sentenceMatchQuestionPrompt}
        </Text>
        
        <View style={styles.wordContainer}>
          <Text style={[styles.wordText, { color: colors.text.primary, fontSize: 24, marginBottom: 20, fontStyle: 'italic' }]}>
            {`"${currentQuestion.meaning}"`}
          </Text>
        </View>
        
        <View style={styles.optionsContainer}>
          {options.map((option, index) => {
            // Seçenek doğru cevap mı?
            const isCorrectOption = option === correctAnswer;
            // Yanlış cevap verildiğinde doğru cevabı göster
            const shouldHighlightCorrect = answerShown && !isCorrect && isCorrectOption;
            
            return (
              <TouchableOpacity
                key={`${option}-${index}`}
                style={[
                  styles.optionButton,
                  styles.sentenceOptionButton, // Specific styles for sentence options
                  { 
                    backgroundColor: colors.surface,
                    borderColor: shouldHighlightCorrect 
                      ? successColor
                      : selectedOption === option
                        ? isCorrect
                          ? successColor
                          : errorColor
                        : colors.border,
                    borderWidth: (shouldHighlightCorrect || selectedOption === option) ? 2 : 1,
                  },
                ]}
                onPress={() => handleOptionSelect(option)}
                disabled={answerShown}
              >
                <View style={styles.optionWithSpeech}>
                  <Text style={[
                    styles.optionText, 
                    styles.sentenceOptionText,
                    { 
                      color: shouldHighlightCorrect ? successColor : 
                            selectedOption === option ? 
                              isCorrect ? successColor : errorColor 
                              : colors.text.primary,
                      flex: 1,
                    }
                  ]}>
                    {option}
                  </Text>
                  <TouchableOpacity 
                    style={styles.speakOptionButton}
                    onPress={() => speakText(option)}
                  >
                    <MaterialIcons name="volume-up" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSentenceOrderingQuestion = () => {
    if (!currentQuestion || !currentQuestion.example) {
      return (
        <View style={styles.questionContainer}>
          <Text style={[styles.questionLabel, { color: colors.text.secondary }]}>
            {translations.exercise.question.sentenceOrdering || 'Cümle Sıralama'}
          </Text>
          <Text style={[styles.wordText, { color: colors.text.primary }]}>Loading question...</Text>
        </View>
      );
    }
    return (
      <View style={styles.questionContainer}>
        {/* Başlık */}
        <View style={styles.orderingHeader}>
          <MaterialIcons name="reorder" size={24} color={colors.primary} />
          <View style={styles.orderingHeaderText}>
            <Text style={[styles.orderingTitle, { color: colors.text.primary }]}>
              {translations.exercise.question.sentenceOrdering || 'Cümle Sıralama'}
            </Text>
          </View>
        </View>

        {/* Cevap Alanı */}
        <View style={[styles.orderingAnswerArea, { 
          backgroundColor: colors.surface, 
          borderColor: orderingSelected.length > 0 ? colors.primary : colors.border 
        }]}>
          <View style={styles.orderingAnswerHeader}>
            <MaterialIcons name="edit" size={16} color={colors.text.secondary} />
            <Text style={[styles.orderingAnswerLabel, { color: colors.text.secondary }]}>
              {translations.exercise.question.orderingAnswerLabel} ({orderingSelected.length}/{orderingOptions.length})
            </Text>
          </View>
          <ScrollView 
            style={styles.orderingAnswerScroll} 
            contentContainerStyle={styles.orderingAnswerContent}
            showsVerticalScrollIndicator={false}
            horizontal={false}
          >
            {orderingSelected.length === 0 ? (
              <Text style={[styles.orderingPlaceholder, { color: colors.text.secondary }]}>
                {translations.exercise.question.orderingPlaceholder}
              </Text>
            ) : (
              orderingSelected.map((wordObj, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.selectedWordChip, { 
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary 
                  }]} 
                  onPress={() => handleOrderingRemove(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.selectedWordText, { color: colors.text.onPrimary }]}>
                    {wordObj.word}
                  </Text>
                  <View style={styles.removeIconContainer}>
                    <MaterialIcons name="close" size={14} color={colors.text.onPrimary} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        {/* Kelime Seçenekleri */}
        <View style={styles.orderingOptionsSection}>
          <View style={styles.orderingOptionsHeader}>
            <MaterialIcons name="apps" size={16} color={colors.text.secondary} />
            <Text style={[styles.orderingOptionsLabel, { color: colors.text.secondary }]}>
              {translations.exercise.question.orderingWordsLabel}
            </Text>
          </View>
          <View style={styles.orderingOptionsGrid}>
            {orderingOptions.map((wordObj, idx) => {
              const isSelected = orderingSelected.some(selected => selected.index === wordObj.index);
              return (
                <TouchableOpacity
                  key={`${wordObj.word}-${wordObj.index}`}
                  style={[styles.orderingOptionChip, {
                    backgroundColor: isSelected ? colors.surface + '60' : colors.surface,
                    borderColor: isSelected ? colors.border + '60' : colors.primary,
                    borderWidth: isSelected ? 1 : 2,
                    opacity: isSelected ? 0.4 : 1,
                    shadowColor: isSelected ? 'transparent' : colors.primary,
                  }]}
                  onPress={() => handleOrderingSelect(wordObj)}
                  disabled={isSelected || answerShown}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.orderingOptionText, { 
                    color: isSelected ? colors.text.secondary : colors.primary,
                    fontWeight: isSelected ? '400' : '600'
                  }]}>
                    {wordObj.word}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Kontrol Butonu */}
        <TouchableOpacity 
          style={[styles.orderingSubmitButton, { 
            backgroundColor: orderingSelected.length === orderingOptions.length ? colors.primary : colors.surface,
            borderColor: orderingSelected.length === orderingOptions.length ? colors.primary : colors.border,
            shadowColor: orderingSelected.length === orderingOptions.length ? colors.primary : 'transparent',
          }]} 
          onPress={handleOrderingSubmit} 
          disabled={orderingSelected.length !== orderingOptions.length || answerShown}
          activeOpacity={0.8}
        >
          <MaterialIcons 
            name="check-circle" 
            size={20} 
            color={orderingSelected.length === orderingOptions.length ? colors.text.onPrimary : colors.text.secondary} 
          />
          <Text style={[styles.orderingSubmitText, { 
            color: orderingSelected.length === orderingOptions.length ? colors.text.onPrimary : colors.text.secondary,
            fontWeight: orderingSelected.length === orderingOptions.length ? '600' : '500'
          }]}>
            {translations.exercise.question.check || 'Kontrol Et'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  useEffect(() => {
    const loadWordLists = async () => {
      try {
        const lists = await dbService.getWordLists(currentLanguagePair);
        setWordLists(lists);
      } catch (error) {
        console.error('Error loading word lists:', error);
      }
    };

    loadWordLists();
  }, [currentLanguagePair]);

  const addToWordList = async () => {
    if (!currentQuestion || !selectedWordList) return;

    try {
      await dbService.addWordToList(selectedWordList, {
        id: currentQuestion.word,
        word: currentQuestion.word,
        meaning: currentQuestion.meaning,
        example: currentQuestion.example || '',
        level: currentQuestion.level || 'A1'
      });
      
      // Başarılı mesajı göster
      alert(translations.wordListModal?.addSuccess || 'Kelime listeye eklendi');
    } catch (error) {
      console.error('Error adding word to list:', error);
      alert(translations.wordListModal?.addError || 'Kelime eklenirken bir hata oluştu');
    } finally {
      setWordListModalVisible(false);
      setSelectedWordList(null);
    }
  };

  const renderWordListModal = () => (
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
              {translations.wordListModal?.title || 'Kelime Listesi Seç'}
            </Text>
            <TouchableOpacity onPress={() => setWordListModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listSelector}>
            {wordLists.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                {translations.wordListModal?.noLists}
              </Text>
            ) : (
              wordLists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={[
                    styles.listOption,
                    selectedWordList === list.id && { backgroundColor: colors.primary + '30' },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setSelectedWordList(list.id)}
                >
                  <Text style={[styles.listText, { color: colors.text.primary }]}>
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
                styles.addButton,
                { 
                  backgroundColor: selectedWordList ? colors.primary : colors.border,
                  opacity: selectedWordList ? 1 : 0.5
                }
              ]}
              onPress={addToWordList}
              disabled={!selectedWordList}
            >
              <Text style={[styles.addButtonText, { color: colors.text.onPrimary }]}>
                {translations.wordListModal?.addToList}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderAnswerModal = () => {
    if (isCorrect === null || !answerShown) return null;

    // Doğru cevabı belirle
    let correctAnswer = '';
    if (currentQuestion) {
      if (currentQuestionType === 'fillInTheBlank') {
        // Cümlede geçen gerçek kelime formunu bul
        const wordBase = currentQuestion.word.replace(/ed$|ing$|s$/, '');
        const regex = new RegExp(`\\b${wordBase}\\w*\\b`, 'i');
        const match = currentQuestion.example?.match(regex);
        correctAnswer = match ? match[0] : currentQuestion.word;
      } else if (currentQuestionType === 'wordMatch') {
        correctAnswer = currentQuestion.meaning; // Çevirisi
      } else if (currentQuestionType === 'sentenceMatch') {
        correctAnswer = currentQuestion.example || '';
      } else if (currentQuestionType === 'sentenceOrdering') {
        correctAnswer = currentQuestion.example || '';
      }
    }

    // Daha koyu renkler kullan
    const successColor = '#006E00'; // Daha koyu yeşil
    const errorColor = '#B30000'; // Daha koyu kırmızı

    return (
      <View style={[
        styles.answerModal, 
        { 
          backgroundColor: isCorrect 
            ? successColor + '60' // Daha koyu yeşil arka plan
            : errorColor + '60' // Daha koyu kırmızı arka plan
        }
      ]}>
        <View style={styles.answerContent}>
          <MaterialIcons
            name={isCorrect ? 'check-circle' : 'cancel'}
            size={32}
            color={isCorrect ? successColor : errorColor}
          />
          <Text style={[
            styles.answerText, 
            { 
              color: isCorrect ? successColor : errorColor,
              fontWeight: '600'
            }
          ]}>
            {isCorrect ? translations.exercise.question.correct : translations.exercise.question.incorrect}
          </Text>
          {!isCorrect && currentQuestion && (
            <Text style={[styles.correctAnswer, { color: colors.text.primary }]}>
              {translations.exercise.question.correctAnswer}: {currentQuestionType === 'sentenceOrdering' ? 
                (currentQuestion.example || '').trim().toLowerCase().replace(/[.!?]+$/, '').split(/\s+/).join(' ') : 
                correctAnswer}
            </Text>
          )}
        </View>
        <View style={styles.answerButtons}>
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: colors.primary, width: '50%' }]}
            onPress={goToNextQuestion}
          >
            <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
              {translations.exercise.question.next}
            </Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.text.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    );
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

  const renderDictionaryModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isDictionaryModalVisible}
      onRequestClose={() => setIsDictionaryModalVisible(false)}
    >
      <View style={[styles.modalOverlay]}>
        <View style={[styles.dictionaryModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.dictionaryModalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity 
              onPress={() => setIsDictionaryModalVisible(false)}
              style={styles.closeDictionaryButton}
            >
              <MaterialIcons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.dictionaryModalTitle, { color: colors.text.primary }]}>
              {translations.dictionary?.title || 'Sözlük'}
            </Text>
            <View style={{ width: 24 }}>
              <Text> </Text>
            </View>
          </View>
          <DictionaryScreen 
            isModal={true} 
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            openDetailedAsModal={true}
          />
        </View>
      </View>
    </Modal>
  );

  // Yarım kalan egzersizi kaydet
  const saveUnfinishedExercise = async () => {
    if (questionIndex === 0) return; // İlk sorudaysa kaydetmeye gerek yok
    
    const unfinishedExercise: UnfinishedExercise = {
      exerciseType,
      questionIndex,
      totalQuestions,
      score,
      askedWords: askedWordsForNextQuestion,
      previousType: currentQuestionType,
      wordSource,
      level,
      wordListId,
      wordListName,
      questionDetails,
      languagePair: currentLanguagePair,
      timestamp: Date.now()
    };

    try {
      await storageService.saveUnfinishedExercise(unfinishedExercise);
      // Egzersiz sayfasına geri döndüğünde yarım kalan egzersizi hemen görebilmesi için
      // ExerciseScreen'deki checkUnfinishedExercise fonksiyonu navigation.focus event'inde çağrılacak
    } catch (error) {
      console.error('Error saving unfinished exercise:', error);
    }
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
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.contentContainer, 
          answerShown ? { paddingBottom: 200 } : { paddingBottom: 40 }
        ]}
      >
        <View style={styles.header}>
          <View style={styles.progressContainer}>
            <View style={styles.progressInfo}>
              <Text style={[styles.questionCounter, { color: colors.text.secondary }]}>
                {formatString(translations.exercise.question.title, questionIndex + 1)}
              </Text>
              <Text style={[styles.scoreText, { color: colors.text.primary }]}>
                {formatString(translations.exercise.score, score, questionIndex)}
              </Text>
            </View>
            
            <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
              {/* Tamamlanan kısım */}
              <Animated.View 
                style={[
                  styles.progressBar, 
                  { 
                    backgroundColor: colors.primary,
                    width: progressAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
              
              {/* Yanıp sönen bir sonraki kısım */}
              {answerShown && (
                <Animated.View 
                  style={[
                    styles.progressBarNextSection,
                    {
                      backgroundColor: colors.primary,
                      width: `${100 / totalQuestions}%`,
                      left: `${(questionIndex / totalQuestions) * 100}%`,
                      opacity: progressBlinkAnim
                    }
                  ]}
                />
              )}
            </View>
          </View>
        </View>

        <Animated.View
          style={[
            styles.questionWrapper,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {currentQuestionType === 'fillInTheBlank' ? renderFillInTheBlankQuestion() :
           currentQuestionType === 'wordMatch' ? renderWordMatchQuestion() :
           currentQuestionType === 'sentenceMatch' ? renderSentenceMatchQuestion() :
           currentQuestionType === 'sentenceOrdering' ? renderSentenceOrderingQuestion() :
           renderWordMatchQuestion()}
        </Animated.View>
      </ScrollView>

      {renderAnswerModal()}
      {renderWordListModal()}
      {renderDictionaryModal()}

      {/* Dictionary Button */}
      <TouchableOpacity
        style={[
          styles.dictionaryButton, 
          { 
            backgroundColor: colors.primary,
            bottom: answerShown ? 200 : 20 
          }
        ]}
        onPress={() => setIsDictionaryModalVisible(true)}
      >
        <MaterialIcons name="book" size={24} color={colors.text.onPrimary} />
        <Text style={[styles.dictionaryButtonText, { color: colors.text.onPrimary }]}>
          {translations.dictionary?.title || 'Sözlük'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: '500',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
  },
  progressBarNextSection: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
  },
  questionWrapper: {
    marginBottom: 24,
  },
  questionContainer: {
    width: '100%',
  },
  questionLabel: {
    fontSize: 16,
    marginBottom: 16,
    fontWeight: '500',
  },
  sentenceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 24,
  },
  sentencePart: {
    fontSize: 18,
  },
  blankSpace: {
    width: 80,
    height: 2,
    borderBottomWidth: 2,
    marginHorizontal: 4,
  },
  wordContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  wordText: {
    fontSize: 24,
    fontWeight: '700',
  },
  optionsContainer: {
    width: '100%',
    marginBottom: 10,
  },
  optionButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
  },
  sentenceOptionButton: { // Style for sentence options
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60, // Ensure enough height for sentences
    justifyContent: 'center',
    flexWrap: 'wrap', // Allow text to wrap to multiple lines
    flexDirection: 'row', // Ensure content is properly aligned
    alignItems: 'center', // Center content vertically
  },
  sentenceOptionText: { // Style for sentence text
    fontSize: 14,
    lineHeight: 18, // Better readability for sentences
    textAlign: 'center',
  },
  feedbackContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 8,
  },
  correctAnswerText: {
    fontSize: 14,
    marginTop: 4,
    maxWidth: '90%',
    textAlign: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  answerModal: {
    padding: 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 30,
  },
  answerContent: {
    alignItems: 'center',
  },
  answerText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  correctAnswer: {
    fontSize: 14,
    marginTop: 4,
    maxWidth: '90%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
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
  listSelector: {
    maxHeight: 300,
    marginBottom: 20,
  },
  listOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  listText: {
    fontSize: 16,
  },
  addButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  answerButtons: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  wordWithSpeech: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakButton: {
    padding: 6,
    marginLeft: 4,
  },
  speakSentenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
    padding: 4,
  },
  speakText: {
    fontSize: 14,
    marginLeft: 4,
  },
  optionWithSpeech: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingRight: 8,
  },
  speakOptionButton: {
    padding: 8,
    marginLeft: 4,
  },
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  dictionaryButton: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dictionaryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  dictionaryModalContainer: {
    height: '90%',
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  dictionaryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  dictionaryModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeDictionaryButton: {
    padding: 4,
  },
  selectedWord: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  orderingOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderingOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    margin: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  // Yeni sentence ordering stilleri
  orderingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  orderingHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  orderingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  orderingSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  orderingAnswerArea: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    marginBottom: 20,
    minHeight: 80,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  orderingAnswerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderingAnswerLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderingAnswerScroll: {
    minHeight: 50,
  },
  orderingAnswerContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  orderingPlaceholder: {
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  selectedWordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  selectedWordText: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 6,
  },
  removeIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderingOptionsSection: {
    marginBottom: 20,
  },
  orderingOptionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  orderingOptionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderingOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderingOptionChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    margin: 6,
    minWidth: 60,
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  orderingOptionText: {
    fontSize: 15,
    textAlign: 'center',
  },
  orderingSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 8,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  orderingSubmitText: {
    fontSize: 15,
    marginLeft: 8,
  },
});

export default ExerciseQuestionScreen;
