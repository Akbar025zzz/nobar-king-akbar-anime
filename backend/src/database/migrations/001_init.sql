-- Nobar King Akbar Anime - initial schema
-- Versioned migration: 001_init

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#55CBD8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Reference index of content discovered from Anime1V (slug -> source URL).
-- Rooms, favorites and history reference content through this index.
CREATE TABLE IF NOT EXISTS content_index (
  source TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_url TEXT,
  source_ref TEXT,
  title TEXT NOT NULL,
  poster_url TEXT,
  backdrop_url TEXT,
  status TEXT,
  year TEXT,
  score NUMERIC,
  kind TEXT,
  genres JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, content_id)
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'anime1v',
  content_type TEXT NOT NULL DEFAULT 'anime',
  content_id TEXT NOT NULL,
  content_url TEXT,
  episode_id TEXT,
  episode_url TEXT,
  room_name TEXT NOT NULL,
  privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  playback_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rooms_live ON rooms(is_active, privacy, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_host ON rooms(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_content ON rooms(content_id);

CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_participants_room ON room_participants(room_id, last_seen DESC);

CREATE TABLE IF NOT EXISTS room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_room ON room_messages(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'anime1v',
  content_type TEXT NOT NULL DEFAULT 'anime',
  content_id TEXT NOT NULL,
  content_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, content_id)
);

CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'anime1v',
  content_type TEXT NOT NULL DEFAULT 'anime',
  content_id TEXT NOT NULL,
  content_url TEXT,
  episode_id TEXT,
  episode_url TEXT,
  position_seconds NUMERIC NOT NULL DEFAULT 0,
  duration_seconds NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, content_id)
);
CREATE INDEX IF NOT EXISTS idx_history_user ON watch_history(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_content ON watch_history(source, content_id, updated_at DESC);
