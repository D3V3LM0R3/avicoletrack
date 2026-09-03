-- Add tagged market-price tiers and immutable financial snapshots.
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS product_key VARCHAR(80);
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS price_low NUMERIC(12,2);
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS price_mid NUMERIC(12,2);
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS price_high NUMERIC(12,2);
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS note_low TEXT;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS note_mid TEXT;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS note_high TEXT;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS tags TEXT;
UPDATE market_prices SET product_key = lower(regexp_replace(product, '[^a-zA-Z0-9]+', '_', 'g')) WHERE product_key IS NULL;
UPDATE market_prices SET price_mid = price, price_low = price, price_high = price WHERE price_mid IS NULL;
ALTER TABLE market_prices ALTER COLUMN price_low SET DEFAULT 0;
ALTER TABLE market_prices ALTER COLUMN price_mid SET DEFAULT 0;
ALTER TABLE market_prices ALTER COLUMN price_high SET DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_market_prices_product_key_date ON market_prices(product_key, price_date DESC);

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS product_name VARCHAR(150);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS market_price_id BIGINT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_value NUMERIC(14,2);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS price_tier VARCHAR(10);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_market_price_fk') THEN
        ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_market_price_fk
            FOREIGN KEY (market_price_id) REFERENCES market_prices(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE events ADD COLUMN IF NOT EXISTS financial_type VARCHAR(10);
ALTER TABLE events ADD COLUMN IF NOT EXISTS financial_amount NUMERIC(14,2);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_financial_type_check') THEN
        ALTER TABLE events ADD CONSTRAINT events_financial_type_check
            CHECK (financial_type IS NULL OR financial_type IN ('cost', 'benefit'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_financial_amount_check') THEN
        ALTER TABLE events ADD CONSTRAINT events_financial_amount_check
            CHECK (financial_amount IS NULL OR financial_amount >= 0);
    END IF;
END $$;