-- Step 4A.3
-- Connect every farm to an enterprise

ALTER TABLE farms
ADD COLUMN IF NOT EXISTS enterprise_id BIGINT;

-- Backfill existing demo farms
UPDATE farms
SET enterprise_id = 1
WHERE id IN (1, 2);

-- Make the relationship mandatory
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM farms WHERE enterprise_id IS NULL) THEN
		RAISE EXCEPTION 'Cannot assign farms to an enterprise: farms.enterprise_id is still NULL';
	END IF;
END $$;

ALTER TABLE farms
ALTER COLUMN enterprise_id SET NOT NULL;

-- Protect referential integrity
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'farms_enterprise_fk'
	) THEN
		ALTER TABLE farms
		ADD CONSTRAINT farms_enterprise_fk
		FOREIGN KEY (enterprise_id)
		REFERENCES enterprises(id)
		ON DELETE RESTRICT;
	END IF;
END $$;

-- Speed up enterprise -> farms authorization queries
CREATE INDEX IF NOT EXISTS idx_farms_enterprise_id
ON farms(enterprise_id);