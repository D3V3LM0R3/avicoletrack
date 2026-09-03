ALTER TABLE flocks ADD COLUMN IF NOT EXISTS name VARCHAR(150);

UPDATE flocks
SET name = 'Bande ' || id
WHERE name IS NULL;
