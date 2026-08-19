-- Step 4A.3
-- Connect every farm to an enterprise

ALTER TABLE farms
ADD COLUMN enterprise_id BIGINT;

-- Backfill existing demo farms
UPDATE farms
SET enterprise_id = 1
WHERE id IN (1, 2);

-- Make the relationship mandatory
ALTER TABLE farms
ALTER COLUMN enterprise_id SET NOT NULL;

-- Protect referential integrity
ALTER TABLE farms
ADD CONSTRAINT farms_enterprise_fk
FOREIGN KEY (enterprise_id)
REFERENCES enterprises(id)
ON DELETE RESTRICT;

-- Speed up enterprise -> farms authorization queries
CREATE INDEX idx_farms_enterprise_id
ON farms(enterprise_id);