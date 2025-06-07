export interface Word {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  level?: string;
}

export interface LearnedWord extends Word {
  learnedAt: string;
  level: string;
}

export interface WordListItem extends Word {
  listId: string;
  addedAt: string;
}

export interface ExerciseResult {
  id?: number;
  exercise_type: string;
  score: number;
  total_questions: number;
  date: string;
  language_pair: string;
  word_source?: string;
}

export interface WordList {
  words: Word[];
  lastUpdated: string;
}

export type AsyncWordLists = {
  [key: string]: Promise<WordList>;
};

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type WordSource = 'learned' | 'dictionary' | 'wordlist'; 