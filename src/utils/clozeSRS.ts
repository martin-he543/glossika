import { ClozeSentence } from '../types';
import { getMasteryLevel } from './srs';

/**
 * Update SRS level and mastery level for a cloze sentence
 */
export function updateClozeSRS(
  sentence: ClozeSentence,
  isCorrect: boolean,
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible' = 'medium'
): Partial<ClozeSentence> {
  let newSrsLevel = sentence.srsLevel || 0;
  
  if (isCorrect) {
    if (difficulty === 'easy') {
      newSrsLevel += 2;
    } else if (difficulty === 'medium') {
      newSrsLevel += 1;
    } else if (difficulty === 'hard') {
      newSrsLevel = Math.max(0, newSrsLevel - 1);
    }
    // 'impossible' doesn't change level
  } else {
    // Reset on incorrect
    newSrsLevel = Math.max(0, newSrsLevel - 1);
  }

  const newMasteryLevel = getMasteryLevel(newSrsLevel);
  
  // Calculate next review time
  const now = Date.now();
  let nextReview: number | undefined;
  
  if (newSrsLevel === 0) {
    nextReview = now + (1 * 60 * 60 * 1000); // 1 hour
  } else if (newSrsLevel <= 2) {
    nextReview = now + (4 * 60 * 60 * 1000); // 4 hours
  } else if (newSrsLevel <= 5) {
    nextReview = now + (8 * 60 * 60 * 1000); // 8 hours
  } else if (newSrsLevel <= 10) {
    nextReview = now + (24 * 60 * 60 * 1000); // 1 day
  } else {
    nextReview = now + (7 * 24 * 60 * 60 * 1000); // 7 days
  }

  return {
    srsLevel: newSrsLevel,
    masteryLevel: newMasteryLevel,
    nextReview,
    lastReviewed: now,
    correctCount: sentence.correctCount + (isCorrect ? 1 : 0),
    wrongCount: sentence.wrongCount + (isCorrect ? 0 : 1),
  };
}

/**
 * Get cloze sentences due for review
 */
export function getClozeSentencesDueForReview(sentences: ClozeSentence[]): ClozeSentence[] {
  const now = Date.now();
  return sentences.filter(s => {
    if (s.masteryLevel === 'tree') return false;
    if (!s.nextReview) return s.masteryLevel !== 'tree';
    return s.nextReview <= now;
  });
}

/**
 * Get new cloze sentences (not yet learned)
 */
export function getNewClozeSentences(sentences: ClozeSentence[]): ClozeSentence[] {
  return sentences.filter(s => s.masteryLevel === 'seed' || s.srsLevel === 0);
}

/**
 * Get difficult cloze sentences
 */
export function getDifficultClozeSentences(sentences: ClozeSentence[]): ClozeSentence[] {
  return sentences.filter(s => 
    s.isDifficult || 
    (s.wrongCount > s.correctCount && s.correctCount > 0)
  );
}

