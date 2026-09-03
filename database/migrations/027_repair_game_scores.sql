-- Repair older game_scores tables that existed before migration 022.
CREATE TABLE IF NOT EXISTS game_scores (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    distance INTEGER NOT NULL DEFAULT 0,
    survival_time INTEGER NOT NULL DEFAULT 0,
    difficulty_level INTEGER NOT NULL DEFAULT 1,
    synced BOOLEAN NOT NULL DEFAULT FALSE,
    played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT game_scores_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS distance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS survival_time INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS difficulty_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS synced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_game_type ON game_scores(game_type);
CREATE INDEX IF NOT EXISTS idx_game_scores_played ON game_scores(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_synced ON game_scores(synced);

CREATE OR REPLACE VIEW game_leaderboard AS
SELECT gs.id, gs.user_id, u.name AS user_name, gs.game_type, gs.score,
       gs.distance, gs.survival_time,
       ROW_NUMBER() OVER (PARTITION BY gs.game_type ORDER BY gs.score DESC) AS rank,
       gs.played_at
FROM game_scores gs
JOIN users u ON gs.user_id = u.id
WHERE gs.played_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY gs.game_type, gs.score DESC;