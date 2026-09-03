Market prices
-------------

Market prices are stored in `market_prices`. Set `MARKET_PRICE_URL` to an HTTPS
endpoint returning a JSON list of objects with `product`, `region`, `price`,
`unit`, `source`, and `price_date`, then an owner or manager can call
`POST /market-prices/refresh` to import them. No fabricated prices are used by
the application.
# AvicoleTrack Backend

Completed beta API for authentication, permissions, farms, flocks, daily
reports, stock, events, market prices, capital analytics, chat, and games.

Backend API for the AvicoleTrack poultry farm management platform.

## Technology

- Python
- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL
- Psycopg
- Pydantic

## Development Server

From the backend directory:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

### API Documentation

When the server is running:
http://127.0.0.1:8000/docs

Current API Areas

· Health
· Farms
· Flocks
· Daily Reports
· Database

The backend connects to the local PostgreSQL database:
avicoletrack_db

For Neon, set `DATABASE_URL` to the Neon PostgreSQL connection string.

## Validation

```bash
python -m compileall -q app
python -c "from app.main import app; print(len(app.openapi()['paths']))"
cd .. && python -m unittest discover -s tests -p 'test_*.py' -v
```