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
} from 'react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { storageService } from '../services/storage';
import { dbService } from '../services/database';
import type { LearnedWord, Word } from '../types/words';

type ExerciseQuestionScreenProps = NativeStackScreenProps<RootStackParamList, 'ExerciseQuestion'>;
type ExerciseQuestionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
    level = null // Varsayılan olarak tüm seviyeler
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
      console.error('Tıklama sesi çalınırken hata:', error);
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

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: translations.exercise.question.screenTitle
    });
  }, [navigation, translations]);

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    setLoading(true);
    try {
      let loadedWords: (LearnedWord | Word)[] = [];

      // Kelime kaynağına göre yükleme yap
      if (wordSource === 'learned') {
        // Öğrenilen kelimeleri yükle
        loadedWords = await storageService.getLearnedWords(currentLanguagePair);
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
    let selectableWords = allWords.filter(w => !newSessionAskedWords.includes(w.word));

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
    // This must be done *before* setAskedWordsForNextQuestion if that state is used in goToNextQuestion directly
    const updatedAskedWordsForSession = [...newSessionAskedWords, question.word];
    setAskedWordsForNextQuestion(updatedAskedWordsForSession); // This state will be used by goToNextQuestion

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
      prepareFillInTheBlankQuestion(question, allWords);
    } else if (finalQuestionType === 'sentenceMatch') {
      prepareSentenceMatchQuestion(question, allWords);
    } else { // wordMatch
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
      const regex = new RegExp(`\\b${question.word}\\b`, 'i');
      const parts = question.example.split(regex);
      setSentence(parts);
      setMissingWordIndex(parts.length - 1);
    } else {
      setSentence(['Fill in the blank: ', '']);
      setMissingWordIndex(1);
    }
    
    const otherWords = allWords
      .filter(w => w.word !== question.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => w.word);
    
    const allOptions = [question.word, ...otherWords].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
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
        correct = option === currentQuestion?.word;
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
  };

  const goToNextQuestion = () => {
    const nextQuestionIndex = questionIndex + 1;
    const currentScore = isCorrect ? score + 1 : score;

    if (nextQuestionIndex < totalQuestions) {
      navigation.replace('ExerciseQuestion', {
        exerciseType,
        questionIndex: nextQuestionIndex,
        totalQuestions,
        score: currentScore,
        askedWords: askedWordsForNextQuestion, // Pass the updated list
        previousType: currentQuestionType,   // Pass the current type as previous for the next
        wordSource, // Kelime kaynağını ilet
        level, // Seviyeyi ilet
      });
    } else {
      navigation.replace('ExerciseResult', {
        score: currentScore,
        totalQuestions,
        languagePair: currentLanguagePair,
        exerciseType, // Ensure exerciseType is passed to results
        wordSource, // Kelime kaynağını ilet
        level, // Seviyeyi ilet
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
            
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  { 
                    backgroundColor: colors.surface,
                    borderColor: shouldHighlightCorrect 
                      ? 'green'
                      : selectedOption === option
                        ? isCorrect
                          ? 'green'
                          : 'red'
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
                    color: shouldHighlightCorrect ? 'green' : colors.text.primary
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
    
    return (
      <View style={styles.questionContainer}>
        <Text style={[styles.questionLabel, { color: colors.text.secondary }]}>
          {translations.exercise.question.wordMatch}
        </Text>
        
        <View style={styles.wordContainer}>
          <Text style={[styles.wordText, { color: colors.text.primary }]}>
            {currentQuestion.word}
          </Text>
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
                      ? 'green'
                      : selectedOption === option
                        ? isCorrect
                          ? 'green'
                          : 'red'
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
                    color: shouldHighlightCorrect ? 'green' : colors.text.primary
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
                      ? 'green'
                      : selectedOption === option
                        ? isCorrect
                          ? 'green'
                          : 'red'
                        : colors.border,
                    borderWidth: (shouldHighlightCorrect || selectedOption === option) ? 2 : 1,
                  },
                ]}
                onPress={() => handleOptionSelect(option)}
                disabled={answerShown}
              >
                <Text style={[
                  styles.optionText, 
                  styles.sentenceOptionText,
                  { 
                    color: shouldHighlightCorrect ? 'green' : colors.text.primary
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
                {formatString(translations.exercise.question.title, questionIndex + 1, totalQuestions)}
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

      {answerShown && (
        <View style={[
          styles.feedbackContainer, 
          { 
            backgroundColor: isCorrect ? 'rgba(0, 128, 0, 0.9)' : 'rgba(255, 0, 0, 0.9)',
            borderTopColor: colors.border,
            borderTopWidth: 1,
          }
        ]}>
          <MaterialIcons 
            name={isCorrect ? 'check-circle' : 'cancel'} 
            size={32} 
            color={'white'} 
          />
          <Text style={[
            styles.feedbackText, 
            { color: 'white' }
          ]}>
            {isCorrect 
              ? translations.exercise.question.correct 
              : translations.exercise.question.incorrect}
          </Text>
          {!isCorrect && currentQuestion && (
            <View style={{alignItems: 'center', marginTop: 8, width: '100%'}}>
              {currentQuestionType === 'fillInTheBlank' && (
                <>
                  <Text style={[styles.correctAnswerText, { color: 'white', fontWeight: 'bold' }]}>
                      {`${translations.exercise.question.correctAnswer.split(':')[0]}: ${currentQuestion.word}`}
                  </Text>
                  <Text style={[styles.correctAnswerText, { color: 'white', marginTop: 4 }]}>
                      {translations.wordList.wordDetail.meaning}: {currentQuestion.meaning}
                  </Text>
                </>
              )}
              {currentQuestionType === 'wordMatch' && (
                <>
                  <Text style={[styles.correctAnswerText, { color: 'white', fontWeight: 'bold' }]}>
                      {`${translations.exercise.question.correctAnswer.split(':')[0]}: ${currentQuestion.meaning}`}
                  </Text>
                  <Text style={[styles.correctAnswerText, { color: 'white', marginTop: 4 }]}>
                      {translations.wordList.wordLabel}: {currentQuestion.word}
                  </Text>
                </>
              )}
              {currentQuestionType === 'sentenceMatch' && currentQuestion.example && (
                <>
                    <Text style={[styles.correctAnswerText, { color: 'white', fontWeight: 'bold', textAlign: 'center'}]}>
                        {translations.exercise.question.correctAnswer.split(':')[0]}:
                    </Text>
                    <Text style={[styles.correctAnswerText, { fontStyle: 'italic', color: 'white', marginTop: 4, textAlign: 'center' }]}>
                        {currentQuestion.example}
                    </Text>
                    <Text style={[styles.correctAnswerText, { color: 'white', marginTop: 8, textAlign: 'center' }]}>
                        ({translations.wordList.wordLabel}: {currentQuestion.word} - {translations.wordList.wordDetail.meaning}: {currentQuestion.meaning})
                    </Text>
                </>
              )}
            </View>
          )}
          
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: 'white' }]}
            onPress={goToNextQuestion}
          >
            <Text style={[styles.nextButtonText, { color: isCorrect ? 'green' : 'red' }]}>
              {questionIndex + 1 < totalQuestions 
                ? translations.exercise.question.next 
                : translations.exercise.question.finish}
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
    padding: 16,
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 30, // Extra padding at the bottom for better appearance
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  correctAnswerText: {
    fontSize: 14,
    marginTop: 4,
    maxWidth: '90%', // Prevent text from going off screen
  },
  nextButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 200,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExerciseQuestionScreen;
