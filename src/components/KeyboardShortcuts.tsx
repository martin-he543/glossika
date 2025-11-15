interface KeyboardShortcut {
  key: string;
  description: string;
}

interface KeyboardShortcutsProps {
  mode: 'multiple' | 'type' | 'speed' | 'flashcard';
  hasFeedback?: boolean;
  customShortcuts?: KeyboardShortcut[];
}

export default function KeyboardShortcuts({ mode, hasFeedback, customShortcuts }: KeyboardShortcutsProps) {
  const defaultShortcuts: KeyboardShortcut[] = [];
  
  if (mode === 'multiple') {
    defaultShortcuts.push({ key: '1-4', description: 'Select option' });
    if (hasFeedback) {
      defaultShortcuts.push({ key: 'Space', description: 'Next question' });
    }
  } else if (mode === 'type') {
    defaultShortcuts.push({ key: 'Enter', description: 'Submit answer' });
    if (hasFeedback) {
      defaultShortcuts.push({ key: 'Space', description: 'Next question' });
    }
  } else if (mode === 'speed') {
    defaultShortcuts.push({ key: '1-4', description: 'Select option' });
  } else if (mode === 'flashcard') {
    defaultShortcuts.push(
      { key: 'Space', description: 'Flip card' },
      { key: '← →', description: 'Navigate' },
      { key: '1-4', description: 'Difficulty (Easy/Medium/Hard/Impossible)' }
    );
  }

  const allShortcuts = customShortcuts ? [...defaultShortcuts, ...customShortcuts] : defaultShortcuts;

  return (
    <div style={{
      marginTop: '32px',
      padding: '16px',
      backgroundColor: '#f6f8fa',
      border: '1px solid #d0d7de',
      borderRadius: '6px',
      fontSize: '13px',
    }}>
      <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Keyboard Shortcuts</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
        {allShortcuts.map((shortcut, idx) => (
          <div key={idx}>
            <strong>{shortcut.key}:</strong> {shortcut.description}
          </div>
        ))}
      </div>
    </div>
  );
}

