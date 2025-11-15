import { LeaderboardEntry } from '../types';
import { auth } from './auth';

const LEADERBOARD_STORAGE_KEY = 'glossika_leaderboard';
const XP_PER_LEARNED_ITEM = 10;

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

export const leaderboard = {
  // Award XP for learning a word
  awardWordXP(courseId: string): void {
    const user = auth.getCurrentUser();
    if (!user) return;

    const entry = getOrCreateEntry(user.id, user.email, courseId);
    entry.xp += XP_PER_LEARNED_ITEM;
    entry.wordsLearned += 1;
    entry.lastUpdated = Date.now();

    // Update overall entry
    const overallEntry = getOrCreateEntry(user.id, user.email);
    overallEntry.xp += XP_PER_LEARNED_ITEM;
    overallEntry.wordsLearned += 1;
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
      .map(e => ({
        userId: e.userId,
        userEmail: e.userEmail,
        courseId: undefined,
        xp: e.xp,
        wordsLearned: e.wordsLearned,
        sentencesLearned: e.sentencesLearned,
        lastUpdated: e.lastUpdated,
      }));
  },

  // Get course-specific leaderboard
  getCourseLeaderboard(courseId: string, limit: number = 100): LeaderboardEntry[] {
    const entries = loadLeaderboard();
    return entries
      .filter(e => e.courseId === courseId)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit)
      .map(e => ({
        userId: e.userId,
        userEmail: e.userEmail,
        courseId: e.courseId,
        xp: e.xp,
        wordsLearned: e.wordsLearned,
        sentencesLearned: e.sentencesLearned,
        lastUpdated: e.lastUpdated,
      }));
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

