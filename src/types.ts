export interface Word {
  id: string;
  native: string;
  target: string;
  courseId: string;
  createdAt: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'impossible';
  isDifficult?: boolean;
  wrongCount: number;
  correctCount: number;
  lastReviewed?: number;
  nextReview?: number;
  srsLevel: number; // 0 = new, higher = more mature
  masteryLevel: 'seed' | 'sprout' | 'seedling' | 'plant' | 'tree';
  level?: number; // Course level (like Memrise), defaults to 1 if not specified
  partOfSpeech?: string; // e.g., "noun", "verb", "adjective"
  pronunciation?: string; // Phonetic pronunciation guide
}

export interface Course {
  id: string;
  name: string;
  nativeLanguage: string;
  targetLanguage: string;
  createdAt: number;
  isPublic: boolean;
  tags: string[];
  description?: string;
  wordCount: number;
  author?: string;
  levels?: number[]; // Array of level numbers that exist in this course (e.g. [1, 2, 3])
}

export interface CourseProgress {
  courseId: string;
  wordsLearned: number;
  wordsMastered: number;
  totalReviews: number;
  lastStudied?: number;
}

export interface ClozeCourse {
  id: string;
  name: string;
  nativeLanguage: string;
  targetLanguage: string;
  createdAt: number;
  isPublic: boolean;
  tags: string[];
  description?: string;
  sentenceCount: number;
  author?: string;
}

export interface ClozeSentence {
  id: string;
  native: string;
  target: string;
  clozeText: string; // target with blanks
  answer: string;
  language: string;
  courseId: string;
  createdAt: number;
  masteryLevel: 'seed' | 'sprout' | 'seedling' | 'plant' | 'tree';
  srsLevel: number; // 0 = new, higher = more mature
  correctCount: number;
  wrongCount: number;
  lastReviewed?: number;
  nextReview?: number;
  isDifficult?: boolean;
}

// Glyphy SRS stages (plant-based)
export type GlyphySRSStage = 'seed' | 'sprout' | 'seedling' | 'plant' | 'tree' | 'locked';

// Radical (foundational component)
export interface Radical {
  id: string;
  character: string;
  meaning: string;
  mnemonic: string;
  mnemonicImage?: string; // URL or base64
  language: 'japanese' | 'chinese';
  level: number; // 1-60
  srsStage: GlyphySRSStage;
  unlockedAt?: number;
  nextReview?: number;
  lastReviewed?: number;
  correctCount: number;
  wrongCount: number;
  meaningCorrect: number; // Separate tracking for meaning reviews
  meaningWrong: number;
  readingCorrect: number; // For radicals, this is character recognition
  readingWrong: number;
  createdAt: number;
}

// Kanji (character)
export interface Kanji {
  id: string;
  character: string;
  meaning: string;
  pronunciation: string; // On'yomi and Kun'yomi for Japanese
  mnemonic: string;
  mnemonicImage?: string; // URL or base64
  radicalIds: string[]; // IDs of radicals that make up this kanji
  language: 'japanese' | 'chinese';
  level: number; // 1-60
  srsStage: GlyphySRSStage;
  unlockedAt?: number;
  nextReview?: number;
  lastReviewed?: number;
  correctCount: number;
  wrongCount: number;
  meaningCorrect: number; // Separate tracking for meaning reviews
  meaningWrong: number;
  readingCorrect: number; // Separate tracking for reading reviews
  readingWrong: number;
  createdAt: number;
  exampleSentences?: string[];
  exampleWords?: string[];
  // Legacy properties for backward compatibility with old Glyphy component
  srsLevel?: number;
  masteryLevel?: number;
  waniKaniLevel?: number;
}

// Vocabulary (word built from kanji)
export interface Vocabulary {
  id: string;
  word: string;
  meaning: string;
  pronunciation: string;
  kanjiIds: string[]; // IDs of kanji that make up this vocabulary
  mnemonic?: string;
  mnemonicImage?: string; // URL or base64
  language: 'japanese' | 'chinese';
  level: number; // 1-60
  srsStage: GlyphySRSStage;
  unlockedAt?: number;
  nextReview?: number;
  lastReviewed?: number;
  correctCount: number;
  wrongCount: number;
  meaningCorrect: number; // Separate tracking for meaning reviews
  meaningWrong: number;
  readingCorrect: number; // Separate tracking for reading reviews
  readingWrong: number;
  createdAt: number;
  exampleSentences?: string[];
}

export interface User {
  id: string;
  email: string;
  createdAt: number;
}

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  avatar?: string; // URL or base64
  isPublic: boolean;
  followers: string[]; // Array of user IDs
  following: string[]; // Array of user IDs
  createdAt: number;
  updatedAt: number;
}

export interface LeaderboardEntry {
  userId: string;
  userEmail: string;
  username?: string;
  courseId?: string; // undefined for overall leaderboard
  xp: number;
  wordsLearned: number;
  sentencesLearned: number;
  lastUpdated: number;
}

export interface StudyActivity {
  courseId: string;
  date: string; // YYYY-MM-DD format
  count: number; // Number of items studied on this date
}

export interface CourseStreak {
  courseId: string;
  currentStreak: number; // Days in current streak
  longestStreak: number; // Longest streak ever
  lastStudied: string; // YYYY-MM-DD format
}

export interface AppState {
  courses: Course[];
  words: Word[];
  courseProgress: CourseProgress[];
  clozeSentences: ClozeSentence[];
  clozeCourses: ClozeCourse[];
  kanji: Kanji[];
  radicals: Radical[];
  vocabulary: Vocabulary[];
  studyActivity: StudyActivity[]; // Track study days
  courseStreaks: CourseStreak[]; // Track streaks per course
  currentCourseId?: string;
}
