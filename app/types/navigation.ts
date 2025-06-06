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
  WordListDetail: {
    listId: string;
    listName: string;
  };
  ExerciseQuestion: {
    exerciseType: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'mixed';
    questionIndex: number;
    totalQuestions: number;
    score: number;
    askedWords: string[];
    previousType?: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch';
    wordSource: 'learned' | 'dictionary' | 'wordlist';
    level?: string | null;
    wordListId?: number;
  };
  ExerciseResult: {
    score: number;
    totalQuestions: number;
    exerciseType: string;
    wordSource: 'learned' | 'dictionary' | 'wordlist';
    level?: string | null;
    wordListId?: number;
    languagePair: string;
  };
}; 