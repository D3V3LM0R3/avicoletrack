# AvicoleTrack Test Suite

This directory contains the project-level automated tests for the AvicoleTrack stack.

## Current test coverage

The repository currently includes two layers of automated checks:

### 1. Backend contract and business-logic tests
Location: `tests/test_beta_contracts.py`

These tests validate:

- API route registration in the FastAPI app
- Core schema validation rules
- Daily report KPI calculation logic
- Event and market price model acceptance
- Migration safeguard expectations

Examples covered:

- `/auth/login`, `/auth/register`, `/farms`, `/daily-reports`, `/events`
- invalid `StockMovementCreate(quantity=0)` rejection
- correct `laying_percentage` and `ratio` calculation
- required fields in market-price and event schemas

### 2. Neon database integration tests
Location: `tests/test_neon_backend.py`

These tests exercise the app against the live Neon PostgreSQL configuration from the project environment.

Covered flows:

- owner registration
- login with JWT issuance
- farm creation by an owner
- listing farms after creation
- real database cleanup between tests

This ensures the backend works with the same database setup used in the development environment.

## Execution

From the repository root:

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
```

Optional direct run for the Neon suite:

```bash
python -m unittest tests.test_neon_backend -v
```

## Environment requirements

The backend reads database settings from the project `.env` file. Your environment must include a valid `DATABASE_URL` pointing to a running PostgreSQL/Neon database.

Example:

```env
DATABASE_URL="postgresql+psycopg://user:password@host/database?sslmode=require"
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:8081
```

## Test categories planned next

The file currently covers the baseline and Neon-backed validation. The following areas are the next logical expansion targets:

- Manager and worker permission enforcement
- Daily report create/update/upsert behavior
- Notification read and alert generation
- Farm membership access checks
- Frontend component and navigation tests
- End-to-end flows with Expo and backend together

## Project status

The repository now has a working automated test foundation for:

- backend contract validation
- backend business logic checks
- real API validation against Neon

This is the baseline needed before broader permission, integration, and frontend test expansion.