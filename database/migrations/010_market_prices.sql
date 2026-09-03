CREATE TABLE IF NOT EXISTS market_prices (
    id BIGSERIAL PRIMARY KEY,
    product VARCHAR(150) NOT NULL,
    region VARCHAR(100) NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price > 0),
    unit VARCHAR(50) NOT NULL,
    source VARCHAR(255) NOT NULL,
    price_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_prices_region_date ON market_prices(region, price_date DESC);