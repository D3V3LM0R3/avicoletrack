CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,

    farm_id BIGINT NOT NULL,
    stock_type VARCHAR(50) NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    note TEXT,
    movement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT stock_movements_farm_fk
        FOREIGN KEY (farm_id)
        REFERENCES farms(id)
        ON DELETE CASCADE,

    CONSTRAINT stock_movements_user_fk
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT stock_movements_quantity_check
        CHECK (quantity > 0),

    CONSTRAINT stock_movements_stock_type_check
        CHECK (
            stock_type IN (
                'Aliments',
                'Œufs',
                'Cartons',
                'Alvéoles',
                'aliments',
                'oeufs',
                'cartons',
                'alveoles'
            )
        ),

    CONSTRAINT stock_movements_movement_type_check
        CHECK (movement_type IN ('Entrée', 'Sortie'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_farm_date
    ON stock_movements(farm_id, movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by
    ON stock_movements(created_by);

CREATE INDEX IF NOT EXISTS idx_stock_movements_type_date
    ON stock_movements(stock_type, movement_date DESC);
