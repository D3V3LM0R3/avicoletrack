CREATE TABLE IF NOT EXISTS invitations (
    id BIGSERIAL PRIMARY KEY,

    enterprise_id BIGINT NOT NULL,
    farm_id BIGINT NOT NULL,

    invited_email VARCHAR(255) NOT NULL,

    role VARCHAR(30) NOT NULL,

    token_hash VARCHAR(128) NOT NULL UNIQUE,

    expires_at TIMESTAMP NOT NULL,

    used_at TIMESTAMP NULL,

    created_by BIGINT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT invitations_enterprise_fk
        FOREIGN KEY (enterprise_id)
        REFERENCES enterprises(id)
        ON DELETE CASCADE,

    CONSTRAINT invitations_farm_fk
        FOREIGN KEY (farm_id)
        REFERENCES farms(id)
        ON DELETE CASCADE,

    CONSTRAINT invitations_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT invitations_role_check
        CHECK (role IN ('MANAGER', 'WORKER')),

    CONSTRAINT invitations_email_check
        CHECK (length(trim(invited_email)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_invitations_farm_id
    ON invitations(farm_id);

CREATE INDEX IF NOT EXISTS idx_invitations_enterprise_id
    ON invitations(enterprise_id);

CREATE INDEX IF NOT EXISTS idx_invitations_invited_email
    ON invitations(invited_email);

CREATE INDEX IF NOT EXISTS idx_invitations_expires_at
    ON invitations(expires_at);