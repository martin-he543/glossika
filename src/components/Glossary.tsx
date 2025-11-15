import { useState, useMemo } from 'react';
import { AppState } from '../types';
import { storage } from '../storage';
import Papa from 'papaparse';

interface GlossaryProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

type WordSortField = 'native' | 'target' | 'course' | 'mastery' | 'srsLevel' | 'correct' | 'wrong';
type SentenceSortField = 'native' | 'target' | 'course' | 'mastery' | 'correct' | 'wrong';
type CharacterSortField = 'character' | 'meaning' | 'pronunciation' | 'language' | 'srsLevel' | 'correct' | 'wrong';
type SortDirection = 'asc' | 'desc';

export default function Glossary({ appState, updateState }: GlossaryProps) {
  const [activeTab, setActiveTab] = useState<'words' | 'sentences' | 'characters'>('words');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedClozeCourse, setSelectedClozeCourse] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<'japanese' | 'chinese' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [wordSortField, setWordSortField] = useState<WordSortField>('native');
  const [wordSortDirection, setWordSortDirection] = useState<SortDirection>('asc');
  const [sentenceSortField, setSentenceSortField] = useState<SentenceSortField>('native');
  const [sentenceSortDirection, setSentenceSortDirection] = useState<SortDirection>('asc');
  const [characterSortField, setCharacterSortField] = useState<CharacterSortField>('character');
  const [characterSortDirection, setCharacterSortDirection] = useState<SortDirection>('asc');

  const allWords = appState.words.filter(w => w.srsLevel > 0);
  const allSentences = appState.clozeSentences || [];
  const allCharacters = appState.kanji || [];
  const courses = appState.courses;
  const clozeCourses = appState.clozeCourses || [];

  const filteredWords = useMemo(() => {
    const filtered = allWords.filter(word => {
      const matchesCourse = selectedCourse === 'all' || word.courseId === selectedCourse;
      const matchesSearch = word.native.toLowerCase().includes(searchQuery.toLowerCase()) ||
        word.target.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCourse && matchesSearch;
    });
    
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      const courseA = courses.find(c => c.id === a.courseId);
      const courseB = courses.find(c => c.id === b.courseId);
      
      switch (wordSortField) {
        case 'native':
          comparison = a.native.localeCompare(b.native);
          break;
        case 'target':
          comparison = a.target.localeCompare(b.target);
          break;
        case 'course':
          comparison = (courseA?.name || '').localeCompare(courseB?.name || '');
          break;
        case 'mastery':
          const masteryOrder = { seed: 0, sprout: 1, seedling: 2, plant: 3, tree: 4 };
          const aMastery = masteryOrder[a.masteryLevel] || 0;
          const bMastery = masteryOrder[b.masteryLevel] || 0;
          comparison = aMastery - bMastery;
          break;
        case 'srsLevel':
          comparison = a.srsLevel - b.srsLevel;
          break;
        case 'correct':
          comparison = a.correctCount - b.correctCount;
          break;
        case 'wrong':
          comparison = a.wrongCount - b.wrongCount;
          break;
      }
      
      return wordSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [allWords, selectedCourse, searchQuery, wordSortField, wordSortDirection, courses]);
  
  const handleWordSort = (field: WordSortField) => {
    if (wordSortField === field) {
      setWordSortDirection(wordSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setWordSortField(field);
      setWordSortDirection('asc');
    }
  };
  
  const getWordSortIcon = (field: WordSortField) => {
    if (wordSortField !== field) return '↕️';
    return wordSortDirection === 'asc' ? '↑' : '↓';
  };

  const filteredSentences = useMemo(() => {
    const filtered = allSentences.filter(sentence => {
      const matchesCourse = selectedClozeCourse === 'all' || sentence.courseId === selectedClozeCourse;
      const matchesSearch = sentence.native.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sentence.target.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCourse && matchesSearch;
    });
    
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      const courseA = clozeCourses.find(c => c.id === a.courseId);
      const courseB = clozeCourses.find(c => c.id === b.courseId);
      
      switch (sentenceSortField) {
        case 'native':
          comparison = a.native.localeCompare(b.native);
          break;
        case 'target':
          comparison = a.target.localeCompare(b.target);
          break;
        case 'course':
          comparison = (courseA?.name || '').localeCompare(courseB?.name || '');
          break;
        case 'mastery':
          comparison = a.masteryLevel - b.masteryLevel;
          break;
        case 'correct':
          comparison = a.correctCount - b.correctCount;
          break;
        case 'wrong':
          comparison = a.wrongCount - b.wrongCount;
          break;
      }
      
      return sentenceSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [allSentences, selectedClozeCourse, searchQuery, sentenceSortField, sentenceSortDirection, clozeCourses]);
  
  const handleSentenceSort = (field: SentenceSortField) => {
    if (sentenceSortField === field) {
      setSentenceSortDirection(sentenceSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSentenceSortField(field);
      setSentenceSortDirection('asc');
    }
  };
  
  const getSentenceSortIcon = (field: SentenceSortField) => {
    if (sentenceSortField !== field) return '↕️';
    return sentenceSortDirection === 'asc' ? '↑' : '↓';
  };

  const filteredCharacters = useMemo(() => {
    const filtered = allCharacters.filter(kanji => {
      const matchesLanguage = selectedLanguage === 'all' || kanji.language === selectedLanguage;
      const matchesSearch = kanji.character.includes(searchQuery) ||
        kanji.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kanji.pronunciation.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLanguage && matchesSearch;
    });
    
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (characterSortField) {
        case 'character':
          comparison = a.character.localeCompare(b.character);
          break;
        case 'meaning':
          comparison = a.meaning.localeCompare(b.meaning);
          break;
        case 'pronunciation':
          comparison = a.pronunciation.localeCompare(b.pronunciation);
          break;
        case 'language':
          comparison = a.language.localeCompare(b.language);
          break;
        case 'srsLevel':
          const aLevel = typeof a.srsLevel === 'number' ? a.srsLevel : 0;
          const bLevel = typeof b.srsLevel === 'number' ? b.srsLevel : 0;
          comparison = aLevel - bLevel;
          break;
        case 'correct':
          comparison = a.correctCount - b.correctCount;
          break;
        case 'wrong':
          comparison = a.wrongCount - b.wrongCount;
          break;
      }
      
      return characterSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [allCharacters, selectedLanguage, searchQuery, characterSortField, characterSortDirection]);
  
  const handleCharacterSort = (field: CharacterSortField) => {
    if (characterSortField === field) {
      setCharacterSortDirection(characterSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCharacterSortField(field);
      setCharacterSortDirection('asc');
    }
  };
  
  const getCharacterSortIcon = (field: CharacterSortField) => {
    if (characterSortField !== field) return '↕️';
    return characterSortDirection === 'asc' ? '↑' : '↓';
  };


  const handleExportCSV = () => {
    const data = filteredWords.map(word => {
      const course = courses.find(c => c.id === word.courseId);
      return {
        'Native': word.native,
        'Target': word.target,
        'Course': course?.name || 'Unknown',
        'Mastery Level': word.masteryLevel,
        'SRS Level': word.srsLevel,
        'Correct Count': word.correctCount,
        'Wrong Count': word.wrongCount,
        'Last Reviewed': word.lastReviewed ? new Date(word.lastReviewed).toLocaleDateString() : 'Never',
      };
    });

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learned-words-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportSentencesCSV = () => {
    const data = filteredSentences.map(sentence => {
      const course = clozeCourses.find(c => c.id === sentence.courseId);
      return {
        'Native': sentence.native,
        'Target': sentence.target,
        'Course': course?.name || 'Unknown',
        'Language': sentence.language,
        'Mastery Level': sentence.masteryLevel,
        'Correct Count': sentence.correctCount,
        'Wrong Count': sentence.wrongCount,
      };
    });

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learned-sentences-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title">Glossary</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'words' && (
            <button className="btn btn-primary" onClick={handleExportCSV}>
              Export Words to CSV
            </button>
          )}
          {activeTab === 'sentences' && (
            <button className="btn btn-primary" onClick={handleExportSentencesCSV}>
              Export Sentences to CSV
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'words' ? 'active' : ''}`}
          onClick={() => setActiveTab('words')}
        >
          Words ({allWords.length})
        </button>
        <button
          className={`tab ${activeTab === 'sentences' ? 'active' : ''}`}
          onClick={() => setActiveTab('sentences')}
        >
          Sentences ({allSentences.length})
        </button>
        <button
          className={`tab ${activeTab === 'characters' ? 'active' : ''}`}
          onClick={() => setActiveTab('characters')}
        >
          Characters ({allCharacters.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'words' && (
          <>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '16px' }}>
                <div>
                  <label className="form-label">Search</label>
                  <input
                    type="text"
                    className="input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search words..."
                  />
                </div>
                <div>
                  <label className="form-label">Course</label>
                  <select
                    className="select"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                  >
                    <option value="all">All Courses</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ marginBottom: '16px' }}>
                <strong>{filteredWords.length}</strong> learned words
              </div>

              {filteredWords.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
                  No learned words found. Start learning to build your vocabulary!
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #d0d7de' }}>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleWordSort('native')}
                        >
                          Native {getWordSortIcon('native')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleWordSort('target')}
                        >
                          Target {getWordSortIcon('target')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleWordSort('course')}
                        >
                          Course {getWordSortIcon('course')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleWordSort('mastery')}
                        >
                          Mastery {getWordSortIcon('mastery')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleWordSort('srsLevel')}
                        >
                          SRS Level {getWordSortIcon('srsLevel')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleWordSort('correct')}
                        >
                          Correct {getWordSortIcon('correct')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleWordSort('wrong')}
                        >
                          Wrong {getWordSortIcon('wrong')}
                        </th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWords.map(word => {
                        const course = courses.find(c => c.id === word.courseId);
                        return (
                          <tr key={word.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                            <td style={{ padding: '8px' }}>{word.native}</td>
                            <td style={{ padding: '8px' }}>{word.target}</td>
                            <td style={{ padding: '8px' }}>{course?.name || 'Unknown'}</td>
                            <td style={{ padding: '8px' }}>
                              <span className={`tag`} style={{
                                backgroundColor: word.masteryLevel === 'tree' ? '#52be80' :
                                  word.masteryLevel === 'plant' ? '#76d7c4' :
                                  word.masteryLevel === 'seedling' ? '#85c1e2' :
                                  word.masteryLevel === 'sprout' ? '#a9dfbf' : '#f9e79f'
                              }}>
                                {word.masteryLevel}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>{word.srsLevel}</td>
                            <td style={{ padding: '8px' }}>{word.correctCount}</td>
                            <td style={{ padding: '8px' }}>{word.wrongCount}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  onClick={() => {
                                    storage.updateWord(word.id, { isDifficult: !word.isDifficult });
                                    updateState({ words: storage.load().words });
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    color: word.isDifficult ? '#ffd700' : '#d0d7de',
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title={word.isDifficult ? 'Remove from difficult words' : 'Mark as difficult'}
                                >
                                  {word.isDifficult ? '⚡' : ''}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to delete "${word.native}" - "${word.target}"?`)) {
                                      const state = storage.load();
                                      state.words = state.words.filter(w => w.id !== word.id);
                                      storage.save(state);
                                      updateState({ words: storage.load().words });
                                    }
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    color: '#da3633',
                                    padding: '4px 8px',
                                  }}
                                  title="Delete word"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'sentences' && (
          <>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '16px' }}>
                <div>
                  <label className="form-label">Search</label>
                  <input
                    type="text"
                    className="input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sentences..."
                  />
                </div>
                <div>
                  <label className="form-label">Course</label>
                  <select
                    className="select"
                    value={selectedClozeCourse}
                    onChange={(e) => setSelectedClozeCourse(e.target.value)}
                  >
                    <option value="all">All Courses</option>
                    {clozeCourses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ marginBottom: '16px' }}>
                <strong>{filteredSentences.length}</strong> sentences
              </div>

              {filteredSentences.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
                  No sentences found. Import sentences from a Sentence Course!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredSentences.map(sentence => {
                    const course = clozeCourses.find(c => c.id === sentence.courseId);
                    const isDifficult = sentence.wrongCount > sentence.correctCount;
                    return (
                      <div
                        key={sentence.id}
                        style={{
                          padding: '16px',
                          border: '1px solid #d0d7de',
                          borderRadius: '4px',
                          backgroundColor: '#ffffff',
                          position: 'relative',
                        }}
                      >
                        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              // Mark sentence as difficult by updating wrongCount
                              const newWrongCount = isDifficult ? sentence.correctCount : sentence.wrongCount + 100;
                              storage.updateClozeSentence(sentence.id, { wrongCount: newWrongCount });
                              updateState({ clozeSentences: storage.load().clozeSentences });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '20px',
                              color: isDifficult ? '#ffd700' : '#d0d7de',
                            }}
                            title={isDifficult ? 'Remove from difficult sentences' : 'Mark as difficult'}
                          >
                            {isDifficult ? '⚡' : ''}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete this sentence?`)) {
                                storage.deleteClozeSentence(sentence.id);
                                updateState({ clozeSentences: storage.load().clozeSentences });
                              }
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '16px',
                              color: '#da3633',
                              padding: '4px 8px',
                            }}
                            title="Delete sentence"
                          >
                            🗑️
                          </button>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                          {sentence.native}
                        </div>
                        <div style={{ fontSize: '16px', color: '#656d76', marginBottom: '8px' }}>
                          {sentence.target}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#656d76' }}>
                          <span>Course: {course?.name || 'Unknown'}</span>
                          <span>Mastery: {sentence.masteryLevel}/5</span>
                          <span>Correct: {sentence.correctCount}</span>
                          <span>Wrong: {sentence.wrongCount}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'characters' && (
          <>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '16px' }}>
                <div>
                  <label className="form-label">Search</label>
                  <input
                    type="text"
                    className="input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search characters by character, meaning, or pronunciation..."
                  />
                </div>
                <div>
                  <label className="form-label">Language</label>
                  <select
                    className="select"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value as 'japanese' | 'chinese' | 'all')}
                  >
                    <option value="all">All Languages</option>
                    <option value="japanese">Japanese</option>
                    <option value="chinese">Chinese</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ marginBottom: '16px' }}>
                <strong>{filteredCharacters.length}</strong> characters
              </div>

              {filteredCharacters.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
                  No characters found. Import characters from Glyphy!
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #d0d7de' }}>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleCharacterSort('character')}
                        >
                          Character {getCharacterSortIcon('character')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleCharacterSort('meaning')}
                        >
                          Meaning {getCharacterSortIcon('meaning')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleCharacterSort('pronunciation')}
                        >
                          Pronunciation {getCharacterSortIcon('pronunciation')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleCharacterSort('language')}
                        >
                          Language {getCharacterSortIcon('language')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleCharacterSort('srsLevel')}
                        >
                          SRS Level {getCharacterSortIcon('srsLevel')}
                        </th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Mastery</th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleCharacterSort('correct')}
                        >
                          Correct {getCharacterSortIcon('correct')}
                        </th>
                        <th 
                          style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleCharacterSort('wrong')}
                        >
                          Wrong {getCharacterSortIcon('wrong')}
                        </th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCharacters.map(kanji => {
                        return (
                          <tr key={kanji.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                            <td style={{ padding: '8px', fontSize: '24px', fontFamily: 'serif' }}>{kanji.character}</td>
                            <td style={{ padding: '8px' }}>{kanji.meaning}</td>
                            <td style={{ padding: '8px' }}>{kanji.pronunciation}</td>
                            <td style={{ padding: '8px' }}>{kanji.language === 'japanese' ? 'Japanese' : 'Chinese'}</td>
                            <td style={{ padding: '8px' }}>{kanji.srsStage}</td>
                            <td style={{ padding: '8px' }}>N/A</td>
                            <td style={{ padding: '8px' }}>{kanji.correctCount}</td>
                            <td style={{ padding: '8px' }}>{kanji.wrongCount}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete "${kanji.character}" (${kanji.meaning})?`)) {
                                    storage.deleteKanji(kanji.id);
                                    updateState({ kanji: storage.load().kanji });
                                  }
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  color: '#da3633',
                                  padding: '4px 8px',
                                }}
                                title="Delete character"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
