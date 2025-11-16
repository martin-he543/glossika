import { storage } from '../storage';
import { StudyActivity, CourseStreak } from '../types';

/**
 * Record study activity for a course on a given date
 */
export function recordStudyActivity(courseId: string, itemCount: number = 1): void {
  const state = storage.load();
  if (!state.studyActivity) state.studyActivity = [];
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const existingIndex = state.studyActivity.findIndex(
    a => a.courseId === courseId && a.date === today
  );
  
  if (existingIndex !== -1) {
    state.studyActivity[existingIndex].count += itemCount;
  } else {
    state.studyActivity.push({
      courseId,
      date: today,
      count: itemCount,
    });
  }
  
  // Update streak for this course
  updateStreak(courseId);
  
  storage.save(state);
}

/**
 * Get unique dates with activity for a course (sorted descending)
 */
function getActivityDates(courseId: string): string[] {
  const activities = getStudyActivity(courseId);
  const dateSet = new Set<string>();
  activities.forEach(a => {
    if (a.count > 0) {
      dateSet.add(a.date);
    }
  });
  return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
}

/**
 * Calculate streak based on consecutive days with activity
 * Streak counts consecutive days ending with today (if today has activity) or yesterday (if today doesn't)
 */
function calculateCurrentStreak(activityDates: string[]): number {
  if (activityDates.length === 0) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const dateSet = new Set(activityDates);
  
  // Determine the end date for the streak
  // If today has activity, streak ends today
  // If today doesn't but yesterday does, streak ends yesterday
  // Otherwise, streak is 0
  let endDate: Date;
  if (dateSet.has(todayStr)) {
    endDate = new Date(today);
  } else if (dateSet.has(yesterdayStr)) {
    endDate = new Date(yesterday);
  } else {
    return 0; // Most recent activity is older than yesterday, streak is broken
  }
  
  // Count consecutive days backwards from end date
  let streak = 0;
  const checkDate = new Date(endDate);
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dateSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Update streak for a course based on actual activity dates
 */
function updateStreak(courseId: string): void {
  const state = storage.load();
  if (!state.courseStreaks) state.courseStreaks = [];
  
  const activityDates = getActivityDates(courseId);
  const currentStreak = calculateCurrentStreak(activityDates);
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  let streak = state.courseStreaks.find(s => s.courseId === courseId);
  
  if (!streak) {
    streak = {
      courseId,
      currentStreak,
      longestStreak: currentStreak,
      lastStudied: activityDates.length > 0 ? activityDates[0] : todayStr,
    };
    state.courseStreaks.push(streak);
  } else {
    streak.currentStreak = currentStreak;
    streak.longestStreak = Math.max(streak.longestStreak, currentStreak);
    streak.lastStudied = activityDates.length > 0 ? activityDates[0] : todayStr;
  }
  
  storage.save(state);
}

/**
 * Get streak for a course (recalculates to ensure accuracy)
 */
export function getCourseStreak(courseId: string): CourseStreak | null {
  // Recalculate streak to ensure it's accurate
  const activityDates = getActivityDates(courseId);
  if (activityDates.length === 0) {
    return null;
  }
  
  const currentStreak = calculateCurrentStreak(activityDates);
  const state = storage.load();
  
  let streak = state.courseStreaks?.find(s => s.courseId === courseId);
  
  if (!streak) {
    // Create new streak entry
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    streak = {
      courseId,
      currentStreak,
      longestStreak: currentStreak,
      lastStudied: activityDates[0] || todayStr,
    };
    if (!state.courseStreaks) state.courseStreaks = [];
    state.courseStreaks.push(streak);
    storage.save(state);
  } else {
    // Update existing streak with recalculated values
    streak.currentStreak = currentStreak;
    streak.longestStreak = Math.max(streak.longestStreak, currentStreak);
    streak.lastStudied = activityDates[0] || streak.lastStudied;
    storage.save(state);
  }
  
  return streak;
}

/**
 * Get study activity for a course (last 365 days)
 */
export function getStudyActivity(courseId: string | null = null): StudyActivity[] {
  const state = storage.load();
  if (!state.studyActivity) return [];
  
  const filtered = courseId 
    ? state.studyActivity.filter(a => a.courseId === courseId)
    : state.studyActivity;
  
  // Sort by date descending
  return filtered.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get activity heatmap data (last 365 days)
 */
export function getActivityHeatmap(courseId: string | null = null): Map<string, number> {
  const activities = getStudyActivity(courseId);
  const heatmap = new Map<string, number>();
  
  activities.forEach(activity => {
    heatmap.set(activity.date, activity.count);
  });
  
  return heatmap;
}

/**
 * Check if user studied today
 */
export function studiedToday(courseId: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  const activities = getStudyActivity(courseId);
  return activities.some(a => a.date === today && a.count > 0);
}

/**
 * Get last 5 days activity status for a course
 * Returns an array of 5 booleans representing activity (oldest to newest)
 */
export function getLast5DaysActivity(courseId: string): boolean[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const activities = getStudyActivity(courseId);
  const dateSet = new Set<string>();
  activities.forEach(a => {
    if (a.count > 0) {
      dateSet.add(a.date);
    }
  });
  
  const last5Days: boolean[] = [];
  for (let i = 4; i >= 0; i--) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];
    last5Days.push(dateSet.has(dateStr));
  }
  
  return last5Days;
}

