ALTER TABLE farms ADD COLUMN IF NOT EXISTS subject_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'validated';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS validated_by BIGINT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_validated_by_fk') THEN
        ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_validated_by_fk
            FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_status_check') THEN
        ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_status_check
            CHECK (status IN ('pending', 'validated', 'rejected'));
    END IF;
END $$;