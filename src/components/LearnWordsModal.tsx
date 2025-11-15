import { useState, useEffect, useCallback, useRef } from 'react';
import { Word } from '../types';
import { storage } from '../storage';
import { updateSRSLevel, getMasteryLevel, calculateNextReview, getWordsDueForReview } from '../utils/srs';
import { leaderboard } from '../utils/leaderboard';
import { speakText, stopSpeech } from '../utils/tts';
import { recordStudyActivity } from '../utils/activityTracking';
import KeyboardShortcuts from './KeyboardShortcuts';
import QuestionCountSelector from './QuestionCountSelector';
import LessonSummary from './LessonSummary';

interface LearnWordsModalProps {
  courseId: string;
  words: Word[];
  course?: { nativeLanguage: string; targetLanguage: string };
  onClose: () => void;
  onUpdate: () => void;
  mode: 'learn' | 'review' | 'speed' | 'flashcards' | 'difficult';
}

export default function LearnWordsModal({ 
  courseId, 
  words, 
  course,
  onClose, 
  onUpdate,
  mode 
}: LearnWordsModalProps) {
  const [showIntroduction, setShowIntroduction] = useState(false);
  const [introductionWord, setIntroductionWord] = useState<Word | null>(null);
  const [modeType, setModeType] = useState<'multiple' | 'type'>('multiple');
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [direction, setDirection] = useState<'native-to-target' | 'target-to-native'>('native-to-target');
  const [showQuestionSelector, setShowQuestionSelector] = useState(true);
  const [questionCount, setQuestionCount] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [newWordsLearned, setNewWordsLearned] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Track learning progress for new words (Memrise-style: require multiple correct answers)
  const [wordLearningProgress, setWordLearningProgress] = useState<Map<string, { correct: number; total: number; lastSeen: number }>>(new Map());
  const REQUIRED_CORRECT_ANSWERS = 3; // Number of correct answers needed before word is "learnt"
  
  // Speed Review specific state
  const [isActive, setIsActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeMinutes, setTimeMinutes] = useState(5);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  
  // Flashcard specific state
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardWords, setFlashcardWords] = useState<Word[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState<'due' | 'all'>('due');
  const [audioPlaying, setAudioPlaying] = useState(false);
  
  // Play audio for target language using improved TTS
  const playAudio = useCallback((word?: Word) => {
    const wordToPlay = word || currentWord;
    if (!wordToPlay || audioPlaying) return;
    
    const targetText = wordToPlay.target;
    const targetLang = course?.targetLanguage || 'english';
    
    setAudioPlaying(true);
    speakText(
      targetText,
      targetLang,
      () => setAudioPlaying(false),
      () => setAudioPlaying(false)
    );
  }, [currentWord, course?.targetLanguage, audioPlaying]);

  // Cleanup: stop speech when component unmounts or word changes
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [currentWord]);

  // Get words based on mode
  const getWordsForMode = useCallback(() => {
    switch (mode) {
      case 'learn':
        return words.filter(w => w.srsLevel === 0);
      case 'review':
        return words.filter(w => w.srsLevel > 0);
      case 'difficult':
        return words.filter(w => w.isDifficult || w.wrongCount > w.correctCount);
      case 'speed':
        return words.filter(w => w.srsLevel > 0);
      case 'flashcards':
        // For flashcards, we'll load separately
        return words;
      default:
        return words.filter(w => w.srsLevel > 0);
    }
  }, [words, mode]);

  const availableWords = getWordsForMode();

  // Speed Review timer effect
  useEffect(() => {
    if (mode === 'speed' && isActive && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (mode === 'speed' && isActive && countdown === 0 && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        if (timeLeft === 1) {
          endSpeedSession();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mode, isActive, countdown, timeLeft]);

  useEffect(() => {
    if (mode === 'speed' && isActive && countdown === 0 && availableWords.length > 0) {
      if (!currentWord) {
        loadNextWord();
      }
    } else if (mode === 'flashcards' && !showQuestionSelector && !showSummary) {
      if (flashcardWords.length === 0) {
        loadFlashcards();
      }
    } else if (mode !== 'speed' && mode !== 'flashcards' && !showQuestionSelector && !showSummary && availableWords.length > 0 && questionCount > 0) {
      if (!currentWord && !showIntroduction) {
        loadNextWord();
      }
    }
  }, [mode, modeType, direction, showQuestionSelector, showSummary, questionCount, availableWords.length, isActive, countdown, flashcardWords.length]);

  useEffect(() => {
    if (mode === 'flashcards') {
      setIsFlipped(false);
    }
  }, [mode, flashcardIndex]);

  const loadNextWord = () => {
    if (mode === 'learn') {
      // Get words that have been introduced (in progress map)
      const introducedWords = Array.from(wordLearningProgress.keys());
      
      // Limit to questionCount unique words
      if (introducedWords.length >= questionCount) {
        // Only cycle through the introduced words that need more practice
        const wordsInProgress = availableWords.filter(w => {
          const progress = wordLearningProgress.get(w.id);
          // Word is in progress if it has been introduced but hasn't reached the required correct answers
          return progress && progress.correct < REQUIRED_CORRECT_ANSWERS;
        });
        
        // If all introduced words are fully learnt, end the session
        if (wordsInProgress.length === 0 && introducedWords.length > 0) {
          // All words have been answered correctly enough times, mark them as learnt
          const allLearnt = Array.from(wordLearningProgress.entries())
            .filter(([_, progress]) => progress.correct >= REQUIRED_CORRECT_ANSWERS)
            .map(([wordId]) => wordId);
          
          // Update words to srsLevel 1 (learnt)
          allLearnt.forEach(wordId => {
            const word = words.find(w => w.id === wordId);
            if (word && word.srsLevel === 0) {
              storage.updateWord(wordId, { srsLevel: 1 });
            }
          });
          
          onUpdate();
          setShowSummary(true);
          return;
        }
        
        // If no words in progress but we have introduced words, check if they're all fully learnt
        if (wordsInProgress.length === 0 && introducedWords.length > 0) {
          // Check if all introduced words have reached the required correct answers
          const allFullyLearnt = introducedWords.every(wordId => {
            const progress = wordLearningProgress.get(wordId);
            return progress && progress.correct >= REQUIRED_CORRECT_ANSWERS;
          });
          
          if (allFullyLearnt) {
            // All words have been answered correctly enough times, mark them as learnt
            const allLearnt = introducedWords;
            
            // Update words to srsLevel 1 (learnt)
            allLearnt.forEach(wordId => {
              const word = words.find(w => w.id === wordId);
              if (word && word.srsLevel === 0) {
                storage.updateWord(wordId, { srsLevel: 1 });
              }
            });
            
            onUpdate();
            setShowSummary(true);
            return;
          }
          
          // If not all fully learnt, there might be words that haven't been answered yet
          // Find words that have been introduced but haven't been answered enough times
          const wordsNeedingMoreAnswers = availableWords.filter(w => {
            const progress = wordLearningProgress.get(w.id);
            return progress && progress.correct < REQUIRED_CORRECT_ANSWERS;
          });
          
          if (wordsNeedingMoreAnswers.length > 0) {
            const word = wordsNeedingMoreAnswers[Math.floor(Math.random() * wordsNeedingMoreAnswers.length)];
            setCurrentWord(word);
            setSelectedAnswer('');
            setUserInput('');
            setFeedback(null);
            
            if (modeType === 'multiple') {
              generateOptions(word);
            }
            
            setShowIntroduction(false);
            if (inputRef.current && modeType === 'type') {
              setTimeout(() => inputRef.current?.focus(), 100);
            }
            return;
          }
        }
        
        // Select from words in progress
        if (wordsInProgress.length > 0) {
          const word = wordsInProgress[Math.floor(Math.random() * wordsInProgress.length)];
          setCurrentWord(word);
          setSelectedAnswer('');
          setUserInput('');
          setFeedback(null);

          if (modeType === 'multiple') {
            generateOptions(word);
          }

          setShowIntroduction(false);
          if (inputRef.current && modeType === 'type') {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
          return;
        }
      }
      
      // Still need to introduce more words (up to questionCount)
      const wordsNotIntroduced = availableWords.filter(w => !wordLearningProgress.has(w.id));
      
      if (wordsNotIntroduced.length === 0) {
        // No more new words to introduce, cycle through existing ones
        const wordsInProgress = availableWords.filter(w => {
          const progress = wordLearningProgress.get(w.id);
          return progress && progress.correct < REQUIRED_CORRECT_ANSWERS;
        });
        
        if (wordsInProgress.length === 0 && introducedWords.length > 0) {
          // All words are fully learnt
          const allLearnt = Array.from(wordLearningProgress.entries())
            .filter(([_, progress]) => progress.correct >= REQUIRED_CORRECT_ANSWERS)
            .map(([wordId]) => wordId);
          
          allLearnt.forEach(wordId => {
            const word = words.find(w => w.id === wordId);
            if (word && word.srsLevel === 0) {
              storage.updateWord(wordId, { srsLevel: 1 });
            }
          });
          
          onUpdate();
          setShowSummary(true);
          return;
        }
        
        if (wordsInProgress.length > 0) {
          const word = wordsInProgress[Math.floor(Math.random() * wordsInProgress.length)];
          setCurrentWord(word);
          setSelectedAnswer('');
          setUserInput('');
          setFeedback(null);

          if (modeType === 'multiple') {
            generateOptions(word);
          }

          setShowIntroduction(false);
          if (inputRef.current && modeType === 'type') {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
          return;
        }
      }
      
      // Introduce a new word
      const word = wordsNotIntroduced[Math.floor(Math.random() * wordsNotIntroduced.length)];
      
      // Initialize word in progress map when introducing it
      if (!wordLearningProgress.has(word.id)) {
        setWordLearningProgress(prev => {
          const updated = new Map(prev);
          updated.set(word.id, { correct: 0, total: 0, lastSeen: Date.now() });
          return updated;
        });
      }
      
      setCurrentWord(word);
      setSelectedAnswer('');
      setUserInput('');
      setFeedback(null);

      if (modeType === 'multiple') {
        generateOptions(word);
      }

      // Show introduction for new words
      setIntroductionWord(word);
      setShowIntroduction(true);
      return;
    }
    
    // For other modes, use original logic
    if (availableWords.length === 0) {
      if (mode === 'speed') {
        endSpeedSession();
      } else {
        setShowSummary(true);
      }
      return;
    }

    const word = availableWords[Math.floor(Math.random() * availableWords.length)];
    setCurrentWord(word);
    setSelectedAnswer('');
    setUserInput('');
    setFeedback(null);

    if (mode === 'speed' || modeType === 'multiple') {
      generateOptions(word);
    }

    setShowIntroduction(false);
    if (inputRef.current && modeType === 'type' && mode !== 'speed') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const generateOptions = (word: Word) => {
    const correctAnswer = direction === 'native-to-target' ? word.target : word.native;
    const otherWords = availableWords
      .filter(w => w.id !== word.id)
      .map(w => direction === 'native-to-target' ? w.target : w.native)
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .slice(0, 3);

    const allOptions = [correctAnswer, ...otherWords].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
  };

  const handleMultipleChoice = (answer: string) => {
    if (mode === 'speed') {
      if (selectedAnswer) return;
      const correctAnswer = direction === 'native-to-target' ? currentWord!.target : currentWord!.native;
      const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      setSelectedAnswer(answer);
      
      // Play audio only when correct answer and direction is native-to-target
      if (isCorrect && direction === 'native-to-target') {
        setTimeout(() => {
          playAudio();
        }, 100);
      }
      
      updateWordProgress(isCorrect);
      
      // Auto-advance in speed mode
      setTimeout(() => {
        loadNextWord();
      }, isCorrect ? 300 : 1000);
      return;
    }

    if (feedback) return;

    setSelectedAnswer(answer);
    const correctAnswer = direction === 'native-to-target' ? currentWord!.target : currentWord!.native;
    const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    // Play audio only when correct answer and direction is native-to-target
    if (isCorrect && direction === 'native-to-target') {
      setTimeout(() => {
        playAudio();
      }, 300);
    }

    updateWordProgress(isCorrect);
  };

  const handleTypeAnswer = () => {
    if (feedback || !userInput.trim()) return;

    const correctAnswer = direction === 'native-to-target' 
      ? currentWord!.target 
      : currentWord!.native;

    const isCorrect = userInput.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    
    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    // Play audio only when correct answer and direction is native-to-target
    if (isCorrect && direction === 'native-to-target') {
      setTimeout(() => {
        playAudio();
      }, 300);
    }

    updateWordProgress(isCorrect);
  };

  const updateWordProgress = (isCorrect: boolean) => {
    if (!currentWord) return;

    if (mode === 'speed') {
      // Speed review uses different logic
      const difficulty = isCorrect ? 'easy' : 'hard';
      const newSrsLevel = updateSRSLevel(currentWord, difficulty);
      const newMasteryLevel = getMasteryLevel(newSrsLevel);
      const nextReview = calculateNextReview(currentWord, difficulty);

      storage.updateWord(currentWord.id, {
        srsLevel: newSrsLevel,
        masteryLevel: newMasteryLevel,
        correctCount: currentWord.correctCount + (isCorrect ? 1 : 0),
        wrongCount: currentWord.wrongCount + (isCorrect ? 0 : 1),
        nextReview,
        lastReviewed: Date.now(),
      });

      leaderboard.awardSpeedReviewXP(courseId);
      recordStudyActivity(courseId, 1);
      setTotal(prev => prev + 1);
      if (isCorrect) {
        setScore(prev => prev + 1);
      }
      onUpdate();
      return;
    }

    if (mode === 'learn' && currentWord.srsLevel === 0) {
      // Memrise-style learning: require multiple correct answers before marking as learnt
      const currentProgress = wordLearningProgress.get(currentWord.id) || { correct: 0, total: 0, lastSeen: 0 };
      const newProgress = {
        correct: isCorrect ? currentProgress.correct + 1 : currentProgress.correct,
        total: currentProgress.total + 1,
        lastSeen: Date.now(),
      };
      
      setWordLearningProgress(prev => {
        const updated = new Map(prev);
        updated.set(currentWord.id, newProgress);
        return updated;
      });

      // Update word stats (but don't mark as learnt yet)
      storage.updateWord(currentWord.id, {
        correctCount: currentWord.correctCount + (isCorrect ? 1 : 0),
        wrongCount: currentWord.wrongCount + (isCorrect ? 0 : 1),
        lastReviewed: Date.now(),
      });

      // Only mark as learnt after REQUIRED_CORRECT_ANSWERS correct answers
      if (newProgress.correct >= REQUIRED_CORRECT_ANSWERS) {
        const newSrsLevel = 1;
        const newMasteryLevel = getMasteryLevel(newSrsLevel);
        const nextReview = calculateNextReview(
          { ...currentWord, srsLevel: newSrsLevel },
          'medium'
        );

        storage.updateWord(currentWord.id, {
          srsLevel: newSrsLevel,
          masteryLevel: newMasteryLevel,
          nextReview,
        });

        setNewWordsLearned(prev => prev + 1);
        leaderboard.awardWordXP(courseId, newSrsLevel);
      }

      recordStudyActivity(courseId, 1);
      setCorrectCount(prev => prev + (isCorrect ? 1 : 0));
      setQuestionsAnswered(prev => prev + 1);
      onUpdate();
      return;
    }

    // For review mode and other modes
    const wasNew = currentWord.srsLevel === 0;
    const newSrsLevel = isCorrect ? 1 : 0;
    const newMasteryLevel = getMasteryLevel(newSrsLevel);
    const nextReview = calculateNextReview(
      { ...currentWord, srsLevel: newSrsLevel },
      isCorrect ? 'medium' : 'impossible'
    );

    storage.updateWord(currentWord.id, {
      srsLevel: newSrsLevel,
      masteryLevel: newMasteryLevel,
      correctCount: currentWord.correctCount + (isCorrect ? 1 : 0),
      wrongCount: currentWord.wrongCount + (isCorrect ? 0 : 1),
      nextReview,
      lastReviewed: Date.now(),
    });

    if (wasNew && isCorrect) {
      setNewWordsLearned(prev => prev + 1);
      leaderboard.awardWordXP(courseId, newSrsLevel);
    } else if (!wasNew) {
      leaderboard.awardReviewXP(courseId, currentWord.srsLevel);
    }

    recordStudyActivity(courseId, 1);
    setCorrectCount(prev => prev + (isCorrect ? 1 : 0));
    setQuestionsAnswered(prev => prev + 1);

    onUpdate();
  };

  const handleNext = useCallback(() => {
    if (mode === 'speed') {
      // Speed review auto-advances, no manual next
      return;
    }
    if (feedback) {
      if (mode === 'learn') {
        // For learn mode, continue until all words are learnt (no question limit)
        loadNextWord();
        setTimeout(() => {
          if (inputRef.current && modeType === 'type') {
            inputRef.current.focus();
          }
        }, 100);
      } else if (questionsAnswered >= questionCount) {
        setShowSummary(true);
      } else {
        loadNextWord();
        setTimeout(() => {
          if (inputRef.current && modeType === 'type') {
            inputRef.current.focus();
          }
        }, 100);
      }
    }
  }, [mode, feedback, questionsAnswered, questionCount, modeType]);

  const startSpeedSession = () => {
    if (availableWords.length === 0) {
      alert('No words available for speed review. Learn some words first!');
      return;
    }
    setCountdown(3);
    setTimeLeft(timeMinutes * 60);
    setScore(0);
    setTotal(0);
    setIsActive(true);
    setShowQuestionSelector(false);
  };

  const endSpeedSession = () => {
    setIsActive(false);
    setCurrentWord(null);
    setShowSummary(true);
  };

  const handleStart = (count: number) => {
    if (mode === 'speed') {
      startSpeedSession();
      return;
    }
    if (mode === 'flashcards') {
      setShowQuestionSelector(false); // Hide selector for flashcards
      loadFlashcards();
      return;
    }
    setQuestionCount(count);
    setShowQuestionSelector(false);
    setStartTime(Date.now());
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewWordsLearned(0);
    setWordLearningProgress(new Map()); // Reset learning progress for new session
    if (availableWords.length > 0) {
      loadNextWord();
    }
  };

  const handleSummaryClose = () => {
    setShowSummary(false);
    setShowQuestionSelector(true);
    setQuestionCount(0);
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewWordsLearned(0);
    setCurrentWord(null);
    setShowIntroduction(false);
    setIsFlipped(false);
    setFlashcardWords([]);
    setFlashcardIndex(0);
    onClose();
  };

  // Flashcard functions
  const loadFlashcards = useCallback(() => {
    let wordsToReview = reviewMode === 'due' 
      ? getWordsDueForReview(words)
      : words.filter(w => w.srsLevel > 0);

    if (wordsToReview.length === 0) {
      wordsToReview = words; // Fallback to all words
    }

    wordsToReview = wordsToReview.sort(() => Math.random() - 0.5);
    setFlashcardWords(wordsToReview);
    setFlashcardIndex(0);
    setIsFlipped(false);
  }, [words, reviewMode]);

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const handleFlashcardDifficulty = useCallback((difficulty: 'easy' | 'medium' | 'hard' | 'impossible') => {
    if (!isFlipped) return;

    const word = flashcardWords[flashcardIndex];
    if (!word) return;

    const newSrsLevel = updateSRSLevel(word, difficulty);
    const newMasteryLevel = getMasteryLevel(newSrsLevel);
    const nextReview = calculateNextReview(word, difficulty);

    storage.updateWord(word.id, {
      srsLevel: newSrsLevel,
      masteryLevel: newMasteryLevel,
      correctCount: word.correctCount + (difficulty === 'easy' || difficulty === 'medium' ? 1 : 0),
      wrongCount: word.wrongCount + (difficulty === 'hard' || difficulty === 'impossible' ? 1 : 0),
      nextReview,
      lastReviewed: Date.now(),
    });

    // Award XP for flashcard review
    leaderboard.awardFlashcardXP(courseId, newSrsLevel);

    onUpdate();

    // Move to next card
    if (flashcardIndex < flashcardWords.length - 1) {
      setFlashcardIndex(flashcardIndex + 1);
    } else {
      loadFlashcards();
    }
  }, [isFlipped, flashcardWords, flashcardIndex, courseId, onUpdate, loadFlashcards]);

  const handleFlashcardPrevious = useCallback(() => {
    if (flashcardIndex > 0) {
      setFlashcardIndex(flashcardIndex - 1);
    }
  }, [flashcardIndex]);

  const handleFlashcardNext = useCallback(() => {
    if (flashcardIndex < flashcardWords.length - 1) {
      setFlashcardIndex(flashcardIndex + 1);
    } else {
      loadFlashcards();
    }
  }, [flashcardIndex, flashcardWords.length, loadFlashcards]);

  const handleSkipIntroduction = () => {
    setShowIntroduction(false);
    if (inputRef.current && modeType === 'type') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (mode === 'flashcards' && !showQuestionSelector && !showSummary) {
        // Flashcard keyboard shortcuts
        if (e.key === ' ') {
          e.preventDefault();
          handleFlip();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleFlashcardPrevious();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleFlashcardNext();
        } else if (e.key === '1') {
          e.preventDefault();
          handleFlashcardDifficulty('easy');
        } else if (e.key === '2') {
          e.preventDefault();
          handleFlashcardDifficulty('medium');
        } else if (e.key === '3') {
          e.preventDefault();
          handleFlashcardDifficulty('hard');
        } else if (e.key === '4') {
          e.preventDefault();
          handleFlashcardDifficulty('impossible');
        }
        return;
      }

      if (e.target instanceof HTMLInputElement && e.key !== 'Enter') return;

      if (mode === 'speed' && isActive && countdown === 0 && currentWord) {
        // Speed review keyboard shortcuts
        if (e.key >= '1' && e.key <= '4' && !selectedAnswer) {
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          if (options[index]) {
            handleMultipleChoice(options[index]);
          }
        }
        return;
      }

      if (showIntroduction) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleSkipIntroduction();
        }
        return;
      }

      if (feedback) {
        if (e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      } else if (modeType === 'multiple') {
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          if (options[index]) {
            handleMultipleChoice(options[index]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [mode, isActive, countdown, currentWord, feedback, modeType, options, showIntroduction, handleNext, selectedAnswer, showQuestionSelector, showSummary, handleFlip, handleFlashcardPrevious, handleFlashcardNext, handleFlashcardDifficulty]);

  // Get mode-specific colors
  const getModeColors = () => {
    switch (mode) {
      case 'learn':
        return { primary: '#2da44e', background: '#dafbe1', border: '#2da44e' }; // Green
      case 'review':
        return { primary: '#87ceeb', background: '#ddf4ff', border: '#54aeff' }; // Light Blue
      case 'speed':
        return { primary: '#ff4444', background: '#ffebe9', border: '#ff8182' }; // Red
      case 'flashcards':
        return { primary: '#9370db', background: '#fbefff', border: '#bf87ff' }; // Purple
      case 'difficult':
        return { primary: '#ffd700', background: '#fff8c5', border: '#d4a72c' }; // Yellow
      default:
        return { primary: '#0969da', background: '#ffffff', border: '#d0d7de' }; // Default
    }
  };

  const modeColors = getModeColors();

  if (showQuestionSelector) {
    if (mode === 'speed') {
      return (
        <div className="modal" onClick={onClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', borderTop: `4px solid ${modeColors.primary}` }}>
            <div className="modal-header" style={{ backgroundColor: modeColors.background }}>
              <h2 className="modal-title" style={{ color: modeColors.primary }}>Speed Review</h2>
              <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="card">
              <p style={{ color: '#656d76', marginBottom: '24px' }}>
                Test your vocabulary with a timed challenge!
              </p>

              <div className="form-group">
                <label className="form-label">Time (minutes)</label>
                <input
                  type="number"
                  className="input"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(Math.max(1, parseInt(e.target.value) || 5))}
                  min={1}
                  max={60}
                />
                <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                  How long do you want to review? (1-60 minutes)
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Direction</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn ${direction === 'native-to-target' ? 'btn-primary' : ''}`}
                    onClick={() => setDirection('native-to-target')}
                  >
                    {course ? `${course.nativeLanguage} → ${course.targetLanguage}` : 'Native → Target'}
                  </button>
                  <button
                    className={`btn ${direction === 'target-to-native' ? 'btn-primary' : ''}`}
                    onClick={() => setDirection('target-to-native')}
                  >
                    {course ? `${course.targetLanguage} → ${course.nativeLanguage}` : 'Target → Native'}
                  </button>
                </div>
              </div>

              {total > 0 && (
                <div className="card" style={{ marginBottom: '16px', backgroundColor: '#f6f8fa' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: 600, color: '#0969da' }}>
                      {score} / {total}
                    </div>
                    <div style={{ color: '#656d76', marginTop: '4px' }}>
                      {total > 0 ? Math.round((score / total) * 100) : 0}% correct
                    </div>
                  </div>
                </div>
              )}

              <button className="btn btn-primary" onClick={startSpeedSession} style={{ width: '100%', backgroundColor: modeColors.primary, borderColor: modeColors.primary }}>
                Start Speed Review
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', borderTop: `4px solid ${modeColors.primary}` }}>
          <div className="modal-header" style={{ backgroundColor: modeColors.background }}>
            <h2 className="modal-title" style={{ color: modeColors.primary }}>
              {mode === 'learn' ? 'Learn' : 
               mode === 'review' ? 'Review Words' :
               mode === 'difficult' ? 'Difficult Words' :
               mode === 'flashcards' ? 'Flashcards' : 'Speed Review'}
            </h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          {mode === 'flashcards' ? (
            <div className="card">
              <p style={{ color: '#656d76', marginBottom: '24px', textAlign: 'center' }}>
                Study with Anki-style flashcards. Click to flip and rate your knowledge!
              </p>
              <button className="btn btn-primary" onClick={() => handleStart(0)} style={{ width: '100%', backgroundColor: modeColors.primary, borderColor: modeColors.primary }}>
                Start Flashcards
              </button>
            </div>
          ) : (
            <QuestionCountSelector
              maxQuestions={availableWords.length}
              defaultCount={Math.min(20, availableWords.length)}
              onStart={handleStart}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    );
  }

  if (showSummary) {
    const timeElapsed = mode === 'speed' 
      ? (timeMinutes * 60) - timeLeft 
      : (startTime ? Math.floor((Date.now() - startTime) / 1000) : 0);
    const correct = mode === 'speed' ? score : correctCount;
    const totalQuestions = mode === 'speed' ? total : questionsAnswered;
    
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderTop: `4px solid ${modeColors.primary}` }}>
          <div style={{ backgroundColor: modeColors.background, padding: '16px', borderRadius: '6px 6px 0 0' }}>
            <h2 style={{ color: modeColors.primary, margin: 0 }}>Summary</h2>
          </div>
          <LessonSummary
            correct={correct}
            total={totalQuestions}
            timeElapsed={timeElapsed}
            newWordsLearned={mode === 'speed' ? 0 : newWordsLearned}
            onClose={handleSummaryClose}
          />
        </div>
      </div>
    );
  }

  // Speed Review countdown
  if (mode === 'speed' && isActive && countdown > 0) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderTop: `4px solid ${modeColors.primary}` }}>
          <div className="quiz-container" style={{ backgroundColor: modeColors.background }}>
            <div className="speed-review-timer" style={{ color: modeColors.primary }}>{countdown}</div>
            <div style={{ textAlign: 'center', fontSize: '18px', color: '#656d76' }}>
              Get ready!
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showIntroduction && introductionWord) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', borderTop: `4px solid ${modeColors.primary}` }}>
          <div style={{ textAlign: 'center', padding: '32px', backgroundColor: modeColors.background, borderRadius: '6px' }}>
            <h2 style={{ fontSize: '32px', marginBottom: '16px', fontWeight: 600, color: modeColors.primary }}>
              {introductionWord.target}
            </h2>
            {introductionWord.pronunciation && (
              <div style={{ fontSize: '18px', color: '#656d76', marginBottom: '16px', fontStyle: 'italic' }}>
                {introductionWord.pronunciation}
              </div>
            )}
            <div style={{ fontSize: '24px', color: '#656d76', marginBottom: '16px' }}>
              {introductionWord.native}
            </div>
            {(introductionWord.partOfSpeech || introductionWord.difficulty) && (
              <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {introductionWord.partOfSpeech && (
                  <span className="tag" style={{ backgroundColor: '#e7f3ff', color: '#0969da', border: '1px solid #0969da' }}>
                    {introductionWord.partOfSpeech}
                  </span>
                )}
                {introductionWord.difficulty && (
                  <span className="tag">Difficulty: {introductionWord.difficulty}</span>
                )}
              </div>
            )}
            <button 
              className="btn btn-primary" 
              onClick={handleSkipIntroduction}
              style={{ padding: '12px 24px', fontSize: '16px', backgroundColor: modeColors.primary, borderColor: modeColors.primary }}
            >
              Continue
            </button>
            <div style={{ marginTop: '16px', fontSize: '12px', color: '#656d76' }}>
              Press Space or Enter to continue
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'flashcards' && flashcardWords.length === 0 && !showQuestionSelector) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderTop: `4px solid ${modeColors.primary}` }}>
          <div className="modal-header" style={{ backgroundColor: modeColors.background }}>
            <h2 className="modal-title" style={{ color: modeColors.primary }}>No Flashcards Available</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ color: '#656d76' }}>
              Learn some words first to create flashcards!
            </p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: '16px', backgroundColor: modeColors.primary, borderColor: modeColors.primary }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (availableWords.length === 0 && mode !== 'flashcards') {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderTop: `4px solid ${modeColors.primary}` }}>
          <div className="modal-header" style={{ backgroundColor: modeColors.background }}>
            <h2 className="modal-title" style={{ color: modeColors.primary }}>No Words Available</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ color: '#656d76' }}>
              {mode === 'learn' ? 'All words have been learned!' :
               mode === 'difficult' ? 'No difficult words found.' :
               mode === 'speed' ? 'No words available for speed review. Learn some words first!' :
               'No words available for this mode.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Flashcard UI
  if (mode === 'flashcards' && !showQuestionSelector && !showSummary && flashcardWords.length > 0) {
    const currentFlashcardWord = flashcardWords[flashcardIndex];
    if (!currentFlashcardWord) return <div className="loading">Loading...</div>;

    const frontText = direction === 'native-to-target' ? currentFlashcardWord.native : currentFlashcardWord.target;
    const backText = direction === 'native-to-target' ? currentFlashcardWord.target : currentFlashcardWord.native;

    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', borderTop: `4px solid ${modeColors.primary}` }}>
          <div style={{ backgroundColor: modeColors.background, padding: '16px', borderRadius: '6px 6px 0 0', marginBottom: '16px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                className={`btn ${direction === 'native-to-target' ? '' : ''}`}
                onClick={() => setDirection('native-to-target')}
                style={direction === 'native-to-target' ? { backgroundColor: modeColors.primary, borderColor: modeColors.primary, color: '#ffffff' } : {}}
              >
                {course ? `${course.nativeLanguage} → ${course.targetLanguage}` : 'Native → Target'}
              </button>
              <button
                className={`btn ${direction === 'target-to-native' ? '' : ''}`}
                onClick={() => setDirection('target-to-native')}
                style={direction === 'target-to-native' ? { backgroundColor: modeColors.primary, borderColor: modeColors.primary, color: '#ffffff' } : {}}
              >
                {course ? `${course.targetLanguage} → ${course.nativeLanguage}` : 'Target → Native'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                className={`btn ${reviewMode === 'due' ? '' : ''}`}
                onClick={() => {
                  setReviewMode('due');
                  loadFlashcards();
                }}
                style={reviewMode === 'due' ? { backgroundColor: modeColors.primary, borderColor: modeColors.primary, color: '#ffffff' } : {}}
              >
                Review Due
              </button>
              <button
                className={`btn ${reviewMode === 'all' ? '' : ''}`}
                onClick={() => {
                  setReviewMode('all');
                  loadFlashcards();
                }}
                style={reviewMode === 'all' ? { backgroundColor: modeColors.primary, borderColor: modeColors.primary, color: '#ffffff' } : {}}
              >
                Review All
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '16px', color: '#656d76' }}>
            Card {flashcardIndex + 1} of {flashcardWords.length}
          </div>

          <div className="flashcard" onClick={handleFlip} style={{ cursor: 'pointer' }}>
            <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
              <div className="flashcard-front" style={{ borderColor: modeColors.border }}>
                <div className="flashcard-content">{frontText}</div>
              </div>
              <div className="flashcard-back" style={{ borderColor: modeColors.border }}>
                <div className="flashcard-content">
                  {backText}
                  {direction === 'native-to-target' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(currentFlashcardWord);
                      }}
                      disabled={audioPlaying}
                      style={{
                        marginTop: '16px',
                        padding: '8px 16px',
                        backgroundColor: modeColors.primary,
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: audioPlaying ? 'not-allowed' : 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {audioPlaying ? '🔊 Playing...' : '🔊 Play Audio'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="keyboard-hint" style={{ marginTop: '16px' }}>
            {!isFlipped ? (
              <>Click the card or press <strong>Space</strong> to reveal the answer</>
            ) : (
              <>Press <strong>1</strong> Easy, <strong>2</strong> Medium, <strong>3</strong> Hard, <strong>4</strong> Impossible</>
            )}
          </div>

          {isFlipped && (
            <div className="flashcard-actions" style={{ marginTop: '24px' }}>
              <button
                className="btn"
                onClick={handleFlashcardPrevious}
                disabled={flashcardIndex === 0}
                style={{ backgroundColor: modeColors.background, borderColor: modeColors.border }}
              >
                ← Previous
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#2da44e', color: '#ffffff', borderColor: '#2da44e' }}
                onClick={() => handleFlashcardDifficulty('easy')}
              >
                1 - Easy
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#0969da', color: '#ffffff', borderColor: '#0969da' }}
                onClick={() => handleFlashcardDifficulty('medium')}
              >
                2 - Medium
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#fb8500', color: '#ffffff', borderColor: '#fb8500' }}
                onClick={() => handleFlashcardDifficulty('hard')}
              >
                3 - Hard
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#da3633', color: '#ffffff', borderColor: '#da3633' }}
                onClick={() => handleFlashcardDifficulty('impossible')}
              >
                4 - Impossible
              </button>
              <button
                className="btn"
                onClick={handleFlashcardNext}
                disabled={flashcardIndex === flashcardWords.length - 1}
                style={{ backgroundColor: modeColors.background, borderColor: modeColors.border }}
              >
                Next →
              </button>
            </div>
          )}

          <KeyboardShortcuts mode="flashcard" hasFeedback={false} />
        </div>
      </div>
    );
  }

  if (!currentWord && mode !== 'speed' && mode !== 'flashcards') {
    return <div className="loading">Loading...</div>;
  }

  if (mode === 'speed' && !isActive) {
    return null; // Should show question selector
  }

  if (mode === 'speed' && !currentWord) {
    return <div className="loading">Loading...</div>;
  }

  // Speed Review UI
  if (mode === 'speed' && isActive && currentWord) {
    const correctAnswer = direction === 'native-to-target' ? currentWord.target : currentWord.native;
    const isCorrect = selectedAnswer && selectedAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', borderTop: `4px solid ${modeColors.primary}` }}>
          <div style={{ backgroundColor: modeColors.background, padding: '16px', borderRadius: '6px 6px 0 0' }}>
            <div className="speed-review-timer" style={{ textAlign: 'center', fontSize: '48px', fontWeight: 600, marginBottom: '16px', color: modeColors.primary }}>
              {timeLeft}s
            </div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px', fontWeight: 600 }}>Score: {score} / {total}</span>
          </div>

          <div className="quiz-question">
            {direction === 'native-to-target' ? currentWord.native : currentWord.target}
          </div>

          <div className="quiz-options">
            {options.map((option, idx) => {
              let className = 'quiz-option';
              if (selectedAnswer) {
                if (option.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
                  className += ' correct';
                } else if (option === selectedAnswer && !isCorrect) {
                  className += ' incorrect';
                }
              }

              return (
                <button
                  key={idx}
                  className={className}
                  onClick={() => handleMultipleChoice(option)}
                  disabled={!!selectedAnswer}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {selectedAnswer && !isCorrect && (
            <div className="quiz-feedback incorrect" style={{ marginTop: '16px' }}>
              Correct answer: {correctAnswer}
            </div>
          )}

          <KeyboardShortcuts mode="speed" hasFeedback={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', borderTop: `4px solid ${modeColors.primary}` }}>
        <div style={{ backgroundColor: modeColors.background, padding: '16px', borderRadius: '6px 6px 0 0', marginBottom: '16px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              className={`btn ${modeType === 'multiple' ? '' : ''}`}
              onClick={() => setModeType('multiple')}
              style={modeType === 'multiple' ? { backgroundColor: modeColors.primary, borderColor: modeColors.primary, color: '#ffffff' } : {}}
            >
              Multiple Choice
            </button>
            <button
              className={`btn ${modeType === 'type' ? '' : ''}`}
              onClick={() => setModeType('type')}
              style={modeType === 'type' ? { backgroundColor: modeColors.primary, borderColor: modeColors.primary, color: '#ffffff' } : {}}
            >
              Type Answer
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              className={`btn ${direction === 'native-to-target' ? '' : ''}`}
              onClick={() => setDirection('native-to-target')}
              style={direction === 'native-to-target' ? { backgroundColor: modeColors.primary, borderColor: modeColors.primary, color: '#ffffff' } : {}}
            >
              {course ? `${course.nativeLanguage} → ${course.targetLanguage}` : 'Native → Target'}
            </button>
            <button
              className={`btn ${direction === 'target-to-native' ? '' : ''}`}
              onClick={() => setDirection('target-to-native')}
              style={direction === 'target-to-native' ? { backgroundColor: modeColors.primary, borderColor: modeColors.primary, color: '#ffffff' } : {}}
            >
              {course ? `${course.targetLanguage} → ${course.nativeLanguage}` : 'Target → Native'}
            </button>
          </div>
        </div>

               {currentWord && (
                 <>
                   {mode === 'learn' && currentWord.srsLevel === 0 && (() => {
                     const progress = wordLearningProgress.get(currentWord.id);
                     const correctCount = progress?.correct || 0;
                     const remaining = Math.max(0, REQUIRED_CORRECT_ANSWERS - correctCount);
                     return (
                       <div style={{ 
                         marginBottom: '16px', 
                         padding: '12px', 
                         backgroundColor: modeColors.background, 
                         borderRadius: '6px',
                         border: `1px solid ${modeColors.border}`
                       }}>
                         <div style={{ fontSize: '14px', color: '#656d76', marginBottom: '8px' }}>
                           Learning Progress
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <div style={{ 
                             flex: 1, 
                             height: '8px', 
                             backgroundColor: '#d0d7de', 
                             borderRadius: '4px',
                             overflow: 'hidden'
                           }}>
                             <div style={{ 
                               height: '100%', 
                               width: `${(correctCount / REQUIRED_CORRECT_ANSWERS) * 100}%`,
                               backgroundColor: modeColors.primary,
                               transition: 'width 0.3s ease'
                             }} />
                           </div>
                           <div style={{ fontSize: '14px', fontWeight: 600, color: modeColors.primary, minWidth: '80px', textAlign: 'right' }}>
                             {correctCount} / {REQUIRED_CORRECT_ANSWERS}
                           </div>
                         </div>
                         {remaining > 0 && (
                           <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                             {remaining} more correct {remaining === 1 ? 'answer' : 'answers'} needed to learn this word
                           </div>
                         )}
                       </div>
                     );
                   })()}
                   <div className="quiz-question">
                     {direction === 'native-to-target' ? currentWord.native : currentWord.target}
                   </div>

            {modeType === 'multiple' ? (
              <div className="quiz-options">
                {options.map((option, idx) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = option.toLowerCase().trim() === 
                    (direction === 'native-to-target' ? currentWord.target : currentWord.native).toLowerCase().trim();
              
              let className = 'quiz-option';
              if (feedback) {
                if (isCorrect) className += ' correct';
                else if (isSelected && !isCorrect) className += ' incorrect';
              } else if (isSelected) {
                className += ' selected';
              }

              return (
                <button
                  key={idx}
                  className={className}
                  onClick={() => handleMultipleChoice(option)}
                  disabled={!!feedback}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <input
              ref={inputRef}
              type="text"
              className="quiz-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTypeAnswer()}
              placeholder="Type your answer..."
              disabled={!!feedback}
            />
            <button 
              className="btn btn-primary" 
              onClick={handleTypeAnswer}
              disabled={!!feedback || !userInput.trim()}
              style={{ width: '100%', backgroundColor: modeColors.primary, borderColor: modeColors.primary }}
            >
              Submit
            </button>
          </div>
        )}

            {feedback && (
              <div className={`quiz-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
                {feedback.message}
              </div>
            )}

            {feedback && (
              <button className="btn btn-primary" onClick={handleNext} style={{ width: '100%', marginTop: '16px', backgroundColor: modeColors.primary, borderColor: modeColors.primary }}>
                Next
              </button>
            )}

            <div style={{ textAlign: 'center', marginTop: '16px', color: '#656d76', fontSize: '14px' }}>
              Question {questionsAnswered + 1} of {questionCount}
            </div>
          </>
        )}

        <KeyboardShortcuts mode={modeType} hasFeedback={!!feedback} />
      </div>
    </div>
  );
}

