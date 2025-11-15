import { PathCourse, PathLesson, PathExercise } from '../types';

// French vocabulary and phrases for demo course
const FRENCH_VOCAB = [
  // Lessons 1-10: Basics
  { en: 'hello', fr: 'bonjour', lesson: 1 },
  { en: 'goodbye', fr: 'au revoir', lesson: 1 },
  { en: 'yes', fr: 'oui', lesson: 1 },
  { en: 'no', fr: 'non', lesson: 1 },
  { en: 'please', fr: 's\'il vous plaît', lesson: 2 },
  { en: 'thank you', fr: 'merci', lesson: 2 },
  { en: 'you\'re welcome', fr: 'de rien', lesson: 2 },
  { en: 'excuse me', fr: 'excusez-moi', lesson: 2 },
  { en: 'I', fr: 'je', lesson: 3 },
  { en: 'you', fr: 'tu', lesson: 3 },
  { en: 'he', fr: 'il', lesson: 3 },
  { en: 'she', fr: 'elle', lesson: 3 },
  { en: 'we', fr: 'nous', lesson: 4 },
  { en: 'they', fr: 'ils', lesson: 4 },
  { en: 'to be', fr: 'être', lesson: 4 },
  { en: 'to have', fr: 'avoir', lesson: 4 },
  { en: 'good', fr: 'bon', lesson: 5 },
  { en: 'bad', fr: 'mauvais', lesson: 5 },
  { en: 'big', fr: 'grand', lesson: 5 },
  { en: 'small', fr: 'petit', lesson: 5 },
  { en: 'man', fr: 'homme', lesson: 6 },
  { en: 'woman', fr: 'femme', lesson: 6 },
  { en: 'boy', fr: 'garçon', lesson: 6 },
  { en: 'girl', fr: 'fille', lesson: 6 },
  { en: 'water', fr: 'eau', lesson: 7 },
  { en: 'bread', fr: 'pain', lesson: 7 },
  { en: 'milk', fr: 'lait', lesson: 7 },
  { en: 'coffee', fr: 'café', lesson: 7 },
  { en: 'one', fr: 'un', lesson: 8 },
  { en: 'two', fr: 'deux', lesson: 8 },
  { en: 'three', fr: 'trois', lesson: 8 },
  { en: 'four', fr: 'quatre', lesson: 8 },
  { en: 'five', fr: 'cinq', lesson: 9 },
  { en: 'six', fr: 'six', lesson: 9 },
  { en: 'seven', fr: 'sept', lesson: 9 },
  { en: 'eight', fr: 'huit', lesson: 9 },
  { en: 'nine', fr: 'neuf', lesson: 10 },
  { en: 'ten', fr: 'dix', lesson: 10 },
  { en: 'today', fr: 'aujourd\'hui', lesson: 10 },
  { en: 'tomorrow', fr: 'demain', lesson: 10 },
];

// Generate exercises for a lesson
function generateExercises(lessonNum: number, vocab: typeof FRENCH_VOCAB): PathExercise[] {
  const lessonVocab = vocab.filter(v => v.lesson === lessonNum);
  const exercises: PathExercise[] = [];

  // Translation exercises
  lessonVocab.forEach((word, idx) => {
    exercises.push({
      id: `ex-${lessonNum}-trans-${idx}`,
      type: 'translation',
      question: `Translate: "${word.en}"`,
      correctAnswer: word.fr,
      explanation: `"${word.en}" means "${word.fr}" in French.`,
    });
  });

  // Multiple choice exercises
  lessonVocab.forEach((word, idx) => {
    const otherWords = vocab.filter(v => v.lesson === lessonNum && v.fr !== word.fr).slice(0, 3);
    exercises.push({
      id: `ex-${lessonNum}-mc-${idx}`,
      type: 'multiple-choice',
      question: `What does "${word.fr}" mean?`,
      correctAnswer: word.en,
      options: [word.en, ...otherWords.map(w => w.en)].sort(() => Math.random() - 0.5),
      explanation: `"${word.fr}" means "${word.en}" in English.`,
    });
  });

  // Typing exercises (reverse translation)
  lessonVocab.slice(0, Math.min(3, lessonVocab.length)).forEach((word, idx) => {
    exercises.push({
      id: `ex-${lessonNum}-type-${idx}`,
      type: 'typing',
      question: `Type the French word for "${word.en}":`,
      correctAnswer: word.fr,
      hint: `Starts with "${word.fr[0].toUpperCase()}"`,
      explanation: `The French word for "${word.en}" is "${word.fr}".`,
    });
  });

  return exercises;
}

