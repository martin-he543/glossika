/**
 * Generate cloze items from sentences
 * Creates multiple cloze variations for each sentence
 */

export interface ClozeItem {
  clozeWord: string;
  maskedText: string;
  wordPosition: number;
}

/**
 * Generate cloze items from a sentence
 * Creates one cloze item per word (excluding very short words)
 */
export function generateClozeItems(sentence: string, sentenceId: number): ClozeItem[] {
  const words = sentence.split(/(\s+)/);
  const items: ClozeItem[] = [];
  let position = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].trim();
    
    // Skip empty strings, very short words, and punctuation-only
    if (!word || word.length < 2 || /^[^\w]+$/.test(word)) {
      if (word) position++;
      continue;
    }

    // Create masked sentence
    const maskedWords = [...words];
    maskedWords[i] = '_____';
    const maskedText = maskedWords.join('');

    items.push({
      clozeWord: word,
      maskedText,
      wordPosition: position
    });

    position++;
  }

  return items;
}

/**
 * Generate a single random cloze item from a sentence
 */
export function generateRandomCloze(sentence: string): ClozeItem | null {
  const items = generateClozeItems(sentence, 0);
  if (items.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

