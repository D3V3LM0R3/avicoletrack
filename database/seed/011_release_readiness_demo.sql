-- Optional local QA data for release-readiness fields.
-- Run after migrations 001-011 against a development database only.
DO $$
DECLARE
    demo_farm_id BIGINT;
BEGIN
    SELECT id INTO demo_farm_id FROM farms ORDER BY id LIMIT 1;
    IF demo_farm_id IS NULL THEN
        RAISE NOTICE 'No farm found; create an owner and farm before loading demo data.';
        RETURN;
    END IF;

    UPDATE farms
    SET food_type = 'Aliment pondeuses',
        food_quantity = 125.50,
        food_unit = 'kg',
        water_quantity = 850,
        water_unit = 'L'
    WHERE id = demo_farm_id;

    INSERT INTO flocks (farm_id, bird_count, breed, start_date, archived, updated_at)
    SELECT demo_farm_id, 1200, 'Pondeuses Isa Brown', CURRENT_DATE - 90, FALSE, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (
        SELECT 1 FROM flocks WHERE farm_id = demo_farm_id AND breed = 'Pondeuses Isa Brown'
    );
END $$;
