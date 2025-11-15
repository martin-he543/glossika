import { Word } from '../types';

export function calculateNextReview(word: Word, difficulty: 'easy' | 'medium' | 'hard' | 'impossible'): number {
  const now = Date.now();
  const intervals: Record<string, number> = {
    easy: 4 * 24 * 60 * 60 * 1000, // 4 days
    medium: 2 * 24 * 60 * 60 * 1000, // 2 days
    hard: 1 * 24 * 60 * 60 * 1000, // 1 day
    impossible: 0, // review immediately
  };

  const baseInterval = intervals[difficulty] || intervals.medium;
  const multiplier = Math.pow(1.5, word.srsLevel);
  const nextReview = now + (baseInterval * multiplier);

  return nextReview;
}

export function updateSRSLevel(word: Word, difficulty: 'easy' | 'medium' | 'hard' | 'impossible'): number {
  if (difficulty === 'easy') {
    return word.srsLevel + 2;
  } else if (difficulty === 'medium') {
    return word.srsLevel + 1;
  } else if (difficulty === 'hard') {
    return Math.max(0, word.srsLevel - 1);
  } else {
    return 0; // impossible - reset
  }
}

export function getMasteryLevel(srsLevel: number): 'seed' | 'sprout' | 'seedling' | 'plant' | 'tree' {
  if (srsLevel === 0) return 'seed';
  if (srsLevel <= 2) return 'sprout';
  if (srsLevel <= 5) return 'seedling';
  if (srsLevel <= 10) return 'plant';
  return 'tree';
}

export function getWordsDueForReview(words: Word[]): Word[] {
  const now = Date.now();
  return words.filter(w => {
    if (!w.nextReview) return true; // new words
    return w.nextReview <= now;
  });
}

