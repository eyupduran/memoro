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

type ExerciseQuestionScreenProps = NativeStackScreenProps<RootStackParamList, 'ExerciseQuestion'>;
type ExerciseQuestionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Soru detayları için tip tanımı
export type QuestionDetail = {
  questionType: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch';
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
};

// Yarım kalan egzersiz için tip tanımı
export type UnfinishedExercise = {
  exerciseType: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'mixed';
  questionIndex: number;
  totalQuestions: number;
  score: number;
  askedWords: string[];
  previousType?: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch';
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
    questionDetails: previousQuestionDetails = [] // Önceki sorular
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
  const [currentQuestionType, setCurrentQuestionType] = useState<'fillInTheBlank' | 'wordMatch' | 'sentenceMatch'>('fillInTheBlank');
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
      
      if (loadedWords.length < 2) { // En az 2 kelime gerekli
        alert(translations.exercise.noWords);
        navigation.replace('Exercise'); // Geri dön
        return;
      }
      
      setWords(loadedWords);
      // Pass the initial askedWords list from params (likely empty for the first question)
      prepareQuestion(loadedWords, askedWordsFromPreviousQuestion || [], previousTypeOfQuestion);
    } catch (error) {
      console.error('Error loading words:', error);
      navigation.replace('Exercise');
    } finally {
      setLoading(false);
    }
  };

  const prepareQuestion = (
    allWords: (LearnedWord | Word)[], 
    sessionAskedWords: string[],
    previousQuestionType?: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch'
  ) => {
    let newSessionAskedWords = [...sessionAskedWords];
    // Kelime listesi modunda sadece liste kelimelerini kullan
    let selectableWords = wordSource === 'wordlist' 
      ? allWords.filter(w => !newSessionAskedWords.includes(w.word))
      : allWords.filter(w => !newSessionAskedWords.includes(w.word));

    if (selectableWords.length === 0 && allWords.length > 0) {
      // All unique words have been asked in this cycle, reset for repetition
      selectableWords = allWords;
      newSessionAskedWords = []; // Reset the list for the next cycle
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
    let finalQuestionType: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch';

    if (exerciseType === 'mixed') {
      let typeChoices: Array<'fillInTheBlank' | 'wordMatch' | 'sentenceMatch'> = [];
      if (question.example && question.example.toLowerCase().includes(question.word.toLowerCase()) && question.example !== question.word) {
        typeChoices.push('fillInTheBlank');
      }
      // Ensure sentenceMatch is only added if there's a valid example sentence.
      if (question.example && question.example.length > 10 && question.example !== question.word) { 
        typeChoices.push('sentenceMatch');
      }
      typeChoices.push('wordMatch'); // wordMatch is always an option

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
      prepareFillInTheBlankQuestion(question, wordSource === 'wordlist' ? allWords : allWords);
    } else if (finalQuestionType === 'sentenceMatch') {
      prepareSentenceMatchQuestion(question, wordSource === 'wordlist' ? allWords : allWords);
    } else { // wordMatch
      prepareWordMatchQuestion(question, wordSource === 'wordlist' ? allWords : allWords);
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
          .filter(w => w.word !== question.word)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(w => w.word);
        
        const allOptions = [actualWordInSentence, ...otherWords].sort(() => Math.random() - 0.5);
        setOptions(allOptions);
      } else {
        // Eğer kelime bulunamazsa, normal işleme devam et
        const regex = new RegExp(`\\b${question.word}\\b`, 'i');
        const parts = question.example.split(regex);
        setSentence(parts);
        setMissingWordIndex(parts.length - 1);
        
        const otherWords = allWords
          .filter(w => w.word !== question.word)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(w => w.word);
        
        const allOptions = [question.word, ...otherWords].sort(() => Math.random() - 0.5);
        setOptions(allOptions);
      }
    } else {
      setSentence(['Fill in the blank: ', '']);
      setMissingWordIndex(1);
      
      const otherWords = allWords
        .filter(w => w.word !== question.word)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.word);
      
      const allOptions = [question.word, ...otherWords].sort(() => Math.random() - 0.5);
      setOptions(allOptions);
    }
  };

  const prepareWordMatchQuestion = (question: LearnedWord | Word, allWords: (LearnedWord | Word)[]) => {
    const otherWords = allWords
      .filter(w => w.word !== question.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const allOptions = [question.meaning, ...otherWords.map(w => w.meaning)]
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
            w.example !== correctAnswerSentence &&
            w.example.length > 10 && // Ensure distractor sentences are also decent
            !w.example.toLowerCase().includes(question.word.toLowerCase()) // Ensure distractor doesn't contain target word
        )
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.example!);

    let allOptions = [correctAnswerSentence, ...otherSentences];
    
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
    } else {
      playWrongSound();
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
      }
      
      const questionDetail: QuestionDetail = {
        questionType: currentQuestionType,
        question: currentQuestionType === 'wordMatch' ? currentQuestion.word : 
                 currentQuestionType === 'sentenceMatch' ? currentQuestion.meaning :
                 currentQuestion.example || '',
        options: options,
        correctAnswer: correctAnswer,
        userAnswer: option,
        isCorrect: correct
      };
      
      // Mevcut soru detaylarına ekle
      const updatedQuestionDetails = [...questionDetails, questionDetail];
      setQuestionDetails(updatedQuestionDetails);
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
        previousType: currentQuestionType,
        wordSource,
        level,
        wordListId,
        wordListName,
        questionDetails: questionDetails // Soru detaylarını bir sonraki soruya aktar
      });
    } else {
      navigation.replace('ExerciseResult', {
        score: currentScore,
        totalQuestions,
        exerciseType,
        wordSource,
        level,
        wordListId,
        wordListName,
        languagePair: currentLanguagePair,
        questionDetails: questionDetails // Soru detaylarını sonuç ekranına aktar
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
          {options.map((option) => {
            // Seçenek doğru cevap mı?
            const isCorrectOption = option === correctAnswer;
            // Yanlış cevap verildiğinde doğru cevabı göster
            const shouldHighlightCorrect = answerShown && !isCorrect && isCorrectOption;
            
            // Daha koyu renkler kullan
            const successColor = '#006E00'; // Daha koyu yeşil
            const errorColor = '#B30000'; // Daha koyu kırmızı
            
            return (
              <TouchableOpacity
                key={option}
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
          {options.map((option) => {
            // Seçenek doğru cevap mı?
            const isCorrectOption = option === correctAnswer;
            // Yanlış cevap verildiğinde doğru cevabı göster
            const shouldHighlightCorrect = answerShown && !isCorrect && isCorrectOption;
            
            return (
              <TouchableOpacity
                key={option}
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
                key={`${option}-${index}`} // Sentences can be long, ensure key is unique
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
            ? successColor + '30' // Daha koyu yeşil arka plan
            : errorColor + '30' // Daha koyu kırmızı arka plan
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
              {translations.exercise.question.correctAnswer}: {correctAnswer}
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
          <DictionaryScreen isModal={true} />
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
           renderWordMatchQuestion() // Fallback
          }
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
});

export default ExerciseQuestionScreen;
