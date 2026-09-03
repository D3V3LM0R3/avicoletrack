-- Daily reports must belong to an authorized farm flock.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM daily_reports WHERE flock_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot enforce daily_reports.flock_id: existing reports are not linked to a flock';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM daily_reports report
        JOIN flocks flock ON flock.id = report.flock_id
        WHERE report.farm_id <> flock.farm_id
    ) THEN
        RAISE EXCEPTION 'Cannot enforce daily_reports flock/farm relationship: mismatched rows exist';
    END IF;
END $$;

ALTER TABLE daily_reports
    ALTER COLUMN flock_id SET NOT NULL;

ALTER TABLE daily_reports
    DROP CONSTRAINT IF EXISTS daily_reports_flock_fk;

ALTER TABLE daily_reports
    ADD CONSTRAINT daily_reports_flock_fk
    FOREIGN KEY (flock_id) REFERENCES flocks(id) ON DELETE RESTRICT;