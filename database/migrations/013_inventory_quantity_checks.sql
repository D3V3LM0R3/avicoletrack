DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_food_quantity_check') THEN
        ALTER TABLE farms ADD CONSTRAINT farms_food_quantity_check CHECK (food_quantity >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_water_quantity_check') THEN
        ALTER TABLE farms ADD CONSTRAINT farms_water_quantity_check CHECK (water_quantity >= 0);
    END IF;
END $$;