import { LeaderboardEntry } from '../types';
import { auth } from './auth';
import { userProfile } from './userProfile';

const LEADERBOARD_STORAGE_KEY = 'glossika_leaderboard';
const XP_PER_LEARNED_ITEM = 5; // Lowered from 10
const XP_PER_REVIEW = 2; // XP for reviewing a word
const XP_PER_FLASHCARD = 1; // XP for reviewing a flashcard
const XP_PER_SPEED_REVIEW_QUESTION = 1; // XP per question in speed review

interface StoredLeaderboardEntry {
  userId: string;
  userEmail: string;
  courseId?: string;
  xp: number;
  wordsLearned: number;
  sentencesLearned: number;
  lastUpdated: number;
}

function loadLeaderboard(): StoredLeaderboardEntry[] {
  try {
    const data = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
    return [];
  }
}

function saveLeaderboard(entries: StoredLeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save leaderboard:', error);
  }
}

function getOrCreateEntry(userId: string, userEmail: string, courseId?: string): StoredLeaderboardEntry {
  const entries = loadLeaderboard();
  let entry = entries.find(
    e => e.userId === userId && (courseId ? e.courseId === courseId : !e.courseId)
  );

  if (!entry) {
    entry = {
      userId,
      userEmail,
      courseId,
      xp: 0,
      wordsLearned: 0,
      sentencesLearned: 0,
      lastUpdated: Date.now(),
    };
    entries.push(entry);
    saveLeaderboard(entries);
  }

  return entry;
}

// Get progressive XP based on SRS level
function getProgressiveXP(srsLevel: number): number {
  if (srsLevel === 0) return 0;
  if (srsLevel <= 2) return XP_PER_LEARNED_ITEM; // seed/sprout
  if (srsLevel <= 5) return XP_PER_LEARNED_ITEM + 2; // seedling
  if (srsLevel <= 10) return XP_PER_LEARNED_ITEM + 5; // plant
  return XP_PER_LEARNED_ITEM + 10; // tree
}

