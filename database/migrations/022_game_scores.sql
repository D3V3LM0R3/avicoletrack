-- 022_game_scores.sql
-- Create game scores table
CREATE TABLE IF NOT EXISTS game_scores (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    distance INTEGER NOT NULL DEFAULT 0,
    survival_time INTEGER NOT NULL DEFAULT 0,
    difficulty_level INTEGER NOT NULL DEFAULT 1,
    synced BOOLEAN NOT NULL DEFAULT FALSE,
    played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT game_scores_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_scores_user
    ON game_scores(user_id);

CREATE INDEX IF NOT EXISTS idx_game_scores_game_type
    ON game_scores(game_type);

CREATE INDEX IF NOT EXISTS idx_game_scores_played
    ON game_scores(played_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_scores_synced
    ON game_scores(synced);

-- Create leaderboard view (top 100 scores)
CREATE OR REPLACE VIEW game_leaderboard AS
SELECT 
    gs.id,
    gs.user_id,
    u.name as user_name,
    gs.game_type,
    gs.score,
    gs.distance,
    gs.survival_time,
    gs.played_at,
    ROW_NUMBER() OVER (PARTITION BY gs.game_type ORDER BY gs.score DESC) as rank
FROM game_scores gs
JOIN users u ON gs.user_id = u.id
WHERE gs.played_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY gs.game_type, gs.score DESC;
