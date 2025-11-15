import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, Kanji } from '../types';
import { storage } from '../storage';
import { parseCSV, createKanjiFromCSV } from '../utils/csv';
import KeyboardShortcuts from './KeyboardShortcuts';

interface GlyphyProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function Glyphy({ appState, updateState }: GlyphyProps) {
  const [activeTab, setActiveTab] = useState<'learn' | 'review' | 'quick' | 'statistics'>('learn');
  const [language, setLanguage] = useState<'japanese' | 'chinese'>('japanese');
  const [currentKanji, setCurrentKanji] = useState<Kanji | null>(null);
  const [mode, setMode] = useState<'multiple' | 'type'>('multiple');
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [questionType, setQuestionType] = useState<'meaning' | 'pronunciation'>('meaning');
  const [quickReviewCount, setQuickReviewCount] = useState(20);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quickReviewWords, setQuickReviewWords] = useState<Kanji[]>([]);
  const [delimiter, setDelimiter] = useState<string>('auto');
  const [additionalColumns, setAdditionalColumns] = useState<string[]>([]);
  const currentKanjiIdRef = useRef<string | null>(null);

  const kanji = useMemo(() => appState.kanji.filter(k => k.language === language), [appState.kanji, language]);
  // Support both old (srsLevel) and new (srsStage) interfaces
  const newKanji = useMemo(() => kanji.filter(k => {
    if (k.srsLevel !== undefined) return k.srsLevel === 0;
    return k.srsStage === 'locked' || k.srsStage === 'seed';
  }), [kanji]);
  const reviewKanji = useMemo(() => kanji.filter(k => {
    if (k.srsLevel !== undefined) return k.srsLevel > 0;
    return k.srsStage !== 'locked' && k.srsStage !== 'tree';
  }), [kanji]);

  const generateOptions = useCallback((current: Kanji) => {
    if (!current) return;
    // Only generate options if this is a different kanji
    if (currentKanjiIdRef.current === current.id) {
      return; // Options already generated for this kanji
    }
    currentKanjiIdRef.current = current.id;
    
    const correctAnswer = questionType === 'meaning' ? current.meaning : current.pronunciation;
    const otherKanji = kanji
      .filter(k => k.id !== current.id)
      .map(k => questionType === 'meaning' ? k.meaning : k.pronunciation)
      .filter((val, idx, arr) => arr.indexOf(val) === idx);

    const shuffled = [...otherKanji].sort(() => Math.random() - 0.5);
    const wrongAnswers = shuffled.slice(0, 3);
    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
  }, [kanji, questionType]);

  const loadNextKanji = useCallback(() => {
    const availableKanji = activeTab === 'learn' ? newKanji : reviewKanji;
    if (availableKanji.length === 0) {
      setCurrentKanji(null);
      setOptions([]);
      currentKanjiIdRef.current = null;
      return;
    }

    const randomKanji = availableKanji[Math.floor(Math.random() * availableKanji.length)];
    setCurrentKanji(randomKanji);
    setSelectedAnswer('');
    setUserInput('');
    setFeedback(null);
    currentKanjiIdRef.current = null; // Reset ref so options will be generated

    // Only generate options if in multiple choice mode
    if (mode === 'multiple' && randomKanji) {
      generateOptions(randomKanji);
    } else {
      setOptions([]);
    }
  }, [activeTab, newKanji, reviewKanji, mode, generateOptions]);

  useEffect(() => {
    // Only load initial kanji when switching tabs or language, not on every render
    if (activeTab === 'learn' && newKanji.length > 0 && !currentKanji) {
      loadNextKanji();
    } else if (activeTab === 'review' && reviewKanji.length > 0 && !currentKanji && !feedback) {
      loadNextKanji();
    }
    // Quick review is handled separately via button click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, language]);

  const loadQuickReview = () => {
    const shuffled = reviewKanji.sort(() => Math.random() - 0.5).slice(0, quickReviewCount);
    setQuickReviewWords(shuffled);
    setCurrentIndex(0);
    if (shuffled.length > 0) {
      setCurrentKanji(shuffled[0]);
      if (mode === 'multiple') {
        generateOptions(shuffled[0]);
      }
    }
  };

  const handleMultipleChoice = useCallback((answer: string) => {
    if (feedback || !currentKanji) return;

    const correctAnswer = questionType === 'meaning' ? currentKanji.meaning : currentKanji.pronunciation;
    const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    setSelectedAnswer(answer);
    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    // Update progress but don't regenerate options
    updateKanjiProgress(isCorrect);
  }, [feedback, currentKanji, questionType]);

  const handleTypeAnswer = useCallback(() => {
    if (feedback || !userInput.trim() || !currentKanji) return;

    const correctAnswer = questionType === 'meaning' ? currentKanji.meaning : currentKanji.pronunciation;
    const isCorrect = userInput.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    updateKanjiProgress(isCorrect);
  }, [feedback, userInput, currentKanji, questionType]);

  const handleNext = useCallback(() => {
    if (!feedback) return;
    
    if (activeTab === 'quick') {
      if (currentIndex < quickReviewWords.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setCurrentKanji(quickReviewWords[nextIndex]);
        setSelectedAnswer('');
        setUserInput('');
        setFeedback(null);
        if (mode === 'multiple' && quickReviewWords[nextIndex]) {
          generateOptions(quickReviewWords[nextIndex]);
        }
      } else {
        loadQuickReview();
      }
    } else {
      // For learn and review modes, load next kanji
      loadNextKanji();
    }
  }, [feedback, activeTab, currentIndex, quickReviewWords, mode, generateOptions, loadNextKanji]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in input
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter') return; // Allow Enter to submit
        return;
      }

      if (feedback) {
        // After feedback, Space goes to next
        if (e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      } else if (mode === 'multiple') {
        // Multiple choice: 1-4 select options
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          if (options[index] && currentKanji) {
            handleMultipleChoice(options[index]);
          }
        }
      } else if (e.key === 'Enter' && userInput.trim()) {
        e.preventDefault();
        handleTypeAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [feedback, mode, options, userInput, currentKanji, handleNext, handleMultipleChoice, handleTypeAnswer]);

  const updateKanjiProgress = (isCorrect: boolean) => {
    if (!currentKanji) return;

    // Support both old and new interfaces
    if (currentKanji.srsLevel !== undefined) {
      // Old interface - update legacy properties
      const newSrsLevel = isCorrect ? (currentKanji.srsLevel || 0) + 1 : Math.max(0, (currentKanji.srsLevel || 0) - 1);
      const newMasteryLevel = Math.min(5, Math.floor(newSrsLevel / 2));
      
      let newWaniKaniLevel = currentKanji.waniKaniLevel || 1;
      if (newMasteryLevel >= 5 && newSrsLevel >= 10 && isCorrect) {
        if (newWaniKaniLevel < 60) {
          newWaniKaniLevel = Math.min(60, newWaniKaniLevel + 1);
        }
      }

      storage.updateKanji(currentKanji.id, {
        srsLevel: newSrsLevel,
        masteryLevel: newMasteryLevel,
        waniKaniLevel: newWaniKaniLevel,
        correctCount: currentKanji.correctCount + (isCorrect ? 1 : 0),
        wrongCount: currentKanji.wrongCount + (isCorrect ? 0 : 1),
      });
    } else {
      // New interface - update using Glyphy SRS
      const { updateSRSProgress } = require('../utils/glyphySRS');
      const updates = updateSRSProgress(currentKanji, isCorrect);
      storage.updateKanji(currentKanji.id, {
        ...updates,
        correctCount: currentKanji.correctCount + (isCorrect ? 1 : 0),
        wrongCount: currentKanji.wrongCount + (isCorrect ? 0 : 1),
      });
    }

    updateState({ kanji: storage.load().kanji });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);
    setProgress(0);

    try {
      // Determine delimiter
      let fileDelimiter: string | undefined = undefined;
      if (delimiter !== 'auto') {
        fileDelimiter = delimiter === 'semicolon' ? ';' : delimiter === 'tab' ? '\t' : ',';
      } else {
        const fileName = selectedFile.name.toLowerCase();
        if (fileName.endsWith('.tsv')) {
          fileDelimiter = '\t';
        }
      }

      // Parse CSV with progress tracking
      const rows = await parseCSV(selectedFile, (progress) => {
        // Use requestAnimationFrame for smooth progress updates
        requestAnimationFrame(() => {
          setProgress(Math.min(40, progress * 0.4)); // 40% for parsing
        });
      }, fileDelimiter);

      // Detect additional columns
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const standardCols = ['character', 'kanji', 'hanzi', 'meaning', 'meanings', 'pronunciation', 'reading', 'pinyin'];
        const otherCols = headers.filter(h => 
          !standardCols.some(sc => h.toLowerCase().includes(sc.toLowerCase()))
        );
        setAdditionalColumns(otherCols);
      }

      setProgress(50);

      // Process in batches for large files
      const BATCH_SIZE = 1000;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      const allKanji: any[] = [];
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, rows.length);
        const batch = rows.slice(start, end);
        
        const batchKanji = createKanjiFromCSV(batch, language, `glyphy-${language}`, undefined, undefined, undefined, undefined);
        allKanji.push(...batchKanji);
        
        // Update progress with requestAnimationFrame for smooth UI updates
        const progressPercent = 50 + Math.floor(((i + 1) / totalBatches) * 40);
        requestAnimationFrame(() => {
          setProgress(progressPercent);
        });
        
        // Yield to browser for large files
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Save in batches to avoid localStorage issues
      setProgress(90);
      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < allKanji.length; i += SAVE_BATCH_SIZE) {
        const batch = allKanji.slice(i, i + SAVE_BATCH_SIZE);
        for (const k of batch) {
          storage.addKanji(k);
        }
        
        const saveProgress = 90 + Math.floor((i / allKanji.length) * 10);
        requestAnimationFrame(() => {
          setProgress(Math.min(99, saveProgress));
        });
        
        // Yield to browser periodically for large files
        if (i % (SAVE_BATCH_SIZE * 5) === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      setProgress(100);
      updateState({ kanji: storage.load().kanji });
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import kanji');
      setLoading(false);
      setProgress(0);
    }
  };

  // Calculate level stats (support both old and new interfaces)
  const levelStats = Array.from({ length: 60 }, (_, i) => {
    const level = i + 1;
    const kanjiAtLevel = kanji.filter(k => {
      if (k.waniKaniLevel !== undefined) return (k.waniKaniLevel || 1) === level;
      return k.level === level;
    });
    return {
      level,
      total: kanjiAtLevel.length,
      mastered: kanjiAtLevel.filter(k => {
        if (k.masteryLevel !== undefined) return k.masteryLevel >= 5;
        return k.srsStage === 'seedling' || k.srsStage === 'plant' || k.srsStage === 'tree';
      }).length,
    };
  });

  const currentLevel = Math.max(...kanji.map(k => k.waniKaniLevel || 1), 1);
  const nextLevelProgress = kanji.filter(k => (k.waniKaniLevel || 1) === currentLevel && (k.masteryLevel !== undefined ? k.masteryLevel >= 5 : (k.srsStage === 'seedling' || k.srsStage === 'plant' || k.srsStage === 'tree'))).length;
  const nextLevelTotal = kanji.filter(k => (k.waniKaniLevel || 1) === currentLevel).length;

  const stats = {
    total: kanji.length,
    new: newKanji.length,
    learning: kanji.filter(k => {
      if (k.srsLevel !== undefined) return k.srsLevel > 0 && k.srsLevel < 5;
      return k.srsStage === 'seed' || k.srsStage === 'sprout';
    }).length,
    mastered: kanji.filter(k => {
      if (k.srsLevel !== undefined) return k.srsLevel >= 5;
      return k.srsStage === 'seedling' || k.srsStage === 'plant' || k.srsStage === 'tree';
    }).length,
    totalCorrect: kanji.reduce((sum, k) => sum + k.correctCount, 0),
    totalWrong: kanji.reduce((sum, k) => sum + k.wrongCount, 0),
    currentLevel,
    nextLevelProgress,
    nextLevelTotal,
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <h1 className="card-title">Glyphy - {language === 'japanese' ? 'Kanji' : 'Hanzi'} Learning</h1>
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            Level {stats.currentLevel} • {stats.nextLevelProgress} / {stats.nextLevelTotal} mastered at current level
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
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

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'learn' ? 'active' : ''}`}
          onClick={() => setActiveTab('learn')}
        >
          Learn
        </button>
        <button
          className={`tab ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          Review
        </button>
        <button
          className={`tab ${activeTab === 'quick' ? 'active' : ''}`}
          onClick={() => setActiveTab('quick')}
        >
          Quick Review
        </button>
        <button
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          Statistics
        </button>
      </div>

      <div className="tab-content">
        {(activeTab === 'learn' || activeTab === 'review') && (
          <div>
            {activeTab === 'learn' && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <h3>Import {language === 'japanese' ? 'Kanji' : 'Hanzi'}</h3>
                <div className="form-group">
                  <label className="form-label">CSV/TSV File (columns: character, meaning, pronunciation)</label>
                  <input type="file" accept=".csv,.tsv" onChange={handleFileImport} />
                  <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                    Supports CSV (.csv) and TSV (.tsv) files
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Delimiter</label>
                  <select
                    className="select"
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                  >
                    <option value="auto">Auto-detect (from file extension)</option>
                    <option value="comma">Comma (,)</option>
                    <option value="semicolon">Semicolon (;)</option>
                    <option value="tab">Tab (TSV)</option>
                  </select>
                  <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                    TSV files automatically use tab delimiter
                  </div>
                </div>

                {loading && (
                  <div className="form-group">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                      {progress < 100 ? `Processing... ${progress}%` : 'Complete!'}
                    </div>
                  </div>
                )}

                {error && <div className="error" style={{ marginTop: '8px' }}>{error}</div>}

                {additionalColumns.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Additional Columns Detected (optional)</label>
                    <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '8px' }}>
                      These columns will be preserved but are not required for kanji creation.
                      Examples: notes, stroke count, radical, etc.
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', backgroundColor: '#f6f8fa', borderRadius: '4px' }}>
                      {additionalColumns.map(col => (
                        <span key={col} style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#ffffff', border: '1px solid #d0d7de', borderRadius: '4px' }}>
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                className={`btn ${mode === 'multiple' ? 'btn-primary' : ''}`}
                onClick={() => setMode('multiple')}
              >
                Multiple Choice
              </button>
              <button
                className={`btn ${mode === 'type' ? 'btn-primary' : ''}`}
                onClick={() => setMode('type')}
              >
                Type Answer
              </button>
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                className={`btn ${questionType === 'meaning' ? 'btn-primary' : ''}`}
                onClick={() => setQuestionType('meaning')}
              >
                Test Meaning
              </button>
              <button
                className={`btn ${questionType === 'pronunciation' ? 'btn-primary' : ''}`}
                onClick={() => setQuestionType('pronunciation')}
              >
                Test Pronunciation
              </button>
            </div>

            {!currentKanji ? (
              <div className="card">
                <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
                  {activeTab === 'learn'
                    ? 'No new kanji available. Import some first!'
                    : 'No kanji to review. Learn some first!'}
                </p>
              </div>
            ) : (
              <div className="quiz-container">
                <div className="quiz-question" style={{ fontSize: '64px', fontFamily: 'serif' }}>
                  {currentKanji.character}
                </div>

                {mode === 'multiple' ? (
                  <div className="quiz-options">
                    {options.map((option, idx) => {
                      const isSelected = selectedAnswer === option;
                      const correctAnswer = questionType === 'meaning' ? currentKanji.meaning : currentKanji.pronunciation;
                      const isCorrect = option.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

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
                      type="text"
                      className="quiz-input"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleTypeAnswer()}
                      placeholder={`Type the ${questionType}...`}
                      disabled={!!feedback}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleTypeAnswer}
                      disabled={!!feedback || !userInput.trim()}
                      style={{ width: '100%' }}
                    >
                      Check Answer
                    </button>
                  </div>
                )}

                {feedback && (
                  <div>
                    <div className={`quiz-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.message}
                    </div>
                    {currentKanji.exampleWords && currentKanji.exampleWords.length > 0 && (
                      <div className="card" style={{ marginTop: '16px' }}>
                        <h4>Example Words:</h4>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                          {currentKanji.exampleWords.map((word, idx) => (
                            <li key={idx}>{word}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button className="btn btn-primary" onClick={loadNextKanji} style={{ width: '100%', marginTop: '16px' }}>
                      Next {language === 'japanese' ? 'Kanji' : 'Hanzi'}
                    </button>
                  </div>
                )}

                <KeyboardShortcuts mode={mode} hasFeedback={!!feedback} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'quick' && (
          <div>
            {quickReviewWords.length === 0 ? (
              <div className="card">
                <h3>Quick Review</h3>
                <div className="form-group">
                  <label className="form-label">Number of {language === 'japanese' ? 'Kanji' : 'Hanzi'} to review</label>
                  <input
                    type="number"
                    className="input"
                    value={quickReviewCount}
                    onChange={(e) => setQuickReviewCount(parseInt(e.target.value) || 20)}
                    min={1}
                    max={kanji.length}
                  />
                </div>
                <button className="btn btn-primary" onClick={loadQuickReview} style={{ width: '100%' }}>
                  Start Quick Review
                </button>
              </div>
            ) : (
              <div className="quiz-container">
                <div style={{ textAlign: 'center', marginBottom: '16px', color: '#656d76' }}>
                  {currentIndex + 1} / {quickReviewWords.length}
                </div>
                {currentKanji && (
                  <>
                    <div className="quiz-question" style={{ fontSize: '64px', fontFamily: 'serif' }}>
                      {currentKanji.character}
                    </div>
                    <div className="quiz-options">
                      {options.map((option, idx) => {
                        const isSelected = selectedAnswer === option;
                        const correctAnswer = questionType === 'meaning' ? currentKanji.meaning : currentKanji.pronunciation;
                        const isCorrect = option.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

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
                  </>
                )}

                <KeyboardShortcuts mode="multiple" hasFeedback={false} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'statistics' && (
          <div>
            <div className="card" style={{ marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '12px' }}>Level: {stats.currentLevel}</h3>
              <div className="progress-bar" style={{ marginBottom: '8px' }}>
                <div className="progress-fill" style={{ width: `${stats.nextLevelTotal > 0 ? (stats.nextLevelProgress / stats.nextLevelTotal) * 100 : 0}%` }} />
              </div>
              <div style={{ fontSize: '14px', color: '#656d76' }}>
                {stats.nextLevelProgress} / {stats.nextLevelTotal} mastered at level {stats.currentLevel}
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total {language === 'japanese' ? 'Kanji' : 'Hanzi'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.new}</div>
                <div className="stat-label">New</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.learning}</div>
                <div className="stat-label">Learning</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.mastered}</div>
                <div className="stat-label">Mastered</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalCorrect}</div>
                <div className="stat-label">Total Correct</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalWrong}</div>
                <div className="stat-label">Total Wrong</div>
              </div>
            </div>

            <div className="card" style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '12px' }}>Level Distribution</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {levelStats.filter(s => s.total > 0).map(stat => (
                  <div key={stat.level} style={{ padding: '8px', border: '1px solid #d0d7de', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '18px' }}>L{stat.level}</div>
                    <div style={{ fontSize: '12px', color: '#656d76' }}>
                      {stat.mastered}/{stat.total}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

