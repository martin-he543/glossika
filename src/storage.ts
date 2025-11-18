import { AppState, Course, Word, CourseProgress, ClozeSentence, ClozeCourse, Kanji, Radical, Vocabulary, StudyActivity, CourseStreak } from './types';
import { migrateRadical, migrateKanji, migrateVocabulary, migrateSRSStage } from './utils/srsStageMigration';

const STORAGE_KEY = 'glossika_app_state';

export const storage = {
  /**
   * Get current storage size in MB
   */
  async getStorageSize(): Promise<{ used: number; usedMB: string; quota?: number; quotaMB?: string }> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const used = data ? new Blob([data]).size : 0;
      const usedMB = (used / (1024 * 1024)).toFixed(2);
      
      // Try to get quota (this varies by browser)
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          const quota = estimate.quota || undefined;
          const quotaMB = quota ? (quota / (1024 * 1024)).toFixed(2) : undefined;
          return { used, usedMB, quota, quotaMB };
        } catch (e) {
          // Fallback if estimate fails
          return { used, usedMB };
        }
      }
      
      return { used, usedMB };
    } catch (e) {
      console.error('Failed to get storage size:', e);
      return { used: 0, usedMB: '0.00' };
    }
  },
  
  getStorageSizeSync(): { used: number; usedMB: string } {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const used = data ? new Blob([data]).size : 0;
      const usedMB = (used / (1024 * 1024)).toFixed(2);
      return { used, usedMB };
    } catch (e) {
      console.error('Failed to get storage size:', e);
      return { used: 0, usedMB: '0.00' };
    }
  },

  /**
   * Clear old study activity data to free up space
   * Keeps only the most recent N activities
   */
  clearOldStudyActivity(keepRecent: number = 1000): { removed: number; freedMB: string } {
    const state = this.load();
    const activities = state.studyActivity || [];
    
    if (activities.length <= keepRecent) {
      return { removed: 0, freedMB: '0.00' };
    }
    
    // Sort by date (newest first) and keep only recent ones
    const sorted = [...activities].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const toKeep = sorted.slice(0, keepRecent);
    const toRemove = activities.length - toKeep.length;
    
    // Calculate size of data to be removed
    const removedData = activities.filter(a => !toKeep.includes(a));
    const removedSize = new Blob([JSON.stringify(removedData)]).size;
    const freedMB = (removedSize / (1024 * 1024)).toFixed(2);
    
    state.studyActivity = toKeep;
    this.save(state);
    
    return { removed: toRemove, freedMB };
  },

  /**
   * Clear unused courses (courses with no progress)
   */
  clearUnusedCourses(): { removed: number; freedMB: string } {
    const state = this.load();
    const courses = state.courses || [];
    const progress = state.courseProgress || [];
    const words = state.words || [];
    
    const coursesWithProgress = new Set(progress.map(p => p.courseId));
    const coursesWithWords = new Set(words.map(w => w.courseId));
    
    const unusedCourses = courses.filter(c => 
      !coursesWithProgress.has(c.id) && !coursesWithWords.has(c.id)
    );
    
    if (unusedCourses.length === 0) {
      return { removed: 0, freedMB: '0.00' };
    }
    
    const removedSize = new Blob([JSON.stringify(unusedCourses)]).size;
    const freedMB = (removedSize / (1024 * 1024)).toFixed(2);
    
    // Remove unused courses and their associated words
    const unusedCourseIds = new Set(unusedCourses.map(c => c.id));
    state.courses = courses.filter(c => !unusedCourseIds.has(c.id));
    state.words = words.filter(w => !unusedCourseIds.has(w.courseId));
    
    this.save(state);
    
    return { removed: unusedCourses.length, freedMB };
  },

  /**
   * Optimize storage by removing duplicate words and cleaning up
   */
  optimizeStorage(): { removed: number; freedMB: string } {
    const state = this.load();
    const words = state.words || [];
    const originalSize = JSON.stringify(state).length;
    
    // Remove duplicate words (same native+target+courseId)
    const seen = new Map<string, Word>();
    const uniqueWords: Word[] = [];
    let duplicates = 0;
    
    for (const word of words) {
      const key = `${word.courseId}:${word.native.toLowerCase()}:${word.target.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, word);
        uniqueWords.push(word);
      } else {
        duplicates++;
      }
    }
    
    state.words = uniqueWords;
    
    // Update course word counts
    for (const course of state.courses || []) {
      const courseWords = uniqueWords.filter(w => w.courseId === course.id);
      course.wordCount = courseWords.length;
    }
    
    this.save(state);
    
    const newSize = JSON.stringify(state).length;
    const freed = originalSize - newSize;
    const freedMB = (freed / (1024 * 1024)).toFixed(2);
    
    return { removed: duplicates, freedMB };
  },

  load(): AppState {
    const defaultState: AppState = {
      courses: [],
      words: [],
      courseProgress: [],
      clozeSentences: [],
      clozeCourses: [],
      kanji: [],
      radicals: [],
      vocabulary: [],
      studyActivity: [],
      courseStreaks: [],
    };

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        
        // Migrate old SRS stage names to new plant-based stages
        const originalKanji = parsed.kanji || [];
        const originalRadicals = parsed.radicals || [];
        const originalVocabulary = parsed.vocabulary || [];
        
        const migratedKanji = originalKanji.map((k: any) => migrateKanji(k));
        const migratedRadicals = originalRadicals.map((r: any) => migrateRadical(r));
        const migratedVocabulary = originalVocabulary.map((v: any) => migrateVocabulary(v));
        
        // Check if any migrations occurred by comparing original vs migrated
        let needsSave = false;
        for (let i = 0; i < originalKanji.length; i++) {
          if (originalKanji[i]?.srsStage !== migratedKanji[i]?.srsStage) {
            needsSave = true;
            break;
          }
        }
        if (!needsSave) {
          for (let i = 0; i < originalRadicals.length; i++) {
            if (originalRadicals[i]?.srsStage !== migratedRadicals[i]?.srsStage) {
              needsSave = true;
              break;
            }
          }
        }
        if (!needsSave) {
          for (let i = 0; i < originalVocabulary.length; i++) {
            if (originalVocabulary[i]?.srsStage !== migratedVocabulary[i]?.srsStage) {
              needsSave = true;
              break;
            }
          }
        }
        
        const state = {
          courses: parsed.courses || [],
          words: parsed.words || [],
          courseProgress: parsed.courseProgress || [],
          clozeSentences: parsed.clozeSentences || [],
          clozeCourses: parsed.clozeCourses || [],
          kanji: migratedKanji,
          radicals: migratedRadicals,
          vocabulary: migratedVocabulary,
          studyActivity: parsed.studyActivity || [],
          courseStreaks: parsed.courseStreaks || [],
          currentCourseId: parsed.currentCourseId,
        };
        
        if (needsSave) {
          this.save(state);
        }
        
        return state;
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
    return defaultState;
  },

  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e: any) {
      console.error('Failed to save state:', e);
      // If quota exceeded, try to provide helpful error message
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        const stateSize = JSON.stringify(state).length;
        const mbSize = (stateSize / (1024 * 1024)).toFixed(2);
        throw new Error(`Storage quota exceeded. Total data size: ${mbSize} MB. Please clear some data or use a browser with more storage capacity.`);
      }
      throw e;
    }
  },

  addCourse(course: Course): void {
    const state = this.load();
    if (!state.courses) state.courses = [];
    
    // Check for duplicate course name across all course types
    const existingNames = [
      ...state.courses.map(c => c.name.toLowerCase().trim()),
      ...(state.clozeCourses || []).map(c => c.name.toLowerCase().trim())
    ];
    
    if (existingNames.includes(course.name.toLowerCase().trim())) {
      throw new Error(`A course with the name "${course.name}" already exists. Course names must be unique.`);
    }
    
    state.courses.push(course);
    this.save(state);
  },

  updateCourse(courseId: string, updates: Partial<Course>): void {
    const state = this.load();
    if (!state.courses) state.courses = [];
    const index = state.courses.findIndex(c => c.id === courseId);
    if (index !== -1) {
      // If updating name, check for duplicates
      if (updates.name) {
        const existingNames = [
          ...state.courses.filter(c => c.id !== courseId).map(c => c.name.toLowerCase().trim()),
          ...(state.clozeCourses || []).map(c => c.name.toLowerCase().trim())
        ];
        
        if (existingNames.includes(updates.name.toLowerCase().trim())) {
          throw new Error(`A course with the name "${updates.name}" already exists. Course names must be unique.`);
        }
      }
      
      state.courses[index] = { ...state.courses[index], ...updates };
      this.save(state);
    }
  },

  deleteCourse(courseId: string): void {
    const state = this.load();
    if (!state.courses) state.courses = [];
    if (!state.words) state.words = [];
    if (!state.courseProgress) state.courseProgress = [];
    state.courses = state.courses.filter(c => c.id !== courseId);
    state.words = state.words.filter(w => w.courseId !== courseId);
    state.courseProgress = state.courseProgress.filter(p => p.courseId !== courseId);
    this.save(state);
  },

  addWords(newWords: Word[]): void {
    const state = this.load();
    if (!state.words) state.words = [];
    
    // Check storage size before adding
    const currentSize = JSON.stringify(state).length;
    const newWordsSize = JSON.stringify(newWords).length;
    const estimatedNewSize = currentSize + newWordsSize;
    const estimatedNewSizeMB = estimatedNewSize / (1024 * 1024);
    
    // Warn if approaching quota (5MB is typical limit)
    if (estimatedNewSizeMB > 4.5) {
      console.warn(`Storage size will be ~${estimatedNewSizeMB.toFixed(2)} MB after adding ${newWords.length} words`);
    }
    
    state.words.push(...newWords);
    this.save(state);
  },

  updateWord(wordId: string, updates: Partial<Word>): void {
    const state = this.load();
    if (!state.words) state.words = [];
    const index = state.words.findIndex(w => w.id === wordId);
    if (index !== -1) {
      state.words[index] = { ...state.words[index], ...updates };
      this.save(state);
    }
  },

  getWordsByCourse(courseId: string): Word[] {
    const state = this.load();
    if (!state.words) return [];
    return state.words.filter(w => w.courseId === courseId);
  },

  updateProgress(courseId: string, updates: Partial<CourseProgress>): void {
    const state = this.load();
    if (!state.courseProgress) state.courseProgress = [];
    let progress = state.courseProgress.find(p => p.courseId === courseId);
    if (!progress) {
      progress = { courseId, wordsLearned: 0, wordsMastered: 0, totalReviews: 0 };
      state.courseProgress.push(progress);
    }
    Object.assign(progress, updates);
    this.save(state);
  },

  addClozeSentence(sentence: ClozeSentence): void {
    const state = this.load();
    if (!state.clozeSentences) state.clozeSentences = [];
    state.clozeSentences.push(sentence);
    this.save(state);
  },

  addClozeCourse(course: ClozeCourse): void {
    const state = this.load();
    if (!state.clozeCourses) state.clozeCourses = [];
    
    // Check for duplicate course name across all course types
    const existingNames = [
      ...(state.courses || []).map(c => c.name.toLowerCase().trim()),
      ...state.clozeCourses.map(c => c.name.toLowerCase().trim())
    ];
    
    if (existingNames.includes(course.name.toLowerCase().trim())) {
      throw new Error(`A course with the name "${course.name}" already exists. Course names must be unique.`);
    }
    
    state.clozeCourses.push(course);
    this.save(state);
  },

  updateClozeCourse(courseId: string, updates: Partial<ClozeCourse>): void {
    const state = this.load();
    if (!state.clozeCourses) state.clozeCourses = [];
    const index = state.clozeCourses.findIndex(c => c.id === courseId);
    if (index !== -1) {
      // If updating name, check for duplicates
      if (updates.name) {
        const existingNames = [
          ...(state.courses || []).map(c => c.name.toLowerCase().trim()),
          ...state.clozeCourses.filter(c => c.id !== courseId).map(c => c.name.toLowerCase().trim())
        ];
        
        if (existingNames.includes(updates.name.toLowerCase().trim())) {
          throw new Error(`A course with the name "${updates.name}" already exists. Course names must be unique.`);
        }
      }
      
      state.clozeCourses[index] = { ...state.clozeCourses[index], ...updates };
      this.save(state);
    }
  },

  deleteClozeCourse(courseId: string): void {
    const state = this.load();
    if (!state.clozeCourses) state.clozeCourses = [];
    if (!state.clozeSentences) state.clozeSentences = [];
    state.clozeCourses = state.clozeCourses.filter(c => c.id !== courseId);
    state.clozeSentences = state.clozeSentences.filter(s => s.courseId !== courseId);
    this.save(state);
  },

  updateClozeSentence(id: string, updates: Partial<ClozeSentence>): void {
    const state = this.load();
    if (!state.clozeSentences) state.clozeSentences = [];
    const index = state.clozeSentences.findIndex(s => s.id === id);
    if (index !== -1) {
      const sentence = state.clozeSentences[index];
      // Backward compatibility: if masteryLevel is a number, convert to string
      if (typeof sentence.masteryLevel === 'number') {
        const numLevel = sentence.masteryLevel;
        const masteryMap: Record<number, 'seed' | 'sprout' | 'seedling' | 'plant' | 'tree'> = {
          0: 'seed',
          1: 'sprout',
          2: 'sprout',
          3: 'seedling',
          4: 'plant',
          5: 'tree',
        };
        sentence.masteryLevel = masteryMap[Math.min(numLevel, 5)] || 'seed';
        sentence.srsLevel = sentence.srsLevel || numLevel;
      }
      state.clozeSentences[index] = { ...sentence, ...updates };
      this.save(state);
    }
  },

  deleteClozeSentence(id: string): void {
    const state = this.load();
    if (!state.clozeSentences) state.clozeSentences = [];
    state.clozeSentences = state.clozeSentences.filter(s => s.id !== id);
    this.save(state);
  },

  addKanji(kanji: Kanji): void {
    const state = this.load();
    if (!state.kanji) state.kanji = [];
    state.kanji.push(kanji);
    this.save(state);
  },

  addKanjiBatch(kanjiArray: Kanji[]): void {
    if (kanjiArray.length === 0) return;
    const state = this.load();
    if (!state.kanji) state.kanji = [];
    state.kanji.push(...kanjiArray);
    this.save(state);
  },

  updateKanji(id: string, updates: Partial<Kanji>): void {
    const state = this.load();
    if (!state.kanji) state.kanji = [];
    const index = state.kanji.findIndex(k => k.id === id);
    if (index !== -1) {
      const kanji = state.kanji[index];
      // Migrate old stage names if present
      const migratedKanji = migrateKanji(kanji);
      // Migrate updates if they contain old stage names
      const migratedUpdates = updates.srsStage ? { ...updates, srsStage: migrateSRSStage(updates.srsStage as string) } : updates;
      state.kanji[index] = { ...migratedKanji, ...migratedUpdates };
      this.save(state);
    }
  },

  deleteKanji(id: string): void {
    const state = this.load();
    if (!state.kanji) state.kanji = [];
    state.kanji = state.kanji.filter(k => k.id !== id);
    this.save(state);
  },

  // Radical operations
  addRadical(radical: Radical): void {
    const state = this.load();
    if (!state.radicals) state.radicals = [];
    // Migrate old stage names
    const migratedRadical = migrateRadical(radical);
    state.radicals.push(migratedRadical);
    this.save(state);
  },

  updateRadical(id: string, updates: Partial<Radical>): void {
    const state = this.load();
    if (!state.radicals) state.radicals = [];
    const index = state.radicals.findIndex(r => r.id === id);
    if (index !== -1) {
      const radical = state.radicals[index];
      // Migrate old stage names if present
      const migratedRadical = migrateRadical(radical);
      // Migrate updates if they contain old stage names
      const migratedUpdates = updates.srsStage ? { ...updates, srsStage: migrateSRSStage(updates.srsStage as string) } : updates;
      state.radicals[index] = { ...migratedRadical, ...migratedUpdates };
      this.save(state);
    }
  },

  deleteRadical(id: string): void {
    const state = this.load();
    if (!state.radicals) state.radicals = [];
    state.radicals = state.radicals.filter(r => r.id !== id);
    this.save(state);
  },

  // Vocabulary operations
  addVocabulary(vocab: Vocabulary): void {
    const state = this.load();
    if (!state.vocabulary) state.vocabulary = [];
    // Migrate old stage names
    const migratedVocab = migrateVocabulary(vocab);
    state.vocabulary.push(migratedVocab);
    this.save(state);
  },

  updateVocabulary(id: string, updates: Partial<Vocabulary>): void {
    const state = this.load();
    if (!state.vocabulary) state.vocabulary = [];
    const index = state.vocabulary.findIndex(v => v.id === id);
    if (index !== -1) {
      const vocab = state.vocabulary[index];
      // Migrate old stage names if present
      const migratedVocab = migrateVocabulary(vocab);
      // Migrate updates if they contain old stage names
      const migratedUpdates = updates.srsStage ? { ...updates, srsStage: migrateSRSStage(updates.srsStage as string) } : updates;
      state.vocabulary[index] = { ...migratedVocab, ...migratedUpdates };
      this.save(state);
    }
  },

  deleteVocabulary(id: string): void {
    const state = this.load();
    if (!state.vocabulary) state.vocabulary = [];
    state.vocabulary = state.vocabulary.filter(v => v.id !== id);
    this.save(state);
  },

};

