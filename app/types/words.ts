export interface Word {
  word: string;
  meaning: string;
  example?: string;
  level?: string;
}

export interface LearnedWord extends Word {
  level: string;
  learnedAt: string;
}

export interface WordList {
  words: Word[];
}

export type AsyncWordLists = {
  [key: string]: Promise<WordList>;
};

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; 