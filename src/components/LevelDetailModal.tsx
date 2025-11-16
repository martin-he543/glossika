import { useState, useMemo } from 'react';
import { Word } from '../types';
import { getMasteryLevel } from '../utils/srs';

interface LevelDetailModalProps {
  level: number;
  words: Word[];
  course: { nativeLanguage: string; targetLanguage: string };
  onClose: () => void;
}

type SortField = 'word' | 'translation' | 'mastery' | 'srsLevel' | 'correct' | 'wrong' | 'accuracy';
type SortDirection = 'asc' | 'desc';

export default function LevelDetailModal({ level, words, course, onClose }: LevelDetailModalProps) {
  const [sortField, setSortField] = useState<SortField>('mastery');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const levelWords = words.filter(w => (w.level || 1) === level);
  
  const sortedWords = useMemo(() => {
    const sorted = [...levelWords].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'word':
          comparison = a.native.localeCompare(b.native);
          break;
        case 'translation':
          comparison = a.target.localeCompare(b.target);
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
        case 'accuracy':
          const aAccuracy = a.correctCount + a.wrongCount > 0
            ? a.correctCount / (a.correctCount + a.wrongCount)
            : 0;
          const bAccuracy = b.correctCount + b.wrongCount > 0
            ? b.correctCount / (b.correctCount + b.wrongCount)
            : 0;
          comparison = aAccuracy - bAccuracy;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [levelWords, sortField, sortDirection]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const stats = {
    total: levelWords.length,
    learned: levelWords.filter(w => w.srsLevel > 0).length,
    mastered: levelWords.filter(w => w.srsLevel >= 10 || w.masteryLevel === 'tree').length,
    totalCorrect: levelWords.reduce((sum, w) => sum + w.correctCount, 0),
    totalWrong: levelWords.reduce((sum, w) => sum + w.wrongCount, 0),
  };

  const getMasteryColor = (masteryLevel: string) => {
    switch (masteryLevel) {
      case 'seed': return '#656d76';
      case 'sprout': return '#1a7f37';
      case 'seedling': return '#0969da';
      case 'plant': return '#8250df';
      case 'tree': return '#9a6700';
      default: return '#656d76';
    }
  };

  const getMasteryEmoji = (masteryLevel: string) => {
    switch (masteryLevel) {
      case 'seed': return '🌱';
      case 'sprout': return '🌿';
      case 'seedling': return '🌱';
      case 'plant': return '🌳';
      case 'tree': return '🌲';
      default: return '🌱';
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Level {level} Words</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>Total Words</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>Learned</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a7f37' }}>{stats.learned}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>Mastered</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9a6700' }}>{stats.mastered}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>Correct Answers</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2da44e' }}>{stats.totalCorrect}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>Wrong Answers</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#da3633' }}>{stats.totalWrong}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>Accuracy</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {stats.totalCorrect + stats.totalWrong > 0 
                  ? Math.round((stats.totalCorrect / (stats.totalCorrect + stats.totalWrong)) * 100)
                  : 0}%
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <strong>{sortedWords.length}</strong> {sortedWords.length === 1 ? 'word' : 'words'} in Level {level}
          </div>

          {sortedWords.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
              No words in this level.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #d0d7de' }}>
                    <th 
                      style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('word')}
                    >
                      Word {getSortIcon('word')}
                    </th>
                    <th 
                      style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('translation')}
                    >
                      Translation {getSortIcon('translation')}
                    </th>
                    <th 
                      style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('mastery')}
                    >
                      Mastery {getSortIcon('mastery')}
                    </th>
                    <th 
                      style={{ padding: '8px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('srsLevel')}
                    >
                      SRS Level {getSortIcon('srsLevel')}
                    </th>
                    <th 
                      style={{ padding: '8px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('correct')}
                    >
                      Correct {getSortIcon('correct')}
                    </th>
                    <th 
                      style={{ padding: '8px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('wrong')}
                    >
                      Wrong {getSortIcon('wrong')}
                    </th>
                    <th 
                      style={{ padding: '8px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('accuracy')}
                    >
                      Accuracy {getSortIcon('accuracy')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWords.map(word => {
                    const accuracy = word.correctCount + word.wrongCount > 0
                      ? Math.round((word.correctCount / (word.correctCount + word.wrongCount)) * 100)
                      : 0;
                    const masteryColor = getMasteryColor(word.masteryLevel);
                    const masteryEmoji = getMasteryEmoji(word.masteryLevel);

                    return (
                      <tr key={word.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          {word.native}
                        </td>
                        <td style={{ padding: '12px', color: '#656d76' }}>
                          {word.target}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span 
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: `${masteryColor}20`,
                              color: masteryColor,
                              fontWeight: 500,
                              fontSize: '14px'
                            }}
                          >
                            {masteryEmoji} {word.masteryLevel}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#656d76' }}>
                          {word.srsLevel}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#2da44e', fontWeight: 600 }}>
                          {word.correctCount}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#da3633', fontWeight: 600 }}>
                          {word.wrongCount}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ 
                            fontWeight: 600,
                            color: accuracy >= 80 ? '#2da44e' : accuracy >= 60 ? '#fb8500' : '#da3633'
                          }}>
                            {accuracy}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="form-actions" style={{ marginTop: '16px' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

