import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { dbService } from '../services/database';
import type { QuestionDetail } from './ExerciseQuestionScreen';

type ExerciseResultScreenProps = NativeStackScreenProps<RootStackParamList, 'ExerciseResult'>;
type ExerciseResultScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get('window');

const ExerciseResultScreen: React.FC = () => {
  const route = useRoute<ExerciseResultScreenProps['route']>();
  const navigation = useNavigation<ExerciseResultScreenNavigationProp>();
  const { colors } = useTheme();
  const { translations } = useLanguage();
  
  const { 
    score, 
    totalQuestions, 
    languagePair, 
    exerciseType = 'mixed',
    wordSource = 'learned', // Varsayılan olarak öğrenilen kelimeler
    level = null, // Varsayılan olarak tüm seviyeler
    wordListId,
    wordListName,
    questionDetails = [] // Soru detayları
  } = route.params;
  
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  
  // Animasyon değerleri
  const scaleAnim = useState(new Animated.Value(0.5))[0]; // useState ile başlatıp sabit referans oluştur
  const opacityAnim = useState(new Animated.Value(0))[0]; // useState ile başlatıp sabit referans oluştur
  
  useEffect(() => {
    // Sonucu veritabanına kaydet
    saveResult();
    
    // Animasyonları başlat
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Başarı durumuna göre ses çal
    playResultSound();
  }, []);
  
  // Sonuç sesini çal
  const playResultSound = async () => {
    try {
      const percentage = (score / totalQuestions) * 100;
      const sound = new Audio.Sound();
      
      if (percentage >= 60) {
        // Başarılı sonuç için success sesini çal
        await sound.loadAsync(require('../../assets/voices/success.mp3'));
      } else {
        // Başarısız sonuç için fail sesini çal
        await sound.loadAsync(require('../../assets/voices/fail.mp3'));
      }
      
      await sound.playAsync();
      
      // Ses çalındıktan sonra temizle
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          await sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Sonuç sesi çalınırken hata:', error);
    }
  };
  
  const saveResult = async () => {
    try {
      // Egzersiz tipini ve kelime kaynağını route parametresinden al
      const resultId = await dbService.saveExerciseResult(
        exerciseType, 
        score, 
        totalQuestions, 
        languagePair,
        wordSource,
        level,
        wordListId,
        wordListName
      );
      
      if (resultId && questionDetails.length > 0) {
        // Egzersiz detaylarını kaydet
        await dbService.saveExerciseDetails(
          resultId,
          questionDetails,
          languagePair
        );
        
        setExerciseId(resultId);
        setDetailsSaved(true);
      }
    } catch (error) {
      console.error('Error saving exercise result:', error);
    }
  };
  
  const formatString = (template: string, ...args: any[]) => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };
  
  const getResultFeedback = () => {
    const percentage = (score / totalQuestions) * 100;
    
    if (percentage === 100) {
      return translations.exercise.result.perfect;
    } else if (percentage >= 80) {
      return translations.exercise.result.great;
    } else if (percentage >= 60) {
      return translations.exercise.result.good;
    } else {
      return translations.exercise.result.needsPractice;
    }
  };
  
  const getResultIcon = () => {
    const percentage = (score / totalQuestions) * 100;
    
    if (percentage === 100) {
      return 'emoji-events';
    } else if (percentage >= 80) {
      return 'star';
    } else if (percentage >= 60) {
      return 'thumb-up';
    } else {
      return 'fitness-center';
    }
  };
  
  const getResultColor = () => {
    const percentage = (score / totalQuestions) * 100;
    
    if (percentage === 100) {
      return '#FFD700'; // Gold
    } else if (percentage >= 80) {
      return '#006E00'; // Daha koyu yeşil (önceki: #4CAF50)
    } else if (percentage >= 60) {
      return '#0057B3'; // Daha koyu mavi (önceki: #2196F3)
    } else {
      return '#CC7000'; // Daha koyu turuncu (önceki: #FF9800)
    }
  };

  const viewExerciseDetails = () => {
    if (!exerciseId) return;
    
    navigation.navigate('ExerciseDetail', {
      exerciseId,
      score,
      totalQuestions,
      exerciseType,
      wordSource,
      wordListName,
      level,
      date: new Date().toISOString(),
      languagePair,
      details: questionDetails
    });
  };
  
  const handleReturnToExercises = () => {
    // Navigation stack'i sıfırla ve LevelSelection ve Exercise ekranlarını ekle
    navigation.reset({
      index: 1,
      routes: [
        { name: 'LevelSelection' },
        { name: 'Exercise' }
      ],
    });
  };

  // Aynı kelimelerle egzersizi tekrarla
  const handleRepeatWithSameWords = () => {
    // Önceki egzersizde kullanılan kelimeleri questionDetails'den çıkar
    // Her soru için doğru cevabı ve soru metnini kullanarak kelime bilgilerini oluştur
    const usedWords = questionDetails.map(detail => {
      // Soru tipine göre kelime bilgilerini çıkar
      if (detail.questionType === 'wordMatch') {
        // wordMatch için soru metni kelime, doğru cevap anlamı
        return {
          word: detail.question,
          meaning: detail.correctAnswer,
          level: level || 'A1',
          // Diğer gerekli alanları varsayılan değerlerle doldur
          example: '',
          pronunciation: '',
          partOfSpeech: 'noun',
          difficulty: 1,
          id: detail.question // Geçici ID olarak kelimeyi kullan
        };
      } else if (detail.questionType === 'fillInTheBlank') {
        // fillInTheBlank için doğru cevabı kelime olarak kullan
        return {
          word: detail.correctAnswer,
          meaning: '', // Bu bilgi mevcut değil
          level: level || 'A1',
          example: detail.question, // Soru metni örnek cümle olabilir
          pronunciation: '',
          partOfSpeech: 'noun',
          difficulty: 1,
          id: detail.correctAnswer
        };
      } else {
        // sentenceMatch için doğru cevabı kelime olarak kullan
        return {
          word: detail.correctAnswer,
          meaning: detail.question, // Soru metni anlam olabilir
          level: level || 'A1',
          example: '',
          pronunciation: '',
          partOfSpeech: 'noun',
          difficulty: 1,
          id: detail.correctAnswer
        };
      }
    });

    // Eğer yeterli kelime varsa, aynı kelimelerle yeni egzersiz başlat
    if (usedWords.length > 0) {
      navigation.navigate('ExerciseQuestion', {
        exerciseType: 'mixed',
        questionIndex: 0,
        totalQuestions: Math.min(usedWords.length, totalQuestions), // Kelime sayısına göre ayarla
        score: 0,
        askedWords: [],
        previousType: undefined,
        wordSource: 'custom', // Özel kelime listesi
        level,
        wordListId: route.params.wordListId,
        customWords: usedWords, // Özel kelime listesi
      });
    }
  };

  // Sadece sonuç bölümünü içeren basit bir bileşen
  const ResultCard = () => (
    <View 
      style={[
        styles.resultCardContainer,
        { 
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <MaterialIcons 
        name={getResultIcon()} 
        size={64} 
        color={getResultColor()} 
        style={styles.resultIcon}
      />
      
      <Text style={[styles.scoreText, { color: colors.text.primary }]}>
        {formatString(translations.exercise.result.score, score, totalQuestions)}
      </Text>
      
      <View style={[styles.scoreBar, { backgroundColor: colors.border }]}>
        <View 
          style={[
            styles.scoreProgress,
            { 
              backgroundColor: getResultColor(),
              width: `${(score / totalQuestions) * 100}%`,
            },
          ]}
        />
      </View>
      
      <Text style={[styles.feedbackText, { color: colors.text.primary }]}>
        {getResultFeedback()}
      </Text>
    </View>
  );
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Normal View ile sonuç bölümünü göster */}
        <ResultCard />
        
        <View style={styles.buttonsContainer}>
          {detailsSaved && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, marginBottom: 12 }]}
              onPress={viewExerciseDetails}
            >
              <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
                {translations.exercise.result.viewDetails || 'Detayları Görüntüle'}
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Aynı kelimelerle tekrarla butonu */}
          {questionDetails.length > 0 && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.secondary || '#6C757D', marginBottom: 12 }]}
              onPress={handleRepeatWithSameWords}
            >
              <Text style={[styles.buttonText, { color: colors.text.onPrimary || '#FFFFFF' }]}>
                {translations.exercise.result.repeatWithSameWords || 'Aynı Kelimelerle Tekrarla'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginBottom: 12 }]}
            onPress={() => navigation.navigate('ExerciseQuestion', {
              exerciseType: 'mixed',
              questionIndex: 0,
              totalQuestions,
              score: 0,
              askedWords: [],
              previousType: undefined,
              wordSource,
              level,
              wordListId: route.params.wordListId,
            })}
          >
            <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
              {translations.exercise.result.tryAgain}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.button,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
            onPress={handleReturnToExercises}
          >
            <Text style={[styles.buttonText, { color: colors.text.primary }]}>
              {translations.exercise.result.backToExercises}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    minHeight: '100%',
  },
  resultCardContainer: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 32,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resultIcon: {
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  scoreBar: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 24,
  },
  scoreProgress: {
    height: '100%',
  },
  feedbackText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonsContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExerciseResultScreen;
