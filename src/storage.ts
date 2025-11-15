import { AppState, Course, Word, CourseProgress, ClozeSentence, ClozeCourse, CharacterCourse, Kanji, Radical, Vocabulary, StudyActivity, CourseStreak } from './types';

const STORAGE_KEY = 'glossika_app_state';

export const storage = {
  load(): AppState {
    const defaultState: AppState = {
      courses: [],
      words: [],
      courseProgress: [],
      clozeSentences: [],
      clozeCourses: [],
      characterCourses: [],
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
        // Ensure all required arrays exist (for backward compatibility)
        return {
          courses: parsed.courses || [],
          words: parsed.words || [],
          courseProgress: parsed.courseProgress || [],
          clozeSentences: parsed.clozeSentences || [],
          clozeCourses: parsed.clozeCourses || [],
          characterCourses: parsed.characterCourses || [],
          kanji: parsed.kanji || [],
          radicals: parsed.radicals || [],
          vocabulary: parsed.vocabulary || [],
          studyActivity: parsed.studyActivity || [],
          courseStreaks: parsed.courseStreaks || [],
          currentCourseId: parsed.currentCourseId,
        };
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
    return defaultState;
  },

  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  },

  addCourse(course: Course): void {
    const state = this.load();
    if (!state.courses) state.courses = [];
    state.courses.push(course);
    this.save(state);
  },

  updateCourse(courseId: string, updates: Partial<Course>): void {
    const state = this.load();
    if (!state.courses) state.courses = [];
    const index = state.courses.findIndex(c => c.id === courseId);
    if (index !== -1) {
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
    state.clozeCourses.push(course);
    this.save(state);
  },

  updateClozeCourse(courseId: string, updates: Partial<ClozeCourse>): void {
    const state = this.load();
    if (!state.clozeCourses) state.clozeCourses = [];
    const index = state.clozeCourses.findIndex(c => c.id === courseId);
    if (index !== -1) {
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
      state.clozeSentences[index] = { ...state.clozeSentences[index], ...updates };
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
      state.kanji[index] = { ...state.kanji[index], ...updates };
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
    state.radicals.push(radical);
    this.save(state);
  },

  updateRadical(id: string, updates: Partial<Radical>): void {
    const state = this.load();
    if (!state.radicals) state.radicals = [];
    const index = state.radicals.findIndex(r => r.id === id);
    if (index !== -1) {
      state.radicals[index] = { ...state.radicals[index], ...updates };
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
    state.vocabulary.push(vocab);
    this.save(state);
  },

  updateVocabulary(id: string, updates: Partial<Vocabulary>): void {
    const state = this.load();
    if (!state.vocabulary) state.vocabulary = [];
    const index = state.vocabulary.findIndex(v => v.id === id);
    if (index !== -1) {
      state.vocabulary[index] = { ...state.vocabulary[index], ...updates };
      this.save(state);
    }
  },

  deleteVocabulary(id: string): void {
    const state = this.load();
    if (!state.vocabulary) state.vocabulary = [];
    state.vocabulary = state.vocabulary.filter(v => v.id !== id);
    this.save(state);
  },

  // CharacterCourse operations
  addCharacterCourse(course: CharacterCourse): void {
    const state = this.load();
    if (!state.characterCourses) state.characterCourses = [];
    state.characterCourses.push(course);
    this.save(state);
  },

  updateCharacterCourse(courseId: string, updates: Partial<CharacterCourse>): void {
    const state = this.load();
    if (!state.characterCourses) state.characterCourses = [];
    const index = state.characterCourses.findIndex(c => c.id === courseId);
    if (index !== -1) {
      state.characterCourses[index] = { ...state.characterCourses[index], ...updates };
      this.save(state);
    }
  },

  deleteCharacterCourse(courseId: string): void {
    const state = this.load();
    if (!state.characterCourses) state.characterCourses = [];
    if (!state.kanji) state.kanji = [];
    // Delete all kanji associated with this course (by language)
    const course = state.characterCourses.find(c => c.id === courseId);
    if (course) {
      state.kanji = state.kanji.filter(k => k.language !== course.language);
    }
    state.characterCourses = state.characterCourses.filter(c => c.id !== courseId);
    this.save(state);
  },
};

