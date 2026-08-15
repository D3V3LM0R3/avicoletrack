# AvicoleTrack Backend

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