// Generate lesson titles
function getLessonTitle(lessonNum: number): string {
  const themes = [
    'Greetings', 'Politeness', 'Pronouns', 'Verbs', 'Adjectives',
    'People', 'Food & Drink', 'Numbers', 'Numbers Continued', 'Time',
    'Family', 'Colors', 'Animals', 'Body Parts', 'Clothing',
    'Weather', 'Days of Week', 'Months', 'Seasons', 'Directions',
    'At Home', 'In the Kitchen', 'In the Bedroom', 'In the Bathroom', 'Furniture',
    'Transportation', 'At School', 'At Work', 'Shopping', 'Restaurant',
    'Health', 'Sports', 'Hobbies', 'Music', 'Movies',
    'Technology', 'Travel', 'Nature', 'City', 'Countryside',
    'Emotions', 'Personality', 'Actions', 'Movement', 'Communication',
    'Questions', 'Answers', 'Opinions', 'Agreement', 'Disagreement',
    'Past Tense', 'Present Tense', 'Future Tense', 'Conditional', 'Subjunctive',
    'Complex Sentences', 'Connectors', 'Comparisons', 'Superlatives', 'Negation',
    'Possession', 'Location', 'Time Expressions', 'Frequency', 'Quantity',
    'Descriptions', 'Narratives', 'Conversations', 'Formal Speech', 'Informal Speech',
    'Idioms', 'Expressions', 'Proverbs', 'Culture', 'Traditions',
    'Business', 'Education', 'Science', 'Arts', 'Literature',
    'History', 'Geography', 'Politics', 'Economics', 'Society',
    'Advanced Grammar', 'Complex Verbs', 'Subjunctive Mood', 'Passive Voice', 'Reflexive Verbs',
    'Advanced Vocabulary', 'Academic Terms', 'Technical Terms', 'Medical Terms', 'Legal Terms',
    'Conversational French', 'Slang', 'Regional Variations', 'Formal Writing', 'Creative Writing',
  ];
  
  return themes[lessonNum - 1] || `Lesson ${lessonNum}`;
}

export function createDemoFrenchCourse(): { course: PathCourse; lessons: PathLesson[] } {
  const courseId = 'demo-french-course';
  const now = Date.now();

  const course: PathCourse = {
    id: courseId,
    name: 'French for English Speakers',
    nativeLanguage: 'english',
    targetLanguage: 'french',
    createdAt: now,
    isPublic: true,
    tags: ['french', 'beginner', 'demo'],
    description: 'Learn French from scratch with 100 interactive lessons. This demo course covers essential vocabulary, grammar, and phrases.',
    lessonCount: 100,
    author: 'Glossika',
    icon: '🇫🇷',
  };

  const lessons: PathLesson[] = [];

  // Generate 100 lessons
  for (let i = 1; i <= 100; i++) {
    // Get vocabulary for this lesson (cycle through available vocab)
    const lessonVocab = FRENCH_VOCAB.filter(v => v.lesson === ((i - 1) % 10) + 1);
    
    // Generate exercises
    const exercises = generateExercises(((i - 1) % 10) + 1, FRENCH_VOCAB);
    
    // Add more variety for later lessons
    if (i > 10) {
      // Add matching exercises
      if (lessonVocab.length >= 2) {
        exercises.push({
          id: `ex-${i}-match-1`,
          type: 'matching',
          question: 'Match the French words with their English translations:',
          correctAnswer: lessonVocab.slice(0, Math.min(4, lessonVocab.length)).map(v => v.fr),
          options: lessonVocab.slice(0, Math.min(4, lessonVocab.length)).map(v => v.en),
          explanation: 'Great job matching the words!',
        });
      }
    }

    lessons.push({
      id: `lesson-${courseId}-${i}`,
      courseId,
      lessonNumber: i,
      title: getLessonTitle(i),
      description: `Learn essential French vocabulary and phrases in lesson ${i}.`,
      exercises,
      unlocked: i === 1, // Only first lesson unlocked initially
      completed: false,
      xpReward: 10 + Math.floor(i / 10), // More XP for later lessons
      createdAt: now + i,
    });
  }

  return { course, lessons };
}

