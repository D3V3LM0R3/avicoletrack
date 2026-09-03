-- Ensure existing deployments expose report creation time for edit-window checks.
ALTER TABLE daily_reports
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_daily_reports_created_at
    ON daily_reports(created_at);
