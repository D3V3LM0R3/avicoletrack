-- Persist the farm-level carton and alveole representation of egg stock.
ALTER TABLE farms ADD COLUMN IF NOT EXISTS cartons INTEGER NOT NULL DEFAULT 0;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS alveoli INTEGER NOT NULL DEFAULT 0;

UPDATE farms
SET cartons = GREATEST(egg_stock, 0) / 360,
    alveoli = (GREATEST(egg_stock, 0) % 360) / 30;

ALTER TABLE farms DROP CONSTRAINT IF EXISTS farms_cartons_check;
ALTER TABLE farms ADD CONSTRAINT farms_cartons_check CHECK (cartons >= 0);
ALTER TABLE farms DROP CONSTRAINT IF EXISTS farms_alveoli_check;
ALTER TABLE farms ADD CONSTRAINT farms_alveoli_check CHECK (alveoli >= 0 AND alveoli < 12);