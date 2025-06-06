import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { dbService } from '../services/database';

type ExerciseResultScreenProps = NativeStackScreenProps<RootStackParamList, 'ExerciseResult'>;
type ExerciseResultScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
  } = route.params;
  
  // Animasyon değerleri
  const scaleAnim = new Animated.Value(0.5);
  const opacityAnim = new Animated.Value(0);
  
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
      await dbService.saveExerciseResult(
        exerciseType, 
        score, 
        totalQuestions, 
        languagePair,
        wordSource // Kelime kaynağını da kaydet
      );
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
      return '#4CAF50'; // Green
    } else if (percentage >= 60) {
      return '#2196F3'; // Blue
    } else {
      return '#FF9800'; // Orange
    }
  };
  
  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {translations.exercise.result.title}
        </Text>
      </View>
      
      <Animated.View 
        style={[
          styles.resultContainer,
          { 
            backgroundColor: colors.surface,
            borderColor: colors.border,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
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
      </Animated.View>
      
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
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
          onPress={() => navigation.replace('Exercise')}
        >
          <Text style={[styles.buttonText, { color: colors.text.primary }]}>
            {translations.exercise.result.backToExercises}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultContainer: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 32,
  },
  resultIcon: {
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
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
    gap: 12,
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
