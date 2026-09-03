# AvicoleTrack Database

This directory contains database-related resources.

## Planned Components

- Database schema
- Migrations
- Seed/demo data
- Database documentation

## Migration order

Apply the initial schema, then migrations `003` through `027` in numeric order.
Migration `013_inventory_quantity_checks.sql` adds non-negative checks for farm
food and water quantities. Migration `015_stock_movements.sql` adds the
stock movement log used for inventory history and balance tracking. All
migrations are safe to rerun on the current database; migration `005`
deliberately stops with a clear error if an existing farm cannot be assigned
to an enterprise.
Migration `017_pending_stock_movements.sql` adds pending/validated movement
state and farm-level subject counts. Owner-created movements remain pending
until an owner or manager validates them.
Migration `024_terminal_record_messages.sql` requires a non-empty message when
an event or movement is validated, confirmed, or canceled. Pending records are
excluded from reports and inventory summaries; terminal records remain for
history and audit purposes.
Migration `025_farm_egg_packaging.sql` stores each farm's egg stock as cartons
and alvéoles for compact display throughout the application.
Migration `026_capital_pricing_ledger.sql` adds tagged three-tier market prices,
movement price snapshots, and event costs/benefits for capital accounting.
Migration `027_repair_game_scores.sql` repairs older game-score tables by adding
the fields required by the game API and rebuilding its leaderboard view.

## Main Entities

- Users
- Farms
- Flocks
- Daily Reports
- Orders
- Deliveries
- Events
- Notifications
- Market Prices

The database design will be implemented and validated during the database stage.

The database layer is complete for beta operations: authentication, farm and
flock data, daily reporting, stock packaging, market-price tiers, capital
ledger snapshots, chat, and game scores are covered by the schema and
migrations.

## Validation

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c '\dt'
cd .. && python -m unittest discover -s tests -p 'test_*.py' -v
```

## Current Database

Database name:
avicoletrack_db

Main tables:

- users
- farms
- flocks
- daily_reports
- orders
- deliveries
- events
- notifications

Schema file:

database/schema/001_initial_schema.sql