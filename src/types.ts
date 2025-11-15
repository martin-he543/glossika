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
  masteryLevel: number;
  correctCount: number;
  wrongCount: number;
}

export interface Kanji {
  id: string;
  character: string;
  meaning: string;
  pronunciation: string;
  language: 'japanese' | 'chinese';
  createdAt: number;
  srsLevel: number;
  masteryLevel: number;
  waniKaniLevel: number; // 1-60 like WaniKani
  correctCount: number;
  wrongCount: number;
  exampleSentences?: string[];
  exampleWords?: string[];
}

export interface User {
  id: string;
  email: string;
  createdAt: number;
}

export interface LeaderboardEntry {
  userId: string;
  userEmail: string;
  courseId?: string; // undefined for overall leaderboard
  xp: number;
  wordsLearned: number;
  sentencesLearned: number;
  lastUpdated: number;
}

export interface AppState {
  courses: Course[];
  words: Word[];
  courseProgress: CourseProgress[];
  clozeSentences: ClozeSentence[];
  clozeCourses: ClozeCourse[];
  kanji: Kanji[];
  currentCourseId?: string;
}
