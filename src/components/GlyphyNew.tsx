import { useState, useEffect, useCallback } from 'react';
import { AppState, Radical, Kanji, Vocabulary, GlyphySRSStage } from '../types';
import { storage } from '../storage';
import { updateSRSProgress, getItemsDueForReview, getUnlockableItems, getItemsByLevel } from '../utils/glyphySRS';
import './GlyphyNew.css';

interface GlyphyNewProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

type ItemType = 'radical' | 'kanji' | 'vocabulary';
type QuizMode = 'meaning' | 'reading';
type ViewMode = 'lessons' | 'reviews' | 'dashboard';

interface ReviewItem {
  type: ItemType;
  item: Radical | Kanji | Vocabulary;
}

export default function GlyphyNew({ appState, updateState }: GlyphyNewProps) {
  const [language, setLanguage] = useState<'japanese' | 'chinese'>('japanese');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentReviewItem, setCurrentReviewItem] = useState<ReviewItem | null>(null);
  const [quizMode, setQuizMode] = useState<QuizMode>('meaning');
  const [showAnswer, setShowAnswer] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);

  const radicals = (appState.radicals || []).filter(r => r.language === language);
  const kanji = (appState.kanji || []).filter(k => k.language === language);
  const vocabulary = (appState.vocabulary || []).filter(v => v.language === language);

  // Get review queue
  const reviewQueue = useCallback(() => {
    const dueRadicals = getItemsDueForReview(radicals).map(r => ({ type: 'radical' as ItemType, item: r }));
    const dueKanji = getItemsDueForReview(kanji).map(k => ({ type: 'kanji' as ItemType, item: k }));
    const dueVocab = getItemsDueForReview(vocabulary).map(v => ({ type: 'vocabulary' as ItemType, item: v }));
    return [...dueRadicals, ...dueKanji, ...dueVocab].sort(() => Math.random() - 0.5);
  }, [radicals, kanji, vocabulary]);

  // Get unlockable items for current level
  const unlockableItems = useCallback(() => {
    const unlockableRadicals = getUnlockableItems(
      radicals.filter(r => r.level === currentLevel),
      radicals,
      kanji,
      vocabulary
    ).map(r => ({ type: 'radical' as ItemType, item: r }));
    
    const unlockableKanji = getUnlockableItems(
      kanji.filter(k => k.level === currentLevel),
      radicals,
      kanji,
      vocabulary
    ).map(k => ({ type: 'kanji' as ItemType, item: k }));
    
    const unlockableVocab = getUnlockableItems(
      vocabulary.filter(v => v.level === currentLevel),
      radicals,
      kanji,
      vocabulary
    ).map(v => ({ type: 'vocabulary' as ItemType, item: v }));

    return [...unlockableRadicals, ...unlockableKanji, ...unlockableVocab];
  }, [radicals, kanji, vocabulary, currentLevel]);

  useEffect(() => {
    if (viewMode === 'reviews' && !currentReviewItem) {
      const queue = reviewQueue();
      if (queue.length > 0) {
        setCurrentReviewItem(queue[0]);
        setShowAnswer(false);
        setUserInput('');
        setSelectedAnswer('');
        setFeedback(null);
        setShowMnemonic(false);
        generateOptionsForItem(queue[0]);
      } else {
        setCurrentReviewItem(null);
      }
    }
  }, [viewMode]);

  const generateOptionsForItem = (reviewItem: ReviewItem) => {
    if (reviewItem.type === 'radical') {
      const radical = reviewItem.item as Radical;
      const correctAnswer = quizMode === 'meaning' ? radical.meaning : radical.character;
      const otherRadicals = radicals
        .filter(r => r.id !== radical.id)
        .map(r => quizMode === 'meaning' ? r.meaning : r.character)
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
        .slice(0, 3);
      
      const allOptions = [correctAnswer, ...otherRadicals].sort(() => Math.random() - 0.5);
      setOptions(allOptions);
    } else if (reviewItem.type === 'kanji') {
      const kanjiItem = reviewItem.item as Kanji;
      const correctAnswer = quizMode === 'meaning' ? kanjiItem.meaning : kanjiItem.pronunciation;
      const otherKanji = kanji
        .filter(k => k.id !== kanjiItem.id)
        .map(k => quizMode === 'meaning' ? k.meaning : k.pronunciation)
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
        .slice(0, 3);
      
      const allOptions = [correctAnswer, ...otherKanji].sort(() => Math.random() - 0.5);
      setOptions(allOptions);
    } else {
      const vocabItem = reviewItem.item as Vocabulary;
      const correctAnswer = quizMode === 'meaning' ? vocabItem.meaning : vocabItem.pronunciation;
      const otherVocab = vocabulary
        .filter(v => v.id !== vocabItem.id)
        .map(v => quizMode === 'meaning' ? v.meaning : v.pronunciation)
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
        .slice(0, 3);
      
      const allOptions = [correctAnswer, ...otherVocab].sort(() => Math.random() - 0.5);
      setOptions(allOptions);
    }
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (!currentReviewItem || feedback) return;

    const updates = updateSRSProgress(currentReviewItem.item, isCorrect);
    
    if (currentReviewItem.type === 'radical') {
      storage.updateRadical(currentReviewItem.item.id, updates as Partial<Radical>);
    } else if (currentReviewItem.type === 'kanji') {
      storage.updateKanji(currentReviewItem.item.id, updates as Partial<Kanji>);
    } else {
      storage.updateVocabulary(currentReviewItem.item.id, updates as Partial<Vocabulary>);
    }

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${getCorrectAnswer(currentReviewItem)}"`,
    });

    // Refresh state
    const newState = storage.load();
    updateState({
      radicals: newState.radicals,
      kanji: newState.kanji,
      vocabulary: newState.vocabulary,
    });
  };

  const handleNextReview = () => {
    if (!feedback) return;
    
    // Get fresh review queue
    const freshRadicals = (storage.load().radicals || []).filter(r => r.language === language);
    const freshKanji = (storage.load().kanji || []).filter(k => k.language === language);
    const freshVocab = (storage.load().vocabulary || []).filter(v => v.language === language);
    
    const dueRadicals = getItemsDueForReview(freshRadicals).map(r => ({ type: 'radical' as ItemType, item: r }));
    const dueKanji = getItemsDueForReview(freshKanji).map(k => ({ type: 'kanji' as ItemType, item: k }));
    const dueVocab = getItemsDueForReview(freshVocab).map(v => ({ type: 'vocabulary' as ItemType, item: v }));
    const queue = [...dueRadicals, ...dueKanji, ...dueVocab].sort(() => Math.random() - 0.5);
    
    // Remove current item from queue
    const filteredQueue = queue.filter(item => 
      item.type !== currentReviewItem?.type || item.item.id !== currentReviewItem?.item.id
    );
    
    if (filteredQueue.length > 0) {
      setCurrentReviewItem(filteredQueue[0]);
      setShowAnswer(false);
      setUserInput('');
      setSelectedAnswer('');
      setFeedback(null);
      setShowMnemonic(false);
      generateOptionsForItem(filteredQueue[0]);
    } else {
      setCurrentReviewItem(null);
      setViewMode('dashboard');
    }
  };

  const getCorrectAnswer = (reviewItem: ReviewItem): string => {
    if (reviewItem.type === 'radical') {
      const radical = reviewItem.item as Radical;
      return quizMode === 'meaning' ? radical.meaning : radical.character;
    } else if (reviewItem.type === 'kanji') {
      const kanjiItem = reviewItem.item as Kanji;
      return quizMode === 'meaning' ? kanjiItem.meaning : kanjiItem.pronunciation;
    } else {
      const vocabItem = reviewItem.item as Vocabulary;
      return quizMode === 'meaning' ? vocabItem.meaning : vocabItem.pronunciation;
    }
  };

  const unlockItem = (item: ReviewItem) => {
    const updates = {
      srsStage: 'seed' as GlyphySRSStage,
      unlockedAt: Date.now(),
    };

    if (item.type === 'radical') {
      storage.updateRadical(item.item.id, updates as Partial<Radical>);
    } else if (item.type === 'kanji') {
      storage.updateKanji(item.item.id, updates as Partial<Kanji>);
    } else {
      storage.updateVocabulary(item.item.id, updates as Partial<Vocabulary>);
    }

    updateState({
      radicals: storage.load().radicals,
      kanji: storage.load().kanji,
      vocabulary: storage.load().vocabulary,
    });
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

  const getTypeColor = (type: ItemType): string => {
    switch (type) {
      case 'radical': return '#00a2ff';
      case 'kanji': return '#9e5bd9';
      case 'vocabulary': return '#f35656';
      default: return '#d0d7de';
    }
  };

  // Dashboard view
  if (viewMode === 'dashboard') {
    const levelRadicals = getItemsByLevel(radicals, currentLevel);
    const levelKanji = getItemsByLevel(kanji, currentLevel);
    const levelVocab = getItemsByLevel(vocabulary, currentLevel);
    const reviews = reviewQueue();

    return (
      <div className="glyphy-container">
        <div className="glyphy-header">
          <h1>Glyphy Character Learning</h1>
          <div className="language-selector">
            <button
              className={`btn ${language === 'japanese' ? 'btn-primary' : ''}`}
              onClick={() => setLanguage('japanese')}
            >
              Japanese
            </button>
            <button
              className={`btn ${language === 'chinese' ? 'btn-primary' : ''}`}
              onClick={() => setLanguage('chinese')}
            >
              Chinese
            </button>
          </div>
        </div>

        <div className="glyphy-stats">
          <div className="stat-card">
            <div className="stat-label">Reviews Available</div>
            <div className="stat-value" style={{ color: '#f35656' }}>{reviews.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Current Level</div>
            <div className="stat-value">{currentLevel}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Apprentices</div>
            <div className="stat-value" style={{ color: '#f35656' }}>
              {[...radicals, ...kanji, ...vocabulary].filter(i => i.srsStage === 'seed').length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Gurus</div>
            <div className="stat-value" style={{ color: '#9e5bd9' }}>
              {[...radicals, ...kanji, ...vocabulary].filter(i => i.srsStage === 'sprout').length}
            </div>
          </div>
        </div>

        <div className="glyphy-actions">
          <button
            className="btn btn-primary"
            onClick={() => setViewMode('reviews')}
            disabled={reviews.length === 0}
          >
            Start Reviews ({reviews.length})
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setViewMode('lessons')}
          >
            Lessons
          </button>
        </div>

        <div className="level-selector">
          <label>Level:</label>
          <select
            className="select"
            value={currentLevel}
            onChange={(e) => setCurrentLevel(parseInt(e.target.value))}
          >
            {Array.from({ length: 60 }, (_, i) => i + 1).map(level => (
              <option key={level} value={level}>Level {level}</option>
            ))}
          </select>
        </div>

        <div className="glyphy-level-content">
          <div className="item-section">
            <h2 style={{ color: getTypeColor('radical') }}>Radicals ({levelRadicals.length})</h2>
            <div className="item-grid">
              {levelRadicals.map(radical => (
                <div
                  key={radical.id}
                  className="item-card"
                  style={{ borderColor: getSRSColor(radical.srsStage) }}
                >
                  <div className="item-character">{radical.character}</div>
                  <div className="item-meaning">{radical.meaning}</div>
                  <div className="item-stage" style={{ backgroundColor: getSRSColor(radical.srsStage) }}>
                    {radical.srsStage}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="item-section">
            <h2 style={{ color: getTypeColor('kanji') }}>Kanji ({levelKanji.length})</h2>
            <div className="item-grid">
              {levelKanji.map(kanjiItem => (
                <div
                  key={kanjiItem.id}
                  className="item-card"
                  style={{ borderColor: getSRSColor(kanjiItem.srsStage) }}
                >
                  <div className="item-character">{kanjiItem.character}</div>
                  <div className="item-meaning">{kanjiItem.meaning}</div>
                  <div className="item-pronunciation">{kanjiItem.pronunciation}</div>
                  <div className="item-stage" style={{ backgroundColor: getSRSColor(kanjiItem.srsStage) }}>
                    {kanjiItem.srsStage}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="item-section">
            <h2 style={{ color: getTypeColor('vocabulary') }}>Vocabulary ({levelVocab.length})</h2>
            <div className="item-grid">
              {levelVocab.map(vocab => (
                <div
                  key={vocab.id}
                  className="item-card"
                  style={{ borderColor: getSRSColor(vocab.srsStage) }}
                >
                  <div className="item-character">{vocab.word}</div>
                  <div className="item-meaning">{vocab.meaning}</div>
                  <div className="item-pronunciation">{vocab.pronunciation}</div>
                  <div className="item-stage" style={{ backgroundColor: getSRSColor(vocab.srsStage) }}>
                    {vocab.srsStage}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lessons view
  if (viewMode === 'lessons') {
    const unlockable = unlockableItems();

    return (
      <div className="glyphy-container">
        <div className="glyphy-header">
          <h1>Lessons - Level {currentLevel}</h1>
          <button className="btn" onClick={() => setViewMode('dashboard')}>Back to Dashboard</button>
        </div>

        {unlockable.length === 0 ? (
          <div className="card">
            <p>No items available to unlock at this level. Complete previous levels first!</p>
          </div>
        ) : (
          <div className="lessons-grid">
            {unlockable.map((item, index) => (
              <div key={`${item.type}-${item.item.id}`} className="lesson-card">
                {item.type === 'radical' && (
                  <>
                    <div className="lesson-character">{(item.item as Radical).character}</div>
                    <div className="lesson-meaning">{(item.item as Radical).meaning}</div>
                    <div className="lesson-mnemonic">{(item.item as Radical).mnemonic}</div>
                    {(item.item as Radical).mnemonicImage && (
                      <img src={(item.item as Radical).mnemonicImage} alt="Mnemonic" className="lesson-image" />
                    )}
                  </>
                )}
                {item.type === 'kanji' && (
                  <>
                    <div className="lesson-character">{(item.item as Kanji).character}</div>
                    <div className="lesson-meaning">{(item.item as Kanji).meaning}</div>
                    <div className="lesson-pronunciation">{(item.item as Kanji).pronunciation}</div>
                    <div className="lesson-mnemonic">{(item.item as Kanji).mnemonic}</div>
                    {(item.item as Kanji).mnemonicImage && (
                      <img src={(item.item as Kanji).mnemonicImage} alt="Mnemonic" className="lesson-image" />
                    )}
                  </>
                )}
                {item.type === 'vocabulary' && (
                  <>
                    <div className="lesson-character">{(item.item as Vocabulary).word}</div>
                    <div className="lesson-meaning">{(item.item as Vocabulary).meaning}</div>
                    <div className="lesson-pronunciation">{(item.item as Vocabulary).pronunciation}</div>
                    {(item.item as Vocabulary).mnemonic && (
                      <div className="lesson-mnemonic">{(item.item as Vocabulary).mnemonic}</div>
                    )}
                    {(item.item as Vocabulary).mnemonicImage && (
                      <img src={(item.item as Vocabulary).mnemonicImage} alt="Mnemonic" className="lesson-image" />
                    )}
                  </>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => unlockItem(item)}
                >
                  Unlock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Reviews view
  if (!currentReviewItem) {
    return (
      <div className="wani-kani-container">
        <div className="card">
          <h2>No Reviews Available</h2>
          <p>Great job! You've completed all available reviews.</p>
          <button className="btn btn-primary" onClick={() => setViewMode('dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const item = currentReviewItem.item;
  const isRadical = currentReviewItem.type === 'radical';
  const isKanji = currentReviewItem.type === 'kanji';
  const isVocab = currentReviewItem.type === 'vocabulary';

  return (
    <div className="wani-kani-container">
      <div className="review-header">
        <div className="review-type-badge" style={{ backgroundColor: getTypeColor(currentReviewItem.type) }}>
          {currentReviewItem.type.toUpperCase()}
        </div>
        <div className="review-stage-badge" style={{ backgroundColor: getSRSColor(item.srsStage) }}>
          {item.srsStage}
        </div>
        <button className="btn" onClick={() => setViewMode('dashboard')}>Exit Review</button>
      </div>

      <div className="review-quiz">
        <div className="quiz-mode-selector">
          <button
            className={`btn ${quizMode === 'meaning' ? 'btn-primary' : ''}`}
            onClick={() => {
              setQuizMode('meaning');
              setShowAnswer(false);
              setUserInput('');
              setSelectedAnswer('');
              setFeedback(null);
              generateOptionsForItem(currentReviewItem);
            }}
          >
            Meaning
          </button>
          <button
            className={`btn ${quizMode === 'reading' ? 'btn-primary' : ''}`}
            onClick={() => {
              setQuizMode('reading');
              setShowAnswer(false);
              setUserInput('');
              setSelectedAnswer('');
              setFeedback(null);
              generateOptionsForItem(currentReviewItem);
            }}
          >
            Reading
          </button>
        </div>

        <div className="review-question">
          {quizMode === 'meaning' ? (
            <div className="question-character">
              {isRadical ? (item as Radical).character : 
               isKanji ? (item as Kanji).character : 
               (item as Vocabulary).word}
            </div>
          ) : (
            <div className="question-character">
              {isRadical ? (item as Radical).character : 
               isKanji ? (item as Kanji).character : 
               (item as Vocabulary).word}
            </div>
          )}
        </div>

        {!showAnswer && !feedback && (
          <div className="review-options">
            {options.map((option, index) => (
              <button
                key={index}
                className="quiz-option"
                onClick={() => {
                  const correct = option === getCorrectAnswer(currentReviewItem);
                  setSelectedAnswer(option);
                  handleAnswer(correct);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {feedback && (
          <div className={`review-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
            {feedback.message}
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
                  {isRadical ? (item as Radical).mnemonic :
                   isKanji ? (item as Kanji).mnemonic :
                   (item as Vocabulary).mnemonic || 'No mnemonic available'}
                </p>
                {(isRadical && (item as Radical).mnemonicImage) ||
                 (isKanji && (item as Kanji).mnemonicImage) ||
                 (isVocab && (item as Vocabulary).mnemonicImage) ? (
                  <img
                    src={
                      isRadical ? (item as Radical).mnemonicImage :
                      isKanji ? (item as Kanji).mnemonicImage :
                      (item as Vocabulary).mnemonicImage
                    }
                    alt="Mnemonic"
                    className="mnemonic-image"
                  />
                ) : null}
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

