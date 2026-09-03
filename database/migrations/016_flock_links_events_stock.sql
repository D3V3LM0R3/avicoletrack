ALTER TABLE events ADD COLUMN IF NOT EXISTS flock_id BIGINT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS flock_id BIGINT;

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_stock_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_stock_type_check CHECK (
    stock_type IN ('Aliments', 'Œufs', 'Cartons', 'Alvéoles', 'Sujets', 'aliments', 'oeufs', 'cartons', 'alveoles', 'sujets')
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_flock_fk') THEN
        ALTER TABLE events ADD CONSTRAINT events_flock_fk FOREIGN KEY (flock_id) REFERENCES flocks(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_flock_fk') THEN
        ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_flock_fk FOREIGN KEY (flock_id) REFERENCES flocks(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_flock ON events(flock_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_flock ON stock_movements(flock_id);