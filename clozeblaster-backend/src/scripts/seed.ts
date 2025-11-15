/**
 * Seed script to populate database with sample data
 * Usage: npm run seed
 */

import { pool } from '../db/connection';
import { generateClozeItems } from '../utils/cloze-generator';

interface SeedSentence {
  textNative: string;
  textTarget: string;
  difficulty: string;
  frequencyRank: number;
}

const SEED_SENTENCES: Record<string, SeedSentence[]> = {
  en: [
    { textNative: 'Hello, how are you?', textTarget: 'Bonjour, comment allez-vous ?', difficulty: 'easy', frequencyRank: 1 },
    { textNative: 'I love learning languages.', textTarget: 'J\'aime apprendre les langues.', difficulty: 'easy', frequencyRank: 2 },
    { textNative: 'The weather is beautiful today.', textTarget: 'Le temps est magnifique aujourd\'hui.', difficulty: 'medium', frequencyRank: 3 },
    { textNative: 'Can you help me with this?', textTarget: 'Pouvez-vous m\'aider avec cela ?', difficulty: 'medium', frequencyRank: 4 },
    { textNative: 'I need to buy some groceries.', textTarget: 'Je dois acheter des courses.', difficulty: 'medium', frequencyRank: 5 },
    { textNative: 'What time is it?', textTarget: 'Quelle heure est-il ?', difficulty: 'easy', frequencyRank: 6 },
    { textNative: 'Thank you very much.', textTarget: 'Merci beaucoup.', difficulty: 'easy', frequencyRank: 7 },
    { textNative: 'I don\'t understand.', textTarget: 'Je ne comprends pas.', difficulty: 'easy', frequencyRank: 8 },
    { textNative: 'Where is the nearest restaurant?', textTarget: 'Où est le restaurant le plus proche ?', difficulty: 'medium', frequencyRank: 9 },
    { textNative: 'I would like a coffee, please.', textTarget: 'Je voudrais un café, s\'il vous plaît.', difficulty: 'medium', frequencyRank: 10 },
  ],
  es: [
    { textNative: 'Hello, how are you?', textTarget: 'Hola, ¿cómo estás?', difficulty: 'easy', frequencyRank: 1 },
    { textNative: 'I love learning languages.', textTarget: 'Me encanta aprender idiomas.', difficulty: 'easy', frequencyRank: 2 },
    { textNative: 'The weather is beautiful today.', textTarget: 'El clima está hermoso hoy.', difficulty: 'medium', frequencyRank: 3 },
    { textNative: 'Can you help me with this?', textTarget: '¿Puedes ayudarme con esto?', difficulty: 'medium', frequencyRank: 4 },
    { textNative: 'I need to buy some groceries.', textTarget: 'Necesito comprar algunos comestibles.', difficulty: 'medium', frequencyRank: 5 },
  ]
};

async function seed() {
  try {
    console.log('Starting seed...');

    // Insert languages
    const languages = [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    ];

    const languageMap: Record<string, number> = {};

    for (const lang of languages) {
      const result = await pool.query(
        'INSERT INTO languages (code, name, native_name) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id',
        [lang.code, lang.name, lang.nativeName]
      );
      languageMap[lang.code] = result.rows[0].id;
      console.log(`Inserted language: ${lang.name} (ID: ${languageMap[lang.code]})`);
    }

    // Insert sentences and cloze items
    for (const [targetLang, sentences] of Object.entries(SEED_SENTENCES)) {
      const targetLangId = languageMap[targetLang];
      const nativeLangId = languageMap['en']; // Assume English as native

      if (!targetLangId || !nativeLangId) {
        console.warn(`Skipping ${targetLang}: language not found`);
        continue;
      }

      for (const sentence of sentences) {
        // Insert sentence
        const sentenceResult = await pool.query(
          `INSERT INTO sentences (language_id, text_native, text_target, difficulty, frequency_rank, source)
           VALUES ($1, $2, $3, $4, $5, 'seed')
           RETURNING id`,
          [targetLangId, sentence.textNative, sentence.textTarget, sentence.difficulty, sentence.frequencyRank]
        );
        const sentenceId = sentenceResult.rows[0].id;

        // Generate cloze items
        const clozeItems = generateClozeItems(sentence.textTarget, sentenceId);

        for (const item of clozeItems) {
          await pool.query(
            `INSERT INTO cloze_items (sentence_id, cloze_word, masked_text, word_position, mode_flags)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              sentenceId,
              item.clozeWord,
              item.maskedText,
              item.wordPosition,
              JSON.stringify({ mc: true, input: true, audio: true })
            ]
          );
        }

        console.log(`Inserted sentence: ${sentence.textNative} -> ${sentence.textTarget}`);
      }
    }

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();

