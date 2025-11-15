import { useState } from 'react';

interface QuestionCountSelectorProps {
  maxQuestions: number;
  defaultCount: number;
  onStart: (count: number) => void;
  onCancel: () => void;
}

export default function QuestionCountSelector({ maxQuestions, defaultCount, onStart, onCancel }: QuestionCountSelectorProps) {
  const [count, setCount] = useState(defaultCount);

  return (
    <div className="card">
      <h3 style={{ marginBottom: '16px' }}>How many questions would you like?</h3>
      <div className="form-group">
        <label className="form-label">Number of questions</label>
        <input
          type="number"
          className="input"
          value={count}
          onChange={(e) => {
            const value = parseInt(e.target.value) || 1;
            setCount(Math.min(Math.max(1, value), maxQuestions));
          }}
          min={1}
          max={maxQuestions}
        />
        <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
          Maximum: {maxQuestions} questions available
        </div>
      </div>
      <div className="form-actions" style={{ marginTop: '24px' }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onStart(count)}>
          Start
        </button>
      </div>
    </div>
  );
}

