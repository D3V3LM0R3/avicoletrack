-- ============================================================
-- AvicoleTrack
-- Migration 003
-- Authentication and farm-scoped roles
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend users
-- ------------------------------------------------------------

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- ------------------------------------------------------------
-- 2. Normalize role values
-- ------------------------------------------------------------

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(30);

UPDATE users
SET role = 'OWNER'
WHERE role IS NULL;


-- ------------------------------------------------------------
-- 3. Farm memberships
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS farm_memberships (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    farm_id INTEGER NOT NULL
        REFERENCES farms(id)
        ON DELETE CASCADE,

    role VARCHAR(30) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_farm
        UNIQUE(user_id, farm_id),

    CONSTRAINT valid_membership_role
        CHECK(role IN ('OWNER', 'MANAGER', 'WORKER'))
);


-- ------------------------------------------------------------
-- 4. Helpful indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_farm_memberships_user_id
ON farm_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_farm_memberships_farm_id
ON farm_memberships(farm_id);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);