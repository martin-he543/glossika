import { GlyphySRSStage, Radical, Kanji, Vocabulary } from '../types';

// Mapping from old WaniKani stage names to new plant-based stages
const STAGE_MIGRATION_MAP: Record<string, GlyphySRSStage> = {
  'apprentice': 'seed',
  'guru': 'sprout',
  'master': 'seedling',
  'enlightened': 'plant',
  'burned': 'tree',
  'locked': 'locked',
  'seed': 'seed',
  'sprout': 'sprout',
  'seedling': 'seedling',
  'plant': 'plant',
  'tree': 'tree',
};

/**
 * Migrate old WaniKani SRS stage names to new plant-based stages
 */
export function migrateSRSStage(oldStage: string | undefined | null): GlyphySRSStage {
  if (!oldStage) return 'locked';
  const normalized = oldStage.toLowerCase().trim();
  return STAGE_MIGRATION_MAP[normalized] || 'locked';
}

/**
 * Migrate a Radical's SRS stage
 */
export function migrateRadical(radical: any): Radical {
  if (!radical) return radical;
  return {
    ...radical,
    srsStage: migrateSRSStage(radical.srsStage),
  };
}

/**
 * Migrate a Kanji's SRS stage
 */
export function migrateKanji(kanji: any): Kanji {
  if (!kanji) return kanji;
  return {
    ...kanji,
    srsStage: migrateSRSStage(kanji.srsStage),
  };
}

/**
 * Migrate a Vocabulary's SRS stage
 */
export function migrateVocabulary(vocab: any): Vocabulary {
  if (!vocab) return vocab;
  return {
    ...vocab,
    srsStage: migrateSRSStage(vocab.srsStage),
  };
}

