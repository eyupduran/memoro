import type { Word } from './words';
import type { ImageSourcePropType } from 'react-native';

export type RootStackParamList = {
  Home: undefined;
  Onboarding: undefined;
  LevelSelection: undefined;
  WordCount: {
    level: string;
  };
  WordList: {
    level: string;
    wordCount: number;
  };
  ImageSelection: {
    level: string;
    wordCount: number;
    selectedWords: Word[];
    isReinforcement?: boolean;
  };
  WordOverlay: {
    level: string;
    wordCount: number;
    selectedWords: Word[];
    selectedImage: string;
    isReinforcement?: boolean;
  };
  Stats: undefined;
  Settings: undefined;
  Dictionary: undefined;
  Exercise: undefined;
  ExerciseQuestion: {
    exerciseType: 'fillInTheBlank' | 'wordMatch' | 'mixed' | 'sentenceMatch';
    questionIndex: number;
    totalQuestions: number;
    score: number;
    askedWords?: string[];
    previousType?: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch';
    wordSource?: 'learned' | 'dictionary';
    level?: string | null;
  };
  ExerciseResult: {
    score: number;
    totalQuestions: number;
    languagePair: string;
    exerciseType?: 'fillInTheBlank' | 'wordMatch' | 'mixed' | 'sentenceMatch';
    wordSource?: 'learned' | 'dictionary';
    level?: string | null;
  };
}; 