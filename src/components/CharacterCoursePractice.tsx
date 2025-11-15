import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppState, Kanji, Radical, Vocabulary, GlyphySRSStage } from '../types';
import { storage } from '../storage';
import { getUnlockableItems, getItemsByLevel } from '../utils/glyphySRS';
import { createReviewQueue, updateSRSProgressForReview } from '../utils/waniKaniSRS';
import { recordStudyActivity, getCourseStreak } from '../utils/activityTracking';
import './CharacterCoursePractice.css';

interface CharacterCoursePracticeProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

type ViewMode = 'dashboard' | 'lessons' | 'reviews' | 'srs-stage';

export default function CharacterCoursePractice({ appState, updateState }: CharacterCoursePracticeProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [currentLevel, setCurrentLevel] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedSRSStage, setSelectedSRSStage] = useState<GlyphySRSStage | null>(null);
  
  // Lessons state
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  
  // Reviews state
  const [reviewQueue, setReviewQueue] = useState<Array<{ item: Radical | Kanji | Vocabulary; type: 'meaning' | 'reading' }>>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);

  const course = appState.characterCourses.find(c => c.id === courseId);
  const characters = (appState.kanji || []).filter(k => k.language === course?.language);
  const radicals = (appState.radicals || []).filter(r => r.language === course?.language);
  const vocabulary = (appState.vocabulary || []).filter(v => v.language === course?.language);

  useEffect(() => {
    if (!course) {
      navigate('/');
    }
  }, [course, navigate]);

  // Generate options when review index changes
  useEffect(() => {
    if (viewMode === 'reviews' && reviewQueue.length > 0 && currentReviewIndex < reviewQueue.length) {
      const currentReview = reviewQueue[currentReviewIndex];
      if (currentReview) {
        generateOptionsForReview(currentReview.item, currentReview.type);
        setShowAnswer(false);
        setFeedback(null);
        setShowMnemonic(false);
        setSelectedAnswer('');
        setUserInput('');
      }
    }
  }, [viewMode, reviewQueue, currentReviewIndex, radicals, characters, vocabulary]);

  if (!course) {
    return <div className="loading">Course not found</div>;
  }

  const refreshData = () => {
    const newState = storage.load();
    updateState(newState);
  };

  // Get unlockable items (lessons)
  const unlockableItems = useMemo(() => {
    const unlockableRadicals = getUnlockableItems(
      radicals.filter(r => r.level === currentLevel),
      radicals,
      characters,
      vocabulary
    );
    const unlockableKanji = getUnlockableItems(
      characters.filter(k => k.level === currentLevel),
      radicals,
      characters,
      vocabulary
    );
    const unlockableVocab = getUnlockableItems(
      vocabulary.filter(v => v.level === currentLevel),
      radicals,
      characters,
      vocabulary
    );
    return [...unlockableRadicals, ...unlockableKanji, ...unlockableVocab];
  }, [radicals, characters, vocabulary, currentLevel]);

  // Get review queue with meaning and reading reviews
  const reviewQueueMemo = useMemo(() => {
    const allItems = [...radicals, ...characters, ...vocabulary];
    return createReviewQueue(allItems);
  }, [radicals, characters, vocabulary]);

  // Calculate SRS stage breakdown
  const srsBreakdown = useMemo(() => {
    const allItems = [...radicals, ...characters, ...vocabulary];
    return {
      seed: allItems.filter(i => i.srsStage === 'seed'),
      sprout: allItems.filter(i => i.srsStage === 'sprout'),
      seedling: allItems.filter(i => i.srsStage === 'seedling'),
      plant: allItems.filter(i => i.srsStage === 'plant'),
      tree: allItems.filter(i => i.srsStage === 'tree'),
    };
  }, [radicals, characters, vocabulary]);

  // Get level progress
  const levelProgress = useMemo(() => {
    const levelRadicals = getItemsByLevel(radicals, currentLevel);
    const levelKanji = getItemsByLevel(characters, currentLevel);
    const levelVocab = getItemsByLevel(vocabulary, currentLevel);
    
    return {
      radicals: {
        total: levelRadicals.length,
        learned: levelRadicals.filter(r => r.srsStage !== 'locked').length,
        sprout: levelRadicals.filter(r => r.srsStage === 'sprout' || r.srsStage === 'seedling' || r.srsStage === 'plant' || r.srsStage === 'tree').length,
      },
      kanji: {
        total: levelKanji.length,
        learned: levelKanji.filter(k => k.srsStage !== 'locked').length,
        sprout: levelKanji.filter(k => k.srsStage === 'sprout' || k.srsStage === 'seedling' || k.srsStage === 'plant' || k.srsStage === 'tree').length,
      },
      vocabulary: {
        total: levelVocab.length,
        learned: levelVocab.filter(v => v.srsStage !== 'locked').length,
        sprout: levelVocab.filter(v => v.srsStage === 'sprout' || v.srsStage === 'seedling' || v.srsStage === 'plant' || v.srsStage === 'tree').length,
      },
    };
  }, [radicals, characters, vocabulary, currentLevel]);

  // Get review schedule
  const reviewSchedule = useMemo(() => {
    const now = Date.now();
    
    // Group items by next review time
    const timeSlots = new Map<string, number>();
    
    [...radicals, ...characters, ...vocabulary].forEach(item => {
      if (item.nextReview && item.srsStage !== 'locked' && item.srsStage !== 'tree') {
        const reviewDate = new Date(item.nextReview);
        const hoursUntil = Math.ceil((item.nextReview - now) / (1000 * 60 * 60));
        
        let timeLabel: string;
        if (hoursUntil <= 0) {
          timeLabel = 'Now';
        } else if (hoursUntil < 24) {
          timeLabel = `In ${hoursUntil}h`;
        } else {
          const daysUntil = Math.ceil(hoursUntil / 24);
          if (daysUntil === 1) {
            timeLabel = 'Tomorrow';
          } else if (daysUntil <= 7) {
            timeLabel = `In ${daysUntil}d`;
          } else {
            timeLabel = reviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        }
        
        const count = timeSlots.get(timeLabel) || 0;
        timeSlots.set(timeLabel, count + 1);
      }
    });
    
    // Sort by time
    const sorted = Array.from(timeSlots.entries())
      .sort((a, b) => {
        if (a[0] === 'Now') return -1;
        if (b[0] === 'Now') return 1;
        return a[0].localeCompare(b[0]);
      });
    
    return sorted.map(([time, count]) => ({ time, count }));
  }, [radicals, characters, vocabulary]);

  // Get streak for this course
  const streak = getCourseStreak(courseId!);

  const handleStartLessons = () => {
    if (unlockableItems.length === 0) {
      alert('No lessons available. Complete previous levels first!');
      return;
    }
    setViewMode('lessons');
    setCurrentLessonIndex(0);
    setLessonsCompleted(0);
    refreshData();
  };

  const handleStartReviews = () => {
    if (reviewQueueMemo.length === 0) {
      alert('No reviews available at this time.');
      return;
    }
    setViewMode('reviews');
    setReviewQueue(reviewQueueMemo);
    setCurrentReviewIndex(0);
    setShowAnswer(false);
    setUserInput('');
    setSelectedAnswer('');
    setFeedback(null);
    setShowMnemonic(false);
    const firstReview = reviewQueueMemo[0];
    generateOptionsForReview(firstReview.item, firstReview.type);
    refreshData();
  };

  const unlockItem = (item: Radical | Kanji | Vocabulary) => {
    const updates = {
      srsStage: 'seed' as GlyphySRSStage,
      unlockedAt: Date.now(),
      meaningCorrect: 0,
      meaningWrong: 0,
      readingCorrect: 0,
      readingWrong: 0,
      nextReview: Date.now() + (4 * 60 * 60 * 1000), // 4 hours for seed
    };

    if ('word' in item) {
      storage.updateVocabulary(item.id, updates as Partial<Vocabulary>);
    } else if ('pronunciation' in item) {
      storage.updateKanji(item.id, updates as Partial<Kanji>);
    } else {
      storage.updateRadical(item.id, updates as Partial<Radical>);
    }

    setLessonsCompleted(prev => prev + 1);
    
    if (courseId) {
      recordStudyActivity(courseId, 1);
    }
    
    // Move to next lesson or finish
    if (currentLessonIndex < unlockableItems.length - 1) {
      setCurrentLessonIndex(prev => prev + 1);
    } else {
      // All lessons completed
      setTimeout(() => {
        setViewMode('dashboard');
        refreshData();
      }, 1000);
    }
    
    refreshData();
  };

  const generateOptionsForReview = (item: Radical | Kanji | Vocabulary, type: 'meaning' | 'reading') => {
    const isRadical = !('pronunciation' in item);
    const isKanji = 'pronunciation' in item && !('word' in item);
    
    if (type === 'meaning') {
      const correctAnswer = item.meaning;
      const allItems = isRadical ? radicals : isKanji ? characters : vocabulary;
      const otherItems = allItems
        .filter(i => i.id !== item.id)
        .map(i => i.meaning)
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
        .slice(0, 3);
      
      const allOptions = [correctAnswer, ...otherItems].sort(() => Math.random() - 0.5);
      setOptions(allOptions);
    } else {
      // Reading mode
      if (isRadical) {
        // For radicals, show character
        const correctAnswer = (item as Radical).character;
        const otherRadicals = radicals
          .filter(r => r.id !== item.id)
          .map(r => r.character)
          .filter((val, idx, arr) => arr.indexOf(val) === idx)
          .slice(0, 3);
        const allOptions = [correctAnswer, ...otherRadicals].sort(() => Math.random() - 0.5);
        setOptions(allOptions);
      } else {
        const correctAnswer = isKanji ? (item as Kanji).pronunciation : (item as Vocabulary).pronunciation;
        const allItems = isKanji ? characters : vocabulary;
        const otherItems = allItems
          .filter(i => i.id !== item.id)
          .map(i => isKanji ? (i as Kanji).pronunciation : (i as Vocabulary).pronunciation)
          .filter((val, idx, arr) => arr.indexOf(val) === idx)
          .slice(0, 3);
        const allOptions = [correctAnswer, ...otherItems].sort(() => Math.random() - 0.5);
        setOptions(allOptions);
      }
    }
  };

  const handleReviewAnswer = (isCorrect: boolean) => {
    if (!reviewQueue[currentReviewIndex] || feedback) return;

    const review = reviewQueue[currentReviewIndex];
    const item = review.item;
    const reviewType = review.type;
    
    const updates = updateSRSProgressForReview(item, reviewType, isCorrect);
    
    if ('word' in item) {
      storage.updateVocabulary(item.id, updates as Partial<Vocabulary>);
    } else if ('pronunciation' in item) {
      storage.updateKanji(item.id, updates as Partial<Kanji>);
    } else {
      storage.updateRadical(item.id, updates as Partial<Radical>);
    }

    const isRadical = !('pronunciation' in item);
    const isKanji = 'pronunciation' in item && !('word' in item);
    
    const correctAnswer = reviewType === 'meaning' 
      ? item.meaning
      : isRadical 
        ? (item as Radical).character 
        : isKanji 
          ? (item as Kanji).pronunciation 
          : (item as Vocabulary).pronunciation;

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    if (courseId) {
      recordStudyActivity(courseId, 1);
    }
    refreshData();
  };

  const handleNextReview = () => {
    if (!feedback) return;
    
    const nextIndex = currentReviewIndex + 1;
    
    if (nextIndex >= reviewQueue.length) {
      // Get fresh review queue (items may have changed)
      const freshRadicals = (storage.load().radicals || []).filter(r => r.language === course?.language);
      const freshKanji = (storage.load().kanji || []).filter(k => k.language === course?.language);
      const freshVocab = (storage.load().vocabulary || []).filter(v => v.language === course?.language);
      const freshQueue = createReviewQueue([...freshRadicals, ...freshKanji, ...freshVocab]);
      
      if (freshQueue.length > 0) {
        setReviewQueue(freshQueue);
        setCurrentReviewIndex(0);
        setShowAnswer(false);
        setUserInput('');
        setSelectedAnswer('');
        setFeedback(null);
        setShowMnemonic(false);
        generateOptionsForReview(freshQueue[0].item, freshQueue[0].type);
      } else {
        // Finished reviews
        setViewMode('dashboard');
        refreshData();
      }
    } else {
      // Move to next review in current queue
      setCurrentReviewIndex(nextIndex);
      setShowAnswer(false);
      setUserInput('');
      setSelectedAnswer('');
      setFeedback(null);
      setShowMnemonic(false);
      // Options will be generated by useEffect when currentReviewIndex changes
    }
  };

  const getCorrectAnswer = (item: Radical | Kanji | Vocabulary, type: 'meaning' | 'reading'): string => {
    const isRadical = !('pronunciation' in item);
    const isKanji = 'pronunciation' in item && !('word' in item);
    
    if (type === 'meaning') {
      return item.meaning;
    } else {
      if (isRadical) {
        return (item as Radical).character;
      } else if (isKanji) {
        return (item as Kanji).pronunciation;
      } else {
        return (item as Vocabulary).pronunciation;
      }
    }
  };

  const handleSRSStageClick = (stage: Exclude<GlyphySRSStage, 'locked'>) => {
    setSelectedSRSStage(stage);
    setViewMode('srs-stage');
  };

  const getSRSColor = (stage: GlyphySRSStage): string => {
    switch (stage) {
      case 'seed': return '#f35656';
      case 'sprout': return '#9e5bd9';
      case 'seedling': return '#00a2ff';
      case 'plant': return '#00c2ff';
      case 'tree': return '#4a4a4a';
      case 'locked': return '#d0d7de';
      default: return '#d0d7de';
    }
  };

  const courseLevels = course.levels || [1];

  // Dashboard view
  if (viewMode === 'dashboard') {
    return (
      <div className="character-practice-container">
        <div className="character-practice-header">
          <div>
            <button className="btn" onClick={() => navigate(`/character-course/${courseId}`)} style={{ marginBottom: '8px' }}>
              ← Back to Course
            </button>
            <h1 className="character-practice-title">{course.name}</h1>
            <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
              {course.language === 'japanese' ? 'Japanese' : 'Chinese'} Characters
            </div>
          </div>
        </div>

        {/* Streak Display */}
        {streak && streak.currentStreak > 0 && (
          <div style={{ 
            marginBottom: '24px',
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '20px',
            fontWeight: 600,
            color: '#24292f'
          }}>
            🔥 {streak.currentStreak}
          </div>
        )}

        {/* Main Action Widgets */}
        <div className="action-widgets">
          <div className="action-widget lessons-widget">
            <div className="widget-header">
              <h2 className="widget-title">Lessons</h2>
              <div className="widget-count">{unlockableItems.length}</div>
            </div>
            <div className="widget-content">
              <p className="widget-description">New items ready to learn</p>
              <button 
                className="btn btn-primary widget-button"
                onClick={handleStartLessons}
                disabled={unlockableItems.length === 0}
              >
                Start Lessons
              </button>
            </div>
          </div>

          <div className="action-widget reviews-widget">
            <div className="widget-header">
              <h2 className="widget-title">Reviews</h2>
              <div className="widget-count">{reviewQueueMemo.length}</div>
            </div>
            <div className="widget-content">
              <p className="widget-description">Items due for review (meaning & reading)</p>
              <button 
                className="btn btn-primary widget-button"
                onClick={handleStartReviews}
                disabled={reviewQueueMemo.length === 0}
              >
                Start Reviews
              </button>
            </div>
          </div>

          <div className="action-widget schedule-widget">
            <div className="widget-header">
              <h2 className="widget-title">Review Schedule</h2>
            </div>
            <div className="widget-content schedule-content">
              {reviewSchedule.length === 0 ? (
                <p className="schedule-empty">No reviews scheduled</p>
              ) : (
                <div className="schedule-list">
                  {reviewSchedule.slice(0, 5).map((item, index) => (
                    <div key={index} className="schedule-item">
                      <span className="schedule-time">{item.time}</span>
                      <span className="schedule-count">{item.count} items</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SRS Stage Breakdown */}
        <div className="srs-breakdown-section">
          <h2 className="section-title">SRS Stages</h2>
          <div className="srs-breakdown-grid">
            <div 
              className="srs-stage-card"
              style={{ borderColor: getSRSColor('seed') }}
              onClick={() => handleSRSStageClick('seed')}
            >
              <div className="srs-stage-indicator" style={{ backgroundColor: getSRSColor('seed') }}></div>
              <div className="srs-stage-name">🌱 Seed</div>
              <div className="srs-stage-count">{srsBreakdown.seed.length}</div>
            </div>
            <div 
              className="srs-stage-card"
              style={{ borderColor: getSRSColor('sprout') }}
              onClick={() => handleSRSStageClick('sprout')}
            >
              <div className="srs-stage-indicator" style={{ backgroundColor: getSRSColor('sprout') }}></div>
              <div className="srs-stage-name">🌿 Sprout</div>
              <div className="srs-stage-count">{srsBreakdown.sprout.length}</div>
            </div>
            <div 
              className="srs-stage-card"
              style={{ borderColor: getSRSColor('seedling') }}
              onClick={() => handleSRSStageClick('seedling')}
            >
              <div className="srs-stage-indicator" style={{ backgroundColor: getSRSColor('seedling') }}></div>
              <div className="srs-stage-name">🌱 Seedling</div>
              <div className="srs-stage-count">{srsBreakdown.seedling.length}</div>
            </div>
            <div 
              className="srs-stage-card"
              style={{ borderColor: getSRSColor('plant') }}
              onClick={() => handleSRSStageClick('plant')}
            >
              <div className="srs-stage-indicator" style={{ backgroundColor: getSRSColor('plant') }}></div>
              <div className="srs-stage-name">🌳 Plant</div>
              <div className="srs-stage-count">{srsBreakdown.plant.length}</div>
            </div>
            <div 
              className="srs-stage-card"
              style={{ borderColor: getSRSColor('tree') }}
              onClick={() => handleSRSStageClick('tree')}
            >
              <div className="srs-stage-indicator" style={{ backgroundColor: getSRSColor('tree') }}></div>
              <div className="srs-stage-name">🌲 Tree</div>
              <div className="srs-stage-count">{srsBreakdown.tree.length}</div>
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div className="level-progress-section">
          <div className="level-selector">
            <label>Level:</label>
            <select
              value={currentLevel}
              onChange={(e) => setCurrentLevel(parseInt(e.target.value))}
            >
              {courseLevels.map(level => (
                <option key={level} value={level}>Level {level}</option>
              ))}
            </select>
          </div>
          <div className="level-progress-widget">
            <h3 className="progress-title">Level {currentLevel} Progress</h3>
            <div className="progress-items">
              <div className="progress-item">
                <div className="progress-item-label">Radicals</div>
                <div className="progress-item-stats">
                  {levelProgress.radicals.sprout} / {levelProgress.radicals.total} to Sprout
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${levelProgress.radicals.total > 0 ? (levelProgress.radicals.sprout / levelProgress.radicals.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="progress-item">
                <div className="progress-item-label">Kanji</div>
                <div className="progress-item-stats">
                  {levelProgress.kanji.sprout} / {levelProgress.kanji.total} to Sprout
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${levelProgress.kanji.total > 0 ? (levelProgress.kanji.sprout / levelProgress.kanji.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="progress-item">
                <div className="progress-item-label">Vocabulary</div>
                <div className="progress-item-stats">
                  {levelProgress.vocabulary.sprout} / {levelProgress.vocabulary.total} to Sprout
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${levelProgress.vocabulary.total > 0 ? (levelProgress.vocabulary.sprout / levelProgress.vocabulary.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }

  // SRS Stage view
  if (viewMode === 'srs-stage' && selectedSRSStage && selectedSRSStage !== 'locked') {
    const items = srsBreakdown[selectedSRSStage as Exclude<GlyphySRSStage, 'locked'>];
    
    return (
      <div className="character-practice-container">
        <div className="character-practice-header">
          <button className="btn" onClick={() => setViewMode('dashboard')} style={{ marginBottom: '8px' }}>
            ← Back to Dashboard
          </button>
          <h1 className="character-practice-title">{selectedSRSStage.charAt(0).toUpperCase() + selectedSRSStage.slice(1)} Stage</h1>
        </div>
        
        <div className="items-grid">
          {items.map((item: Radical | Kanji | Vocabulary) => {
            const isRadical = 'character' in item && !('pronunciation' in item);
            const isKanji = 'character' in item && 'pronunciation' in item && !('word' in item);
            
            return (
              <div key={item.id} className="item-card" style={{ borderColor: getSRSColor(selectedSRSStage) }}>
                <div className="item-character">
                  {isRadical ? (item as Radical).character : 
                   isKanji ? (item as Kanji).character : 
                   (item as Vocabulary).word}
                </div>
                <div className="item-meaning">{item.meaning}</div>
                {!isRadical && (
                  <div className="item-pronunciation">
                    {isKanji ? (item as Kanji).pronunciation : (item as Vocabulary).pronunciation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Lessons view
  if (viewMode === 'lessons') {
    const currentItem = unlockableItems[currentLessonIndex];
    
    if (!currentItem) {
      return (
        <div className="character-practice-container">
          <div className="character-practice-header">
            <button className="btn" onClick={() => setViewMode('dashboard')} style={{ marginBottom: '8px' }}>
              ← Back to Dashboard
            </button>
            <h1 className="character-practice-title">Lessons Complete!</h1>
          </div>
          <div className="card">
            <p>You've completed all available lessons. Great job!</p>
            <button className="btn btn-primary" onClick={() => setViewMode('dashboard')}>
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    const isRadical = !('pronunciation' in currentItem);
    const isKanji = 'pronunciation' in currentItem && !('word' in currentItem);
    const isVocab = 'word' in currentItem;

    return (
      <div className="character-practice-container">
        <div className="character-practice-header">
          <button className="btn" onClick={() => setViewMode('dashboard')} style={{ marginBottom: '8px' }}>
            ← Back to Dashboard
          </button>
          <h1 className="character-practice-title">Lessons - Level {currentLevel}</h1>
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {lessonsCompleted + 1} / {unlockableItems.length}
          </div>
        </div>

        <div className="lesson-view">
          <div className="lesson-card-large">
            {isRadical && (
              <>
                <div className="lesson-character-large">{(currentItem as Radical).character}</div>
                <div className="lesson-meaning-large">{(currentItem as Radical).meaning}</div>
                {(currentItem as Radical).mnemonic && (
                  <div className="lesson-mnemonic-large">
                    <strong>Mnemonic:</strong> {(currentItem as Radical).mnemonic}
                  </div>
                )}
                {(currentItem as Radical).mnemonicImage && (
                  <img src={(currentItem as Radical).mnemonicImage} alt="Mnemonic" className="lesson-image-large" />
                )}
              </>
            )}
            {isKanji && (
              <>
                <div className="lesson-character-large">{(currentItem as Kanji).character}</div>
                <div className="lesson-meaning-large">{(currentItem as Kanji).meaning}</div>
                <div className="lesson-pronunciation-large">{(currentItem as Kanji).pronunciation}</div>
                {(currentItem as Kanji).mnemonic && (
                  <div className="lesson-mnemonic-large">
                    <strong>Mnemonic:</strong> {(currentItem as Kanji).mnemonic}
                  </div>
                )}
                {(currentItem as Kanji).mnemonicImage && (
                  <img src={(currentItem as Kanji).mnemonicImage} alt="Mnemonic" className="lesson-image-large" />
                )}
              </>
            )}
            {isVocab && (
              <>
                <div className="lesson-character-large">{(currentItem as Vocabulary).word}</div>
                <div className="lesson-meaning-large">{(currentItem as Vocabulary).meaning}</div>
                <div className="lesson-pronunciation-large">{(currentItem as Vocabulary).pronunciation}</div>
                {(currentItem as Vocabulary).mnemonic && (
                  <div className="lesson-mnemonic-large">
                    <strong>Mnemonic:</strong> {(currentItem as Vocabulary).mnemonic}
                  </div>
                )}
                {(currentItem as Vocabulary).mnemonicImage && (
                  <img src={(currentItem as Vocabulary).mnemonicImage} alt="Mnemonic" className="lesson-image-large" />
                )}
              </>
            )}
            <button
              className="btn btn-primary lesson-unlock-button"
              onClick={() => unlockItem(currentItem)}
            >
              I've Got It!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reviews view
  if (viewMode === 'reviews') {
    if (reviewQueue.length === 0 || currentReviewIndex >= reviewQueue.length) {
      return (
        <div className="character-practice-container">
          <div className="character-practice-header">
            <button className="btn" onClick={() => setViewMode('dashboard')} style={{ marginBottom: '8px' }}>
              ← Back to Dashboard
            </button>
            <h1 className="character-practice-title">Reviews Complete!</h1>
          </div>
          <div className="card">
            <p>Great job! You've completed all available reviews.</p>
            <button className="btn btn-primary" onClick={() => setViewMode('dashboard')}>
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    const currentReview = reviewQueue[currentReviewIndex];
    const currentItem = currentReview.item;
    const reviewType = currentReview.type;
    const isRadical = !('pronunciation' in currentItem);
    const isKanji = 'pronunciation' in currentItem && !('word' in currentItem);

    return (
      <div className="character-practice-container">
        <div className="character-practice-header">
          <button className="btn" onClick={() => setViewMode('dashboard')} style={{ marginBottom: '8px' }}>
            ← Exit Review
          </button>
          <h1 className="character-practice-title">Reviews</h1>
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {currentReviewIndex + 1} / {reviewQueue.length}
          </div>
        </div>

        <div className="review-view">
          <div className="review-badges">
            <div className="review-type-badge" style={{ 
              backgroundColor: isRadical ? '#00a2ff' : isKanji ? '#9e5bd9' : '#f35656' 
            }}>
              {isRadical ? 'RADICAL' : isKanji ? 'KANJI' : 'VOCAB'}
            </div>
            <div className="review-stage-badge" style={{ backgroundColor: getSRSColor(currentItem.srsStage) }}>
              {currentItem.srsStage}
            </div>
            <div className="review-question-type-badge" style={{ 
              backgroundColor: reviewType === 'meaning' ? '#2da44e' : '#0969da' 
            }}>
              {reviewType === 'meaning' ? 'MEANING' : 'READING'}
            </div>
          </div>

          <div className="review-question">
            <div className="question-character-large">
              {isRadical ? (currentItem as Radical).character :
               isKanji ? (currentItem as Kanji).character :
               (currentItem as Vocabulary).word}
            </div>
            <div className="question-type-label">
              {reviewType === 'meaning' ? 'What is the meaning?' : 'What is the reading?'}
            </div>
          </div>

          {!showAnswer && !feedback && (
            <div className="review-options">
              {options.map((option, index) => (
                <button
                  key={index}
                  className="quiz-option-button"
                  onClick={() => {
                    const correct = option === getCorrectAnswer(currentItem, reviewType);
                    setSelectedAnswer(option);
                    handleReviewAnswer(correct);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {feedback && (
            <div className={`review-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
              <div className="feedback-message">{feedback.message}</div>
              <div className="feedback-answer">
                <strong>Answer:</strong> {getCorrectAnswer(currentItem, reviewType)}
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setShowMnemonic(!showMnemonic)}
                style={{ marginTop: '16px' }}
              >
                {showMnemonic ? 'Hide' : 'Show'} Mnemonic
              </button>
              {showMnemonic && (
                <div className="mnemonic-display">
                  <p>
                    {isRadical ? (currentItem as Radical).mnemonic :
                     isKanji ? (currentItem as Kanji).mnemonic :
                     (currentItem as Vocabulary).mnemonic || 'No mnemonic available'}
                  </p>
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={handleNextReview}
                style={{ marginTop: '16px', width: '100%' }}
              >
                Next Review
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
