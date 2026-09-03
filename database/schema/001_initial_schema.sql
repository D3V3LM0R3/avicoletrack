CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_role_check CHECK (role IN (
        'OWNER',
        'MANAGER',
        'WORKER'
    ))
);

CREATE TABLE farms (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    egg_stock INTEGER NOT NULL DEFAULT 0,
    cartons INTEGER NOT NULL DEFAULT 0,
    alveoli INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flocks (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL,
    bird_count INTEGER NOT NULL,
    breed VARCHAR(100),
    start_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT flocks_farm_fk FOREIGN KEY (farm_id)
        REFERENCES farms(id) ON DELETE CASCADE,
    CONSTRAINT flocks_bird_count_check CHECK (bird_count >= 0)
);

CREATE TABLE daily_reports (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL,
    flock_id BIGINT,
    report_date DATE NOT NULL,
    bird_count INTEGER NOT NULL,
    mortality INTEGER NOT NULL DEFAULT 0,
    eggs_produced INTEGER NOT NULL DEFAULT 0,
    laying_percentage NUMERIC(6,2),
    ratio NUMERIC(10,4),
    hen_age INTEGER,
    egg_stock INTEGER NOT NULL DEFAULT 0,
    cartons INTEGER NOT NULL DEFAULT 0,
    alveoli INTEGER NOT NULL DEFAULT 0,
    remaining_eggs INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by BIGINT,
    feed_used_bags NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT daily_reports_farm_fk FOREIGN KEY (farm_id)
        REFERENCES farms(id) ON DELETE CASCADE,
    CONSTRAINT daily_reports_flock_fk FOREIGN KEY (flock_id)
        REFERENCES flocks(id) ON DELETE RESTRICT,
    CONSTRAINT daily_reports_user_fk FOREIGN KEY (created_by)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT daily_reports_bird_count_check CHECK (bird_count >= 0),
    CONSTRAINT daily_reports_mortality_check CHECK (mortality >= 0),
    CONSTRAINT daily_reports_eggs_check CHECK (eggs_produced >= 0),
    CONSTRAINT daily_reports_stock_check CHECK (egg_stock >= 0),
    CONSTRAINT daily_reports_cartons_check CHECK (cartons >= 0),
    CONSTRAINT daily_reports_alveoli_check CHECK (alveoli >= 0),
    CONSTRAINT daily_reports_remaining_check CHECK (remaining_eggs >= 0)
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product VARCHAR(150) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    total_amount NUMERIC(14,2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT orders_quantity_check CHECK (quantity >= 0),
    CONSTRAINT orders_unit_price_check CHECK (unit_price >= 0),
    CONSTRAINT orders_total_check CHECK (total_amount >= 0),
    CONSTRAINT orders_status_check CHECK (status IN (
        'pending',
        'confirmed',
        'partially_delivered',
        'delivered',
        'cancelled'
    ))
);

CREATE TABLE deliveries (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity INTEGER NOT NULL,
    destination VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT deliveries_order_fk FOREIGN KEY (order_id)
        REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT deliveries_quantity_check CHECK (quantity >= 0),
    CONSTRAINT deliveries_status_check CHECK (status IN (
        'pending',
        'in_transit',
        'delivered',
        'cancelled'
    ))
);

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    event_date TIMESTAMP NOT NULL,
    description TEXT,
    reminder_date TIMESTAMP,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT events_farm_fk FOREIGN KEY (farm_id)
        REFERENCES farms(id) ON DELETE CASCADE,
    CONSTRAINT events_user_fk FOREIGN KEY (created_by)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT events_type_check CHECK (type IN (
        'vaccination',
        'treatment',
        'reform',
        'breeding',
        'inspection',
        'other'
    ))
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    event_id BIGINT,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    scheduled_at TIMESTAMP,
    read_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT notifications_user_fk FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT notifications_event_fk FOREIGN KEY (event_id)
        REFERENCES events(id) ON DELETE SET NULL
);

CREATE TABLE market_prices (
    id BIGSERIAL PRIMARY KEY,
    product VARCHAR(150) NOT NULL,
    region VARCHAR(100) NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price > 0),
    unit VARCHAR(50) NOT NULL,
    source VARCHAR(255) NOT NULL,
    price_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_daily_reports_farm_date ON daily_reports(farm_id, report_date);
CREATE INDEX idx_daily_reports_created_by ON daily_reports(created_by);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);
CREATE INDEX idx_events_farm_date ON events(farm_id, event_date);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_at);
CREATE INDEX idx_market_prices_region_date ON market_prices(region, price_date DESC);