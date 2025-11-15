# WaniKani-Style Character Course Redesign

## Overview
The Character Courses section has been completely redesigned to function like WaniKani, with structured level-based progression, mnemonic-driven learning, and a Radical → Character → Vocabulary hierarchy.

## Key Features Implemented

### 1. Data Model Updates

#### New Types (`src/types.ts`)
- **Radical**: Foundational components that combine into kanji
  - Includes character, meaning, mnemonic (text + optional image)
  - Level-based (1-60)
  - WaniKani SRS stages
  
- **Kanji** (Updated): Characters built from radicals
  - Includes radical dependencies
  - Mnemonic support
  - Pronunciation (On'yomi and Kun'yomi for Japanese)
  
- **Vocabulary**: Words built from kanji
  - Includes kanji dependencies
  - Optional mnemonics
  - Example sentences

- **WaniKaniSRSStage**: Type for SRS progression
  - `locked` → `apprentice` → `guru` → `master` → `enlightened` → `burned`

### 2. SRS System (`src/utils/waniKaniSRS.ts`)

WaniKani-style spaced repetition with 5 stages:
- **Apprentice** (Red): 4-hour intervals, 2 correct answers to advance
- **Guru** (Purple): 8-hour intervals, 4 correct answers to advance
- **Master** (Blue): 1-day intervals, 6 correct answers to advance
- **Enlightened** (Light Blue): 7-day intervals, 8 correct answers to advance
- **Burned** (Gray): Never review again

Features:
- Automatic progression based on correct answers
- Reset to apprentice on incorrect answers
- Review queue management
- Level unlocking based on prerequisites

### 3. Storage Updates (`src/storage.ts`)

Added full CRUD operations for:
- Radicals: `addRadical`, `updateRadical`, `deleteRadical`
- Vocabulary: `addVocabulary`, `updateVocabulary`, `deleteVocabulary`
- Updated `AppState` to include `radicals` and `vocabulary` arrays

### 4. UI Component (`src/components/WaniKaniGlyphy.tsx`)

#### Dashboard View
- **Statistics Cards**: Reviews available, current level, apprentices, gurus
- **Level Selector**: Navigate between levels 1-60
- **Item Grids**: Card-based display for radicals, kanji, and vocabulary
  - Color-coded by SRS stage
  - Type indicators (radical/kanji/vocab)
  - Visual hierarchy

#### Lessons View
- Unlockable items for current level
- Prerequisite checking (radicals must be unlocked before kanji, kanji before vocab)
- Mnemonic display with optional images
- One-click unlocking

#### Reviews View
- **Quiz Modes**: Meaning or Reading
- **Multiple Choice**: 4 options with immediate feedback
- **Mnemonic Display**: Show/hide mnemonic after answering
- **Auto-advance**: Moves to next review automatically
- **Progress Tracking**: Updates SRS stage based on performance

### 5. Visual Design (`src/components/WaniKaniGlyphy.css`)

- **Color Themes**:
  - Radicals: Blue (#00a2ff)
  - Kanji: Purple (#9e5bd9)
  - Vocabulary: Red (#f35656)
  
- **SRS Stage Colors**:
  - Apprentice: Red (#f35656)
  - Guru: Purple (#9e5bd9)
  - Master: Blue (#00a2ff)
  - Enlightened: Light Blue (#00c2ff)
  - Burned: Gray (#4a4a4a)
  - Locked: Light Gray (#d0d7de)

- **Card-based Layout**: Clean, minimalist design similar to WaniKani
- **Responsive**: Mobile-friendly grid layouts

## File Structure

```
src/
├── types.ts                    # Updated with Radical, Vocabulary, WaniKaniSRSStage
├── storage.ts                  # Added radical and vocabulary operations
├── utils/
│   └── waniKaniSRS.ts         # NEW: WaniKani SRS logic
└── components/
    ├── WaniKaniGlyphy.tsx     # NEW: Main component
    └── WaniKaniGlyphy.css     # NEW: Styling
```

## Usage

### Accessing the Component
Navigate to `/wanikani` or click on a Character Course from the Dashboard.

### Creating Content
Currently, content must be created programmatically or imported. Future updates should include:
- CSV import for radicals, kanji, and vocabulary
- Manual creation forms
- Mnemonic image upload

### Example Data Structure

```typescript
// Radical
{
  id: "radical-1",
  character: "一",
  meaning: "one",
  mnemonic: "This radical looks like the number one...",
  mnemonicImage: "data:image/...",
  language: "japanese",
  level: 1,
  srsStage: "locked",
  correctCount: 0,
  wrongCount: 0,
  createdAt: Date.now()
}

// Kanji
{
  id: "kanji-1",
  character: "一",
  meaning: "one",
  pronunciation: "いち",
  mnemonic: "This kanji means one...",
  radicalIds: ["radical-1"],
  language: "japanese",
  level: 1,
  srsStage: "locked",
  correctCount: 0,
  wrongCount: 0,
  createdAt: Date.now()
}

// Vocabulary
{
  id: "vocab-1",
  word: "一つ",
  meaning: "one thing",
  pronunciation: "ひとつ",
  kanjiIds: ["kanji-1"],
  language: "japanese",
  level: 1,
  srsStage: "locked",
  correctCount: 0,
  wrongCount: 0,
  createdAt: Date.now()
}
```

## Future Enhancements

1. **CSV Import**: Support importing radicals, kanji, and vocabulary from CSV files
2. **Mnemonic Editor**: Rich text editor for creating mnemonics with image upload
3. **Advanced SRS**: Track consecutive correct answers separately
4. **Level Progression**: Visual progress bars and level-up animations
5. **Statistics Dashboard**: Detailed analytics on learning progress
6. **Audio Pronunciation**: Text-to-speech for reading practice
7. **Stroke Order**: Animated stroke order diagrams for kanji

## Migration Notes

- Existing kanji data will need to be migrated to the new structure
- Old `srsLevel` and `masteryLevel` fields are replaced with `srsStage`
- New items should be initialized with `srsStage: 'locked'`
- Level unlocking requires all previous level items to be at least "guru" stage

