import { storage } from '../storage';
import { StudyActivity, CourseStreak } from '../types';

/**
 * Record study activity (universal, not per course)
 */
export function recordStudyActivity(courseId: string, itemCount: number = 1): void {
  const state = storage.load();
  if (!state.studyActivity) state.studyActivity = [];
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Aggregate all activity for the day (universal)
  const existingIndex = state.studyActivity.findIndex(
    a => a.date === today
  );
  
  if (existingIndex !== -1) {
    state.studyActivity[existingIndex].count += itemCount;
  } else {
    state.studyActivity.push({
      courseId: 'all', // Use 'all' to indicate universal activity
      date: today,
      count: itemCount,
    });
  }
  
  // Update overall streak
  updateOverallStreak();
  
  storage.save(state);
}

/**
 * Update overall streak (universal, not per course)
 */
function updateOverallStreak(): void {
  const state = storage.load();
  if (!state.courseStreaks) state.courseStreaks = [];
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  let streak = state.courseStreaks.find(s => s.courseId === 'all');
  
  if (!streak) {
    streak = {
      courseId: 'all',
      currentStreak: 1,
      longestStreak: 1,
      lastStudied: todayStr,
    };
    state.courseStreaks.push(streak);
  } else {
    const lastStudied = new Date(streak.lastStudied);
    const daysDiff = Math.floor((today.getTime() - lastStudied.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      // Same day, no change
      return;
    } else if (daysDiff === 1) {
      // Consecutive day, increment streak
      streak.currentStreak += 1;
    } else {
      // Streak broken, reset to 1
      streak.currentStreak = 1;
    }
    
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastStudied = todayStr;
  }
  
  storage.save(state);
}

/**
 * Get overall streak (universal)
 */
export function getOverallStreak(): CourseStreak | null {
  const state = storage.load();
  if (!state.courseStreaks) return null;
  return state.courseStreaks.find(s => s.courseId === 'all') || null;
}

/**
 * Get streak for a course (deprecated - use getOverallStreak)
 */
export function getCourseStreak(courseId: string): CourseStreak | null {
  return getOverallStreak();
}

/**
 * Get study activity (universal, aggregated by date)
 */
export function getStudyActivity(courseId: string | null = null): StudyActivity[] {
  const state = storage.load();
  if (!state.studyActivity) return [];
  
  // Always return universal activity (aggregated by date)
  const activityMap = new Map<string, number>();
  state.studyActivity.forEach(a => {
    const existing = activityMap.get(a.date) || 0;
    activityMap.set(a.date, existing + a.count);
  });
  
  // Convert to array
  const activities: StudyActivity[] = Array.from(activityMap.entries()).map(([date, count]) => ({
    courseId: 'all',
    date,
    count,
  }));
  
  // Sort by date descending
  return activities.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get activity heatmap data (universal, last 365 days)
 */
export function getActivityHeatmap(courseId: string | null = null): Map<string, number> {
  // Always return universal activity (ignore courseId)
  const activities = getStudyActivity(null);
  const heatmap = new Map<string, number>();
  
  activities.forEach(activity => {
    heatmap.set(activity.date, activity.count);
  });
  
  return heatmap;
}

/**
 * Check if user studied today (universal)
 */
export function studiedToday(courseId: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  const activities = getStudyActivity(null);
  return activities.some(a => a.date === today && a.count > 0);
}

/**
 * Get recent streak days (last 5 days with flame emoji) - universal
 */
export function getRecentStreakDays(courseId: string | null = null): { date: string; studied: boolean }[] {
  // Always return universal activity
  const activities = getStudyActivity(null);
  const activityMap = new Map<string, boolean>();
  activities.forEach(a => {
    if (a.count > 0) {
      activityMap.set(a.date, true);
    }
  });
  
  const result: { date: string; studied: boolean }[] = [];
  const today = new Date();
  
  for (let i = 4; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      studied: activityMap.has(dateStr) || false,
    });
  }
  
  return result;
}

