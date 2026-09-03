-- Require explicit decisions and messages for terminal movement/event records.
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_status_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_status_check
    CHECK (status IN ('pending', 'validated', 'rejected', 'cancelled'));

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_terminal_message_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_terminal_message_check
    CHECK (status NOT IN ('validated', 'cancelled') OR NULLIF(BTRIM(confirmation_message), '') IS NOT NULL);

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_terminal_message_check;
ALTER TABLE events ADD CONSTRAINT events_terminal_message_check
    CHECK (status NOT IN ('confirmed', 'cancelled') OR NULLIF(BTRIM(confirmation_message), '') IS NOT NULL);