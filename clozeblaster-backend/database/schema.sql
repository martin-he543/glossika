-- ClozeBlaster Database Schema
-- PostgreSQL

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  preferred_languages JSONB DEFAULT '[]'::jsonb,
  streak INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Languages table
CREATE TABLE IF NOT EXISTS languages (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sentences table
CREATE TABLE IF NOT EXISTS sentences (
  id SERIAL PRIMARY KEY,
  language_id INTEGER REFERENCES languages(id) ON DELETE CASCADE,
  text_native TEXT NOT NULL,
  text_target TEXT NOT NULL,
  source VARCHAR(255),
  tags JSONB DEFAULT '[]'::jsonb,
  difficulty VARCHAR(20) DEFAULT 'medium',
  frequency_rank INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sentences_language ON sentences(language_id);
CREATE INDEX idx_sentences_difficulty ON sentences(difficulty);

-- Cloze items table (pre-generated cloze exercises)
CREATE TABLE IF NOT EXISTS cloze_items (
  id SERIAL PRIMARY KEY,
  sentence_id INTEGER REFERENCES sentences(id) ON DELETE CASCADE,
  cloze_word VARCHAR(255) NOT NULL,
  masked_text TEXT NOT NULL,
  word_position INTEGER NOT NULL,
  mode_flags JSONB DEFAULT '{"mc": true, "input": true, "audio": true}'::jsonb,
  audio_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cloze_items_sentence ON cloze_items(sentence_id);

-- User sentence progress table
CREATE TABLE IF NOT EXISTS user_sentence_progress (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  cloze_item_id INTEGER REFERENCES cloze_items(id) ON DELETE CASCADE,
  mastery_percent INTEGER DEFAULT 0 CHECK (mastery_percent >= 0 AND mastery_percent <= 100),
  srs_stage INTEGER DEFAULT 0,
  last_seen TIMESTAMP,
  next_review_at TIMESTAMP NOT NULL,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  srs_type VARCHAR(20) DEFAULT 'staged', -- 'staged' or 'sm2'
  sm2_ease_factor DECIMAL(5,2),
  sm2_interval INTEGER,
  sm2_repetition_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, cloze_item_id)
);

CREATE INDEX idx_progress_user ON user_sentence_progress(user_id);
CREATE INDEX idx_progress_next_review ON user_sentence_progress(next_review_at);
CREATE INDEX idx_progress_user_review ON user_sentence_progress(user_id, next_review_at);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  language_id INTEGER REFERENCES languages(id) ON DELETE CASCADE,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collections_owner ON collections(owner_id);
CREATE INDEX idx_collections_language ON collections(language_id);

-- Collection sentences junction table
CREATE TABLE IF NOT EXISTS collection_sentences (
  collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
  sentence_id INTEGER REFERENCES sentences(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, sentence_id)
);

CREATE INDEX idx_collection_sentences_collection ON collection_sentences(collection_id);
CREATE INDEX idx_collection_sentences_sentence ON collection_sentences(sentence_id);

-- Reviews table (for analytics)
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  cloze_item_id INTEGER REFERENCES cloze_items(id) ON DELETE CASCADE,
  answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_ms INTEGER,
  mastery_before INTEGER,
  mastery_after INTEGER,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_item ON reviews(cloze_item_id);
CREATE INDEX idx_reviews_created ON reviews(created_at);

-- Leaderboard entries table
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  language_id INTEGER REFERENCES languages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (language_id, user_id)
);

CREATE INDEX idx_leaderboard_language_points ON leaderboard_entries(language_id, points DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sentences_updated_at BEFORE UPDATE ON sentences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_updated_at BEFORE UPDATE ON user_sentence_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

