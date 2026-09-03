-- Add status and confirmation_message to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE events ADD COLUMN IF NOT EXISTS confirmation_message TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS confirmed_by BIGINT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

-- Add confirmation_message to stock_movements table
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS confirmation_message TEXT;

-- Add initial_bird_count to flocks table to track original flock size
ALTER TABLE flocks ADD COLUMN IF NOT EXISTS initial_bird_count INTEGER NOT NULL DEFAULT 0;

-- Add race presets table for flock breed selection
CREATE TABLE IF NOT EXISTS flock_race_presets (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert common chicken races
INSERT INTO flock_race_presets (name, description, category) VALUES
('Poule pondeuse', 'Poule productrice d''oeufs', 'Pondeuse'),
('Poule de chair', 'Poule pour la production de viande', 'Chair'),
('Poule fermière', 'Poule de ferme traditionnelle', 'Fermière'),
('Poule Rousse', 'Poule rousse productrice d''oeufs bruns', 'Pondeuse'),
('Poule Sussex', 'Poule de chair avec bon potentiel de ponte', 'Mixte'),
('Poule Wyandotte', 'Poule de chair avec bonne ponte', 'Mixte'),
('Poule Brahma', 'Grande poule, chair et oeufs', 'Mixte'),
('Poule Cochin', 'Poule couveuse, petit œuf', 'Couveuse'),
('Poule Bantam', 'Petite poule naine', 'Naine'),
('Canard', 'Canard de basse-cour', 'Canard'),
('Oie', 'Oie de ferme', 'Oie'),
('Dinde', 'Dinde de ferme', 'Volaille')
ON CONFLICT (name) DO NOTHING;

-- Add constraint for event status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_status_check') THEN
        ALTER TABLE events ADD CONSTRAINT events_status_check
            CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_confirmed_by_fk') THEN
        ALTER TABLE events ADD CONSTRAINT events_confirmed_by_fk
            FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indices
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_confirmed_at ON events(confirmed_at);
CREATE INDEX IF NOT EXISTS idx_flock_race_presets ON flock_race_presets(category);
