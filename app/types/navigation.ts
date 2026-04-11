import type { Word } from './words';
import type { ImageSourcePropType } from 'react-native';
import { QuestionDetail } from '../screens/ExerciseQuestionScreen';
import type { OverlaySnapshot } from '../services/autoWallpaper';

export type WordSource = 'learned' | 'dictionary' | 'wordlist' | 'custom';

export type RootStackParamList = {
  Home: undefined;
  Onboarding: undefined;
  Auth: undefined;
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
    /**
     * When provided, WordOverlayScreen runs in headless auto-capture mode:
     * - Initial customization state is restored from the snapshot
     * - UI chrome (buttons, customize panel) is hidden
     * - Screen auto-captures itself shortly after mount, applies the result
     *   to the native wallpaper cache, then navigates back
     * - No user interaction is needed
     */
    autoCapture?: {
      snapshot: OverlaySnapshot;
      /** Whether to also call Wallpaper.applyCachedWallpaperNow() after cache update */
      applyImmediately?: boolean;
    };
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
  WordDetail: {
    word: string;
    meaning: string;
    level?: string;
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
  AutoWallpaperSettings: undefined;
};