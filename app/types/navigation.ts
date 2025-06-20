import type { Word } from './words';
import type { ImageSourcePropType } from 'react-native';
import { QuestionDetail } from '../screens/ExerciseQuestionScreen';

export type WordSource = 'learned' | 'dictionary' | 'wordlist' | 'custom';

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
    wordCount: number;
    selectedWords: Word[];
    isReinforcement?: boolean;
  };
  WordOverlay: {
    wordCount: number;
    selectedWords: Word[];
    selectedImage: string;
    isReinforcement?: boolean;
  };
  Stats: undefined;
  Settings: undefined;
  Dictionary: undefined;
  Grammar: undefined;
  Games: undefined;
  Exercise: undefined;
  DetailedDictionary: {
    wordName: string;
  };
  WordListDetail: {
    listId: string;
    level?: string;
    wordCount?: number;
    listName: string;
  };
  ExerciseQuestion: {
    exerciseType: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'mixed' | 'sentenceOrdering';
    questionIndex: number;
    totalQuestions: number;
    score: number;
    askedWords?: string[];
    previousType?: 'fillInTheBlank' | 'wordMatch' | 'sentenceMatch' | 'sentenceOrdering';
    wordSource?: WordSource;
    level?: string | null;
    wordListId?: number;
    wordListName?: string;
    questionDetails?: QuestionDetail[];
    customWords?: any[];
  };
  ExerciseResult: {
    score: number;
    totalQuestions: number;
    exerciseType: string;
    wordSource?: WordSource;
    level?: string | null;
    wordListId?: number;
    wordListName?: string;
    languagePair: string;
    questionDetails?: QuestionDetail[];
  };
  ExerciseDetail: {
    exerciseId: number;
    score: number;
    totalQuestions: number;
    exerciseType: string;
    wordSource: string;
    wordListName?: string;
    level?: string | null;
    date: string;
    languagePair: string;
    details: QuestionDetail[];
  };
  WordLists: undefined;
  PredefinedWordLists: {
    fromOnboarding?: boolean;
  };
}; 