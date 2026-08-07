-- 043_peer_games.sql
-- Peer mini-games: Tunnel-authoritative sessions + Member public availability.
-- Document-first JSONB collections (mood_playlists precedent) — required for Postgres backend.

CREATE TABLE IF NOT EXISTS peer_game_sessions (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_game_sessions_conversation
  ON peer_game_sessions ((data->>'conversationId'));
CREATE INDEX IF NOT EXISTS idx_peer_game_sessions_challenger
  ON peer_game_sessions ((data->>'challengerUserId'));
CREATE INDEX IF NOT EXISTS idx_peer_game_sessions_peer
  ON peer_game_sessions ((data->>'peerUserId'));
CREATE INDEX IF NOT EXISTS idx_peer_game_sessions_status
  ON peer_game_sessions ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_peer_game_sessions_slug
  ON peer_game_sessions ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_peer_game_sessions_message
  ON peer_game_sessions ((data->>'messageId'));
CREATE INDEX IF NOT EXISTS idx_peer_game_sessions_updated_at
  ON peer_game_sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_game_sessions_data_gin
  ON peer_game_sessions USING GIN (data);

COMMENT ON TABLE peer_game_sessions IS
  'Peer mini-game sessions — status pending|active|completed|declined|resigned; Tunnel fan-out game:{id}';

CREATE TABLE IF NOT EXISTS user_peer_games (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_peer_games_owner
  ON user_peer_games ((data->>'ownerId'));
CREATE INDEX IF NOT EXISTS idx_user_peer_games_username
  ON user_peer_games ((data->>'username'));
CREATE INDEX IF NOT EXISTS idx_user_peer_games_visibility
  ON user_peer_games ((data->>'visibility'));
CREATE INDEX IF NOT EXISTS idx_user_peer_games_data_gin
  ON user_peer_games USING GIN (data);

COMMENT ON TABLE user_peer_games IS
  'Member public peer-game availability — enabledSlugs[]; profile /{username}/games';

INSERT INTO schema_versions (version, description, applied_by)
SELECT '043',
       'Peer games: peer_game_sessions + user_peer_games JSONB collections',
       current_user
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '043'
);