export const leaderboard = {
  // Award XP for learning a word (with progressive XP based on SRS level)
  awardWordXP(courseId: string, srsLevel: number = 1): void {
    const user = auth.getCurrentUser();
    if (!user) return;

    const xpAmount = getProgressiveXP(srsLevel);
    const entry = getOrCreateEntry(user.id, user.email, courseId);
    entry.xp += xpAmount;
    if (srsLevel === 1) {
      entry.wordsLearned += 1;
    }
    entry.lastUpdated = Date.now();

    // Update overall entry
    const overallEntry = getOrCreateEntry(user.id, user.email);
    overallEntry.xp += xpAmount;
    if (srsLevel === 1) {
      overallEntry.wordsLearned += 1;
    }
    overallEntry.lastUpdated = Date.now();

    const entries = loadLeaderboard();
    const courseIndex = entries.findIndex(
      e => e.userId === user.id && e.courseId === courseId
    );
    const overallIndex = entries.findIndex(
      e => e.userId === user.id && !e.courseId
    );

    if (courseIndex !== -1) {
      entries[courseIndex] = entry;
    } else {
      entries.push(entry);
    }

    if (overallIndex !== -1) {
      entries[overallIndex] = overallEntry;
    } else {
      entries.push(overallEntry);
    }

    saveLeaderboard(entries);
  },

  // Award XP for reviewing a word
  awardReviewXP(courseId: string, srsLevel: number): void {
    const user = auth.getCurrentUser();
    if (!user) return;

    const xpAmount = XP_PER_REVIEW + Math.floor(srsLevel / 2); // Progressive XP
    const entry = getOrCreateEntry(user.id, user.email, courseId);
    entry.xp += xpAmount;
    entry.lastUpdated = Date.now();

    const overallEntry = getOrCreateEntry(user.id, user.email);
    overallEntry.xp += xpAmount;
    overallEntry.lastUpdated = Date.now();

    const entries = loadLeaderboard();
    const courseIndex = entries.findIndex(
      e => e.userId === user.id && e.courseId === courseId
    );
    const overallIndex = entries.findIndex(
      e => e.userId === user.id && !e.courseId
    );

    if (courseIndex !== -1) {
      entries[courseIndex] = entry;
    } else {
      entries.push(entry);
    }

    if (overallIndex !== -1) {
      entries[overallIndex] = overallEntry;
    } else {
      entries.push(overallEntry);
    }

    saveLeaderboard(entries);
  },

  // Award XP for reviewing a flashcard
  awardFlashcardXP(courseId: string, srsLevel: number): void {
    const user = auth.getCurrentUser();
    if (!user) return;

    const xpAmount = XP_PER_FLASHCARD + Math.floor(srsLevel / 3);
    const entry = getOrCreateEntry(user.id, user.email, courseId);
    entry.xp += xpAmount;
    entry.lastUpdated = Date.now();

    const overallEntry = getOrCreateEntry(user.id, user.email);
    overallEntry.xp += xpAmount;
    overallEntry.lastUpdated = Date.now();

    const entries = loadLeaderboard();
    const courseIndex = entries.findIndex(
      e => e.userId === user.id && e.courseId === courseId
    );
    const overallIndex = entries.findIndex(
      e => e.userId === user.id && !e.courseId
    );

    if (courseIndex !== -1) {
      entries[courseIndex] = entry;
    } else {
      entries.push(entry);
    }

    if (overallIndex !== -1) {
      entries[overallIndex] = overallEntry;
    } else {
      entries.push(overallEntry);
    }

    saveLeaderboard(entries);
  },

  // Award XP for speed review question
  awardSpeedReviewXP(courseId: string): void {
    const user = auth.getCurrentUser();
    if (!user) return;

    const xpAmount = XP_PER_SPEED_REVIEW_QUESTION;
    const entry = getOrCreateEntry(user.id, user.email, courseId);
    entry.xp += xpAmount;
    entry.lastUpdated = Date.now();

    const overallEntry = getOrCreateEntry(user.id, user.email);
    overallEntry.xp += xpAmount;
    overallEntry.lastUpdated = Date.now();

    const entries = loadLeaderboard();
    const courseIndex = entries.findIndex(
      e => e.userId === user.id && e.courseId === courseId
    );
    const overallIndex = entries.findIndex(
      e => e.userId === user.id && !e.courseId
    );

    if (courseIndex !== -1) {
      entries[courseIndex] = entry;
    } else {
      entries.push(entry);
    }

    if (overallIndex !== -1) {
      entries[overallIndex] = overallEntry;
    } else {
      entries.push(overallEntry);
    }

    saveLeaderboard(entries);
  },

  // Award XP for learning a sentence
  awardSentenceXP(courseId: string): void {
    const user = auth.getCurrentUser();
    if (!user) return;

    const entry = getOrCreateEntry(user.id, user.email, courseId);
    entry.xp += XP_PER_LEARNED_ITEM;
    entry.sentencesLearned += 1;
    entry.lastUpdated = Date.now();

    // Update overall entry
    const overallEntry = getOrCreateEntry(user.id, user.email);
    overallEntry.xp += XP_PER_LEARNED_ITEM;
    overallEntry.sentencesLearned += 1;
    overallEntry.lastUpdated = Date.now();

    const entries = loadLeaderboard();
    const courseIndex = entries.findIndex(
      e => e.userId === user.id && e.courseId === courseId
    );
    const overallIndex = entries.findIndex(
      e => e.userId === user.id && !e.courseId
    );

    if (courseIndex !== -1) {
      entries[courseIndex] = entry;
    } else {
      entries.push(entry);
    }

    if (overallIndex !== -1) {
      entries[overallIndex] = overallEntry;
    } else {
      entries.push(overallEntry);
    }

    saveLeaderboard(entries);
  },

  // Get overall leaderboard
  getOverallLeaderboard(limit: number = 100): LeaderboardEntry[] {
    const entries = loadLeaderboard();
    return entries
      .filter(e => !e.courseId)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit)
      .map(e => {
        const profile = userProfile.getProfile(e.userId);
        return {
          userId: e.userId,
          userEmail: e.userEmail,
          username: profile?.username,
          courseId: undefined,
          xp: e.xp,
          wordsLearned: e.wordsLearned,
          sentencesLearned: e.sentencesLearned,
          lastUpdated: e.lastUpdated,
        };
      });
  },

  // Get course-specific leaderboard
  getCourseLeaderboard(courseId: string, limit: number = 100): LeaderboardEntry[] {
    const entries = loadLeaderboard();
    return entries
      .filter(e => e.courseId === courseId)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit)
      .map(e => {
        const profile = userProfile.getProfile(e.userId);
        return {
          userId: e.userId,
          userEmail: e.userEmail,
          username: profile?.username,
          courseId: e.courseId,
          xp: e.xp,
          wordsLearned: e.wordsLearned,
          sentencesLearned: e.sentencesLearned,
          lastUpdated: e.lastUpdated,
        };
      });
  },

  // Get current user's XP
  getCurrentUserXP(courseId?: string): number {
    const user = auth.getCurrentUser();
    if (!user) return 0;

    const entries = loadLeaderboard();
    const entry = entries.find(
      e => e.userId === user.id && (courseId ? e.courseId === courseId : !e.courseId)
    );

    return entry?.xp || 0;
  },

  // Get current user's rank
  getCurrentUserRank(courseId?: string): number {
    const user = auth.getCurrentUser();
    if (!user) return -1;

    const entries = courseId
      ? this.getCourseLeaderboard(courseId, 1000)
      : this.getOverallLeaderboard(1000);

    const rank = entries.findIndex(e => e.userId === user.id);
    return rank === -1 ? -1 : rank + 1;
  },
};

