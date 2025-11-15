# Glossika - Language Learning Platform

A comprehensive language learning application combining features from Memrise, Quizlet, Anki, WaniKani, and more.

## Features

### Core Language Learning
- **Course Creation**: Create courses from CSV files with language selection
- **Learn New Words**: Type-in and multiple choice questions to translate between languages
- **Review Feature**: SRS-based review with "planting a garden" visualization
- **Speed Review**: Quick 60-second vocabulary challenges
- **Anki-style Flashcards**: SRS flashcards with keyboard shortcuts (Space to flip, 1-4 for difficulty, arrows to navigate)
- **Difficult Words**: Practice words you struggle with
- **Learned Words Database**: View and export your learned words to CSV

### Course Repository
- Publish courses publicly
- Browse and search courses by language and tags
- Import courses from the community
- GitHub-style settings menu for course configuration

### ClozeBlaster
- Fill-in-the-blank sentence practice (cloze deletion)
- Import from Tatoeba CSV files
- Multiple language support
- Progress tracking and mastery levels
- Statistics dashboard

### Glyphy (Kanji/Hanzi Learning)
- Learn Japanese Kanji and Chinese Hanzi
- Import from CSV (character, meaning, pronunciation)
- Learn, Review, and Quick Review modes
- Multiple choice and type-in questions
- Test meaning or pronunciation
- Statistics tracking

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Usage

1. **Create a Course**: Click "Create Course" and upload a CSV file with word pairs
2. **Learn Words**: Use the "Learn New Words" tab to start learning
3. **Review**: Use SRS-based review to strengthen your memory
4. **Flashcards**: Practice with Anki-style flashcards using keyboard shortcuts
5. **Publish**: Make your courses public in the Repository
6. **ClozeBlaster**: Import Tatoeba sentences for cloze deletion practice
7. **Glyphy**: Import Kanji/Hanzi and practice character recognition

## CSV Format

### Course Words
- Columns: `native`, `target` (or custom column names)
- Example: `hello,hola`

### Tatoeba Sentences (ClozeBlaster)
- Columns: `native`, `target`, `language`
- Example: `Hello world.,Hola mundo.,Spanish`

### Kanji/Hanzi (Glyphy)
- Columns: `character`, `meaning`, `pronunciation`
- Example: `日,sun,にち`

## Keyboard Shortcuts (Flashcards)

- **Space**: Flip card
- **← →**: Navigate previous/next
- **1**: Easy
- **2**: Medium
- **3**: Hard
- **4**: Impossible

## Design

- GitHub-inspired design (no gradients, clean interface)
- Right-aligned navigation bar
- Responsive layout
- Smooth animations

## Technologies

- React 18
- TypeScript
- Vite
- React Router
- PapaParse (CSV parsing)
- LocalStorage (data persistence)

