interface LessonSummaryProps {
  correct: number;
  total: number;
  timeElapsed: number; // in seconds
  newWordsLearned: number;
  onClose: () => void;
}

export default function LessonSummary({ correct, total, timeElapsed, newWordsLearned, onClose }: LessonSummaryProps) {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Lesson Summary</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '24px 0' }}>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#2da44e' }}>{correct}</div>
              <div className="stat-label">Correct</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#da3633' }}>{total - correct}</div>
              <div className="stat-label">Incorrect</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#0969da' }}>{accuracy}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#fb8500' }}>
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
              <div className="stat-label">Time Elapsed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#8250df' }}>{newWordsLearned}</div>
              <div className="stat-label">New Words Learned</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#24292f' }}>{total}</div>
              <div className="stat-label">Total Questions</div>
            </div>
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={onClose} style={{ padding: '12px 24px', fontSize: '16px' }}>
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

