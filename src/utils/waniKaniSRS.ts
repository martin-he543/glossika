import { GlyphySRSStage, Radical, Kanji, Vocabulary } from '../types';

// Plant-based SRS thresholds
const SRS_THRESHOLDS = {
  seed: { 
    meaningCorrect: 1, // Need 1 correct meaning review
    readingCorrect: 1, // Need 1 correct reading review
    interval: 4 * 60 * 60 * 1000 // 4 hours
  },
  sprout: { 
    meaningCorrect: 2, // Need 2 correct meaning reviews
    readingCorrect: 2, // Need 2 correct reading reviews
    interval: 8 * 60 * 60 * 1000 // 8 hours
  },
  seedling: { 
    meaningCorrect: 3, // Need 3 correct meaning reviews
    readingCorrect: 3, // Need 3 correct reading reviews
    interval: 24 * 60 * 60 * 1000 // 1 day
  },
  plant: { 
    meaningCorrect: 4, // Need 4 correct meaning reviews
    readingCorrect: 4, // Need 4 correct reading reviews
    interval: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  tree: { 
    meaningCorrect: 5, // Need 5 correct meaning reviews
    readingCorrect: 5, // Need 5 correct reading reviews
    interval: Infinity // Never review again
  },
};

// Stage order for progression
const STAGE_ORDER: GlyphySRSStage[] = ['seed', 'sprout', 'seedling', 'plant', 'tree'];

/**
 * Get the required correct answers for current stage
 */
function getRequiredCorrect(stage: GlyphySRSStage, type: 'meaning' | 'reading'): number {
  if (stage === 'locked' || stage === 'tree') {
    return 0;
  }
  const threshold = SRS_THRESHOLDS[stage as Exclude<GlyphySRSStage, 'locked' | 'tree'>];
  return type === 'meaning' ? threshold.meaningCorrect : threshold.readingCorrect;
}

/**
 * Get current correct count for meaning or reading
 */
function getCurrentCorrect<T extends Radical | Kanji | Vocabulary>(
  item: T,
  type: 'meaning' | 'reading'
): number {
  // Handle backward compatibility - items may not have these fields yet
  if (type === 'meaning') {
    return (item as any).meaningCorrect ?? 0;
  } else {
    return (item as any).readingCorrect ?? 0;
  }
}

/**
 * Check if item can advance to next stage
 * Both meaning AND reading must meet the threshold
 */
export function canAdvanceStage<T extends Radical | Kanji | Vocabulary>(item: T): boolean {
  if (item.srsStage === 'tree' || item.srsStage === 'locked') {
    return false;
  }

  const meaningRequired = getRequiredCorrect(item.srsStage, 'meaning');
  const readingRequired = getRequiredCorrect(item.srsStage, 'reading');
  
  const meaningCount = getCurrentCorrect(item, 'meaning');
  const readingCount = getCurrentCorrect(item, 'reading');

  return meaningCount >= meaningRequired && readingCount >= readingRequired;
}

/**
 * Update SRS progress for a specific review type (meaning or reading)
 */
export function updateSRSProgressForReview<T extends Radical | Kanji | Vocabulary>(
  item: T,
  type: 'meaning' | 'reading',
  isCorrect: boolean
): Partial<T> {
  if (item.srsStage === 'locked' || item.srsStage === 'tree') {
    return {};
  }

  // Update the specific counter
  const updates: Partial<T> = {
    lastReviewed: Date.now(),
  } as Partial<T>;

  // Handle backward compatibility
  const currentMeaningCorrect = (item as any).meaningCorrect ?? 0;
  const currentMeaningWrong = (item as any).meaningWrong ?? 0;
  const currentReadingCorrect = (item as any).readingCorrect ?? 0;
  const currentReadingWrong = (item as any).readingWrong ?? 0;

  if (type === 'meaning') {
    if (isCorrect) {
      (updates as any).meaningCorrect = currentMeaningCorrect + 1;
      (updates as any).correctCount = item.correctCount + 1;
    } else {
      (updates as any).meaningWrong = currentMeaningWrong + 1;
      (updates as any).wrongCount = item.wrongCount + 1;
      // Reset meaning progress on incorrect
      (updates as any).meaningCorrect = 0;
      // If incorrect, reset to seed
      (updates as any).srsStage = 'seed';
      (updates as any).readingCorrect = 0; // Also reset reading progress
    }
  } else {
    if (isCorrect) {
      (updates as any).readingCorrect = currentReadingCorrect + 1;
      (updates as any).correctCount = item.correctCount + 1;
    } else {
      (updates as any).readingWrong = currentReadingWrong + 1;
      (updates as any).wrongCount = item.wrongCount + 1;
      // Reset reading progress on incorrect
      (updates as any).readingCorrect = 0;
      // If incorrect, reset to seed
      (updates as any).srsStage = 'seed';
      (updates as any).meaningCorrect = 0; // Also reset meaning progress
    }
  }

  // Check if we can advance stage (both meaning and reading must be correct enough)
  if (isCorrect) {
    const updatedItem = { ...item, ...updates };
    if (canAdvanceStage(updatedItem as T)) {
      const currentIndex = STAGE_ORDER.indexOf(item.srsStage);
      if (currentIndex < STAGE_ORDER.length - 1) {
        const nextStage = STAGE_ORDER[currentIndex + 1];
        (updates as any).srsStage = nextStage;
        // Reset counters when advancing
        (updates as any).meaningCorrect = 0;
        (updates as any).readingCorrect = 0;
        // Set next review time
        const threshold = SRS_THRESHOLDS[nextStage];
        (updates as any).nextReview = Date.now() + threshold.interval;
      }
    } else {
      // Set next review time based on current stage
      if (item.srsStage !== 'locked' && item.srsStage !== 'tree') {
        const threshold = SRS_THRESHOLDS[item.srsStage as Exclude<GlyphySRSStage, 'locked' | 'tree'>];
        (updates as any).nextReview = Date.now() + threshold.interval;
      }
    }
  } else {
    // Set next review time (sooner for incorrect)
    (updates as any).nextReview = Date.now() + (1 * 60 * 60 * 1000); // 1 hour
  }

  return updates;
}

/**
 * Get items that need meaning review
 */
export function getItemsNeedingMeaningReview<T extends Radical | Kanji | Vocabulary>(
  items: T[]
): T[] {
  const now = Date.now();
  return items.filter(item => {
    if (item.srsStage === 'locked' || item.srsStage === 'tree') {
      return false;
    }

    // Check if meaning review is due
    const meaningRequired = getRequiredCorrect(item.srsStage as Exclude<GlyphySRSStage, 'locked' | 'tree'>, 'meaning');
    const meaningCount = getCurrentCorrect(item, 'meaning');
    
    // Need more correct meaning reviews
    if (meaningCount < meaningRequired) {
      return true;
    }

    // If both are complete, check if review time has passed
    if (item.nextReview && item.nextReview <= now) {
      // After advancing, both counters reset, so both need review again
      return true;
    }

    return false;
  });
}

/**
 * Get items that need reading review
 */
export function getItemsNeedingReadingReview<T extends Radical | Kanji | Vocabulary>(
  items: T[]
): T[] {
  const now = Date.now();
  return items.filter(item => {
    if (item.srsStage === 'locked' || item.srsStage === 'tree') {
      return false;
    }

    // Check if reading review is due
    const readingRequired = getRequiredCorrect(item.srsStage as Exclude<GlyphySRSStage, 'locked' | 'tree'>, 'reading');
    const readingCount = getCurrentCorrect(item, 'reading');
    
    // Need more correct reading reviews
    if (readingCount < readingRequired) {
      return true;
    }

    // If both are complete, check if review time has passed
    if (item.nextReview && item.nextReview <= now) {
      // After advancing, both counters reset, so both need review again
      return true;
    }

    return false;
  });
}

/**
 * Create review queue with both meaning and reading reviews
 */
export function createReviewQueue<T extends Radical | Kanji | Vocabulary>(
  items: T[]
): Array<{ item: T; type: 'meaning' | 'reading' }> {
  const meaningReviews = getItemsNeedingMeaningReview(items).map(item => ({
    item,
    type: 'meaning' as const
  }));
  
  const readingReviews = getItemsNeedingReadingReview(items).map(item => ({
    item,
    type: 'reading' as const
  }));

  // Combine and shuffle
  const allReviews = [...meaningReviews, ...readingReviews];
  return allReviews.sort(() => Math.random() - 0.5);
}

/**
 * Calculate next review time based on stage
 */
export function calculateNextReviewTime(stage: GlyphySRSStage): number | undefined {
  if (stage === 'locked' || stage === 'tree') {
    return undefined;
  }

  const threshold = SRS_THRESHOLDS[stage as Exclude<GlyphySRSStage, 'locked' | 'tree'>];
  if (threshold.interval === Infinity) {
    return undefined;
  }

  return Date.now() + threshold.interval;
}

