/**
 * Spaced Repetition System (SRS) Implementation
 * 
 * Supports two algorithms:
 * 1. Staged SRS (default): Simple stage-based intervals
 * 2. SM-2: Anki-style algorithm with ease factors
 */

export interface SRSStage {
  name: string;
  masteryPercent: number;
  intervalDays: number;
}

export interface SRSConfig {
  stages: SRSStage[];
  masteryIncrement: number; // Percentage points to add on correct answer
  masteryDecrement: number; // Percentage points to subtract on incorrect
}

export interface UserProgress {
  masteryPercent: number;
  srsStage: number;
  lastSeen: Date;
  nextReviewAt: Date;
  correctCount: number;
  incorrectCount: number;
}

export interface SM2Params {
  easeFactor: number;
  interval: number; // days
  repetitionCount: number;
  lastReview: Date;
}

// Default staged SRS configuration (matches Clozemaster behavior)
export const DEFAULT_SRS_CONFIG: SRSConfig = {
  stages: [
    { name: "0%", masteryPercent: 0, intervalDays: 0 },      // Same day
    { name: "25%", masteryPercent: 25, intervalDays: 1 },     // Next day
    { name: "50%", masteryPercent: 50, intervalDays: 10 },   // 10 days
    { name: "75%", masteryPercent: 75, intervalDays: 30 },   // 30 days
    { name: "100%", masteryPercent: 100, intervalDays: 180 } // 180 days
  ],
  masteryIncrement: 25,
  masteryDecrement: 25
};

/**
 * Update progress using staged SRS algorithm
 */
export function updateStagedSRS(
  currentProgress: UserProgress,
  isCorrect: boolean,
  config: SRSConfig = DEFAULT_SRS_CONFIG
): UserProgress {
  let newMastery = currentProgress.masteryPercent;
  let newStage = currentProgress.srsStage;
  const now = new Date();

  if (isCorrect) {
    // Increment mastery and advance stage
    newMastery = Math.min(100, newMastery + config.masteryIncrement);
    
    // Find the appropriate stage for new mastery level
    for (let i = config.stages.length - 1; i >= 0; i--) {
      if (newMastery >= config.stages[i].masteryPercent) {
        newStage = i;
        break;
      }
    }
  } else {
    // Reset to stage 0 on incorrect
    newMastery = Math.max(0, newMastery - config.masteryDecrement);
    newStage = 0;
  }

  // Calculate next review date based on stage
  const stageConfig = config.stages[newStage];
  const nextReviewAt = new Date(now);
  
  if (stageConfig.intervalDays === 0) {
    // Same day: review in 1 hour
    nextReviewAt.setHours(nextReviewAt.getHours() + 1);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + stageConfig.intervalDays);
  }

  return {
    masteryPercent: newMastery,
    srsStage: newStage,
    lastSeen: now,
    nextReviewAt,
    correctCount: currentProgress.correctCount + (isCorrect ? 1 : 0),
    incorrectCount: currentProgress.incorrectCount + (isCorrect ? 0 : 1)
  };
}

/**
 * SM-2 Algorithm (Anki-style)
 * Based on SuperMemo 2 algorithm
 */
export function updateSM2(
  params: SM2Params,
  quality: number // 0-5: 0=blackout, 1=incorrect, 2=incorrect but remembered, 3=correct with difficulty, 4=correct, 5=perfect
): SM2Params {
  if (quality < 3) {
    // Incorrect: reset
    return {
      easeFactor: Math.max(1.3, params.easeFactor - 0.2),
      interval: 1,
      repetitionCount: 0,
      lastReview: new Date()
    };
  }

  // Calculate new ease factor
  const newEaseFactor = params.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const clampedEaseFactor = Math.max(1.3, newEaseFactor);

  // Calculate new interval
  let newInterval: number;
  if (params.repetitionCount === 0) {
    newInterval = 1;
  } else if (params.repetitionCount === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(params.interval * clampedEaseFactor);
  }

  return {
    easeFactor: clampedEaseFactor,
    interval: newInterval,
    repetitionCount: params.repetitionCount + 1,
    lastReview: new Date()
  };
}

/**
 * Convert SM2 quality rating to boolean (for compatibility)
 */
export function qualityToBoolean(quality: number): boolean {
  return quality >= 3;
}

/**
 * Calculate points awarded for a correct answer
 */
export function calculatePoints(
  isCorrect: boolean,
  currentStreak: number,
  basePoints: number = 10
): number {
  if (!isCorrect) return 0;
  
  // Base points + streak bonus
  const streakBonus = Math.min(currentStreak * 2, 20); // Max 20 bonus points
  return basePoints + streakBonus;
}

/**
 * Check if an item is due for review
 */
export function isDueForReview(progress: UserProgress): boolean {
  return new Date() >= progress.nextReviewAt;
}

/**
 * Get items due for review from a list
 */
export function getDueItems<T extends { progress: UserProgress }>(
  items: T[]
): T[] {
  return items.filter(item => isDueForReview(item.progress));
}

