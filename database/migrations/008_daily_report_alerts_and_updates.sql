ALTER TABLE daily_reports
    ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS feed_used_bags NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_daily_reports_farm_flock_date
    ON daily_reports(farm_id, flock_id, report_date);