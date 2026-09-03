ALTER TABLE farm_memberships
ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"create_flock": false, "create_event": false, "send_notification": false}'::jsonb;