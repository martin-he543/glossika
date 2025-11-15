import {
  updateStagedSRS,
  updateSM2,
  DEFAULT_SRS_CONFIG,
  calculatePoints,
  isDueForReview,
  getDueItems,
  type UserProgress
} from './srs';

describe('SRS Logic', () => {
  describe('updateStagedSRS', () => {
    const initialProgress: UserProgress = {
      masteryPercent: 0,
      srsStage: 0,
      lastSeen: new Date('2024-01-01'),
      nextReviewAt: new Date('2024-01-01'),
      correctCount: 0,
      incorrectCount: 0
    };

    it('should increment mastery on correct answer', () => {
      const result = updateStagedSRS(initialProgress, true);
      
      expect(result.masteryPercent).toBe(25);
      expect(result.srsStage).toBe(1);
      expect(result.correctCount).toBe(1);
      expect(result.incorrectCount).toBe(0);
      expect(result.nextReviewAt.getTime()).toBeGreaterThan(initialProgress.lastSeen.getTime());
    });

    it('should reset to stage 0 on incorrect answer', () => {
      const progress: UserProgress = {
        ...initialProgress,
        masteryPercent: 50,
        srsStage: 2
      };
      
      const result = updateStagedSRS(progress, false);
      
      expect(result.masteryPercent).toBe(25);
      expect(result.srsStage).toBe(0);
      expect(result.correctCount).toBe(0);
      expect(result.incorrectCount).toBe(1);
    });

    it('should cap mastery at 100%', () => {
      const progress: UserProgress = {
        ...initialProgress,
        masteryPercent: 90,
        srsStage: 3
      };
      
      const result = updateStagedSRS(progress, true);
      
      expect(result.masteryPercent).toBe(100);
      expect(result.srsStage).toBe(4);
    });

    it('should set next review to 1 hour for stage 0', () => {
      const result = updateStagedSRS(initialProgress, false);
      const hoursUntilReview = (result.nextReviewAt.getTime() - result.lastSeen.getTime()) / (1000 * 60 * 60);
      
      expect(hoursUntilReview).toBeCloseTo(1, 1);
    });

    it('should set next review to correct interval for higher stages', () => {
      const progress: UserProgress = {
        ...initialProgress,
        masteryPercent: 25,
        srsStage: 1
      };
      
      const result = updateStagedSRS(progress, true);
      const daysUntilReview = (result.nextReviewAt.getTime() - result.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(daysUntilReview).toBeCloseTo(10, 0); // Stage 2 = 10 days
    });
  });

  describe('updateSM2', () => {
    const initialParams = {
      easeFactor: 2.5,
      interval: 1,
      repetitionCount: 0,
      lastReview: new Date('2024-01-01')
    };

    it('should reset on incorrect answer (quality < 3)', () => {
      const result = updateSM2(initialParams, 1); // Incorrect
      
      expect(result.interval).toBe(1);
      expect(result.repetitionCount).toBe(0);
      expect(result.easeFactor).toBeLessThan(initialParams.easeFactor);
    });

    it('should advance interval on correct answer', () => {
      const result = updateSM2(initialParams, 4); // Correct
      
      expect(result.interval).toBe(1); // First repetition
      expect(result.repetitionCount).toBe(1);
    });

    it('should increase interval on subsequent correct answers', () => {
      const params = {
        ...initialParams,
        repetitionCount: 2,
        interval: 6
      };
      
      const result = updateSM2(params, 4);
      
      expect(result.interval).toBeGreaterThan(params.interval);
      expect(result.repetitionCount).toBe(3);
    });
  });

  describe('calculatePoints', () => {
    it('should award base points for correct answer', () => {
      expect(calculatePoints(true, 0)).toBe(10);
    });

    it('should award streak bonus', () => {
      expect(calculatePoints(true, 3)).toBe(16); // 10 + 3*2
    });

    it('should cap streak bonus at 20', () => {
      expect(calculatePoints(true, 15)).toBe(30); // 10 + 20 (capped)
    });

    it('should award 0 points for incorrect answer', () => {
      expect(calculatePoints(false, 5)).toBe(0);
    });
  });

  describe('isDueForReview', () => {
    it('should return true if next review is in the past', () => {
      const progress: UserProgress = {
        masteryPercent: 50,
        srsStage: 2,
        lastSeen: new Date('2024-01-01'),
        nextReviewAt: new Date('2024-01-01'),
        correctCount: 5,
        incorrectCount: 1
      };
      
      expect(isDueForReview(progress)).toBe(true);
    });

    it('should return false if next review is in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      
      const progress: UserProgress = {
        masteryPercent: 50,
        srsStage: 2,
        lastSeen: new Date(),
        nextReviewAt: futureDate,
        correctCount: 5,
        incorrectCount: 1
      };
      
      expect(isDueForReview(progress)).toBe(false);
    });
  });

  describe('getDueItems', () => {
    it('should filter items due for review', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000);
      const future = new Date(now.getTime() + 86400000);
      
      const items = [
        { id: 1, progress: { masteryPercent: 0, srsStage: 0, lastSeen: past, nextReviewAt: past, correctCount: 0, incorrectCount: 0 } },
        { id: 2, progress: { masteryPercent: 50, srsStage: 2, lastSeen: past, nextReviewAt: future, correctCount: 5, incorrectCount: 1 } },
        { id: 3, progress: { masteryPercent: 25, srsStage: 1, lastSeen: past, nextReviewAt: past, correctCount: 2, incorrectCount: 0 } }
      ];
      
      const due = getDueItems(items);
      
      expect(due.length).toBe(2);
      expect(due.map(i => i.id)).toEqual([1, 3]);
    });
  });
});

