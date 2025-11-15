import { GlyphySRSStage, Radical, Kanji, Vocabulary } from '../types';

// Glyphy SRS stage progression thresholds
const SRS_THRESHOLDS = {
  apprentice: { correct: 2, interval: 4 * 60 * 60 * 1000 }, // 4 hours
  guru: { correct: 4, interval: 8 * 60 * 60 * 1000 }, // 8 hours
  master: { correct: 6, interval: 24 * 60 * 60 * 1000 }, // 1 day
  enlightened: { correct: 8, interval: 7 * 24 * 60 * 60 * 1000 }, // 7 days
  burned: { correct: 9, interval: Infinity }, // Never review again
};

// Stage order for progression
const STAGE_ORDER: GlyphySRSStage[] = ['apprentice', 'guru', 'master', 'enlightened', 'burned'];

export function getNextSRSStage(currentStage: GlyphySRSStage, isCorrect: boolean, correctStreak: number): GlyphySRSStage {
  if (currentStage === 'locked') {
    return 'locked';
  }

  if (!isCorrect) {
    // Reset to apprentice on incorrect
    return 'apprentice';
  }

  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1) return 'apprentice';

  // Check if we have enough correct answers to advance
  const threshold = SRS_THRESHOLDS[currentStage];
  if (correctStreak >= threshold.correct) {
    // Advance to next stage
    if (currentIndex < STAGE_ORDER.length - 1) {
      return STAGE_ORDER[currentIndex + 1];
    }
  }

  return currentStage;
}

export function calculateNextReview(stage: GlyphySRSStage): number | undefined {
  if (stage === 'locked' || stage === 'burned') {
    return undefined;
  }

  const threshold = SRS_THRESHOLDS[stage];
  if (threshold.interval === Infinity) {
    return undefined;
  }

  return Date.now() + threshold.interval;
}

export function getCorrectStreak(item: Radical | Kanji | Vocabulary): number {
  // For now, use correct count as a proxy for streak
  // In a production system, you'd track consecutive correct answers separately
  // This is a simplified version that works for the basic progression
  if (item.srsStage === 'apprentice') {
    return item.correctCount;
  } else if (item.srsStage === 'guru') {
    return Math.max(0, item.correctCount - 2);
  } else if (item.srsStage === 'master') {
    return Math.max(0, item.correctCount - 4);
  } else if (item.srsStage === 'enlightened') {
    return Math.max(0, item.correctCount - 6);
  }
  return item.correctCount;
}

export function updateSRSProgress<T extends Radical | Kanji | Vocabulary>(
  item: T,
  isCorrect: boolean
): Partial<T> {
  const correctStreak = getCorrectStreak(item);
  const newStage = getNextSRSStage(item.srsStage, isCorrect, correctStreak);
  const nextReview = calculateNextReview(newStage);

  return {
    srsStage: newStage,
    nextReview,
    lastReviewed: Date.now(),
    correctCount: item.correctCount + (isCorrect ? 1 : 0),
    wrongCount: item.wrongCount + (isCorrect ? 0 : 1),
  } as Partial<T>;
}

export function getItemsDueForReview<T extends Radical | Kanji | Vocabulary>(
  items: T[]
): T[] {
  const now = Date.now();
  return items.filter(item => {
    if (item.srsStage === 'locked' || item.srsStage === 'burned') {
      return false;
    }
    if (!item.nextReview) {
      return true; // If no nextReview set, item is due (already unlocked)
    }
    return item.nextReview <= now;
  });
}

export function getItemsByLevel<T extends Radical | Kanji | Vocabulary>(
  items: T[],
  level: number
): T[] {
  return items.filter(item => item.level === level);
}

export function canUnlockLevel(
  level: number,
  radicals: Radical[],
  kanji: Kanji[],
  vocabulary: Vocabulary[]
): boolean {
  if (level === 1) return true;

  // Check if previous level is mastered
  const prevLevel = level - 1;
  const prevRadicals = radicals.filter(r => r.level === prevLevel);
  const prevKanji = kanji.filter(k => k.level === prevLevel);
  const prevVocab = vocabulary.filter(v => v.level === prevLevel);

  // All items in previous level must be at least "guru" stage
  const allPrevItems = [...prevRadicals, ...prevKanji, ...prevVocab];
  const allMastered = allPrevItems.every(item => 
    item.srsStage === 'guru' || 
    item.srsStage === 'master' || 
    item.srsStage === 'enlightened' || 
    item.srsStage === 'burned'
  );

  return allMastered;
}

export function getUnlockableItems<T extends Radical | Kanji | Vocabulary>(
  items: T[],
  radicals: Radical[],
  kanji: Kanji[],
  vocabulary: Vocabulary[]
): T[] {
  return items.filter(item => {
    if (item.srsStage !== 'locked') return false;
    
    // Check if level can be unlocked
    if (!canUnlockLevel(item.level, radicals, kanji, vocabulary)) {
      return false;
    }

    // For kanji, check if all required radicals are unlocked
    if ('radicalIds' in item) {
      const kanjiItem = item as unknown as Kanji;
      const requiredRadicals = radicals.filter(r => kanjiItem.radicalIds.includes(r.id));
      return requiredRadicals.every(r => r.srsStage !== 'locked');
    }

    // For vocabulary, check if all required kanji are unlocked
    if ('kanjiIds' in item) {
      const vocabItem = item as unknown as Vocabulary;
      const requiredKanji = kanji.filter(k => vocabItem.kanjiIds.includes(k.id));
      return requiredKanji.every(k => k.srsStage !== 'locked');
    }

    return true;
  });
}

