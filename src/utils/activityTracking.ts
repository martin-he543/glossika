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
 * Update streak for a course
 */
function updateStreak(courseId: string): void {
  const state = storage.load();
  if (!state.courseStreaks) state.courseStreaks = [];
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  let streak = state.courseStreaks.find(s => s.courseId === courseId);
  
  if (!streak) {
    streak = {
      courseId,
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
 * Get streak for a course
 */
export function getCourseStreak(courseId: string): CourseStreak | null {
  const state = storage.load();
  if (!state.courseStreaks) return null;
  return state.courseStreaks.find(s => s.courseId === courseId) || null;
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

