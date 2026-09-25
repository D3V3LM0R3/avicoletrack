
# AvicoleTrack

AvicoleTrack is a poultry enterprise management platform for farms, flock operations, daily reporting, analytics, communications, and owner-level decision support.

## Current status

Status: Beta

The project has evolved from a prototype into a working beta application for poultry farm operations. The core product is usable for owners, managers, and workers, with real workflow support for authentication, enterprise/farm management, daily reporting, KPI tracking, alerts, market-pricing, chat, and a light game layer.

This is not yet a production-ready release for public operations, but it is no longer a simple mock or demo. The app already includes the main business flows needed for modern poultry management.

## What the app does

- User registration, login, and JWT-based authentication
- Role-based access for owner, manager, and worker users
- Enterprise and multi-farm organization
- Farm memberships, invitations, activation, and permissions
- Flock management and flock lifecycle updates
- Daily reports with KPI calculations
- Alerts and notifications based on operational thresholds
- Event management and reminder workflows
- Market price tracking and refresh support
- Farm comparison and owner analytics dashboard
- Chat between enterprise members and farm teams
- Game experience with offline score synchronization and leaderboard support
- Stock movement tracking and operational validation
- PDF/XLSX-style export workflows from the client app

## Core user roles

- Owner / Directeur
- Manager / Chef d'entreprise
- Worker / Aviculteur

## Architecture

### Frontend
- Expo / React Native / Expo Router
- React 19 + TypeScript
- Role-aware mobile web UI
- Shared authenticated navigation and farm-specific workflows

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL / Neon-ready
- JWT authentication and permission checks
- REST API for farms, flocks, reports, analytics, alerts, events, and stock data

### Database
- SQL schema and incremental migration files under `database/`
- Backend migrations under `backend/migrations/`
- PostgreSQL-oriented persistence with Neon compatible configuration

## Project structure

```text
.
├── backend/             # FastAPI API and business logic
├── frontend/            # Expo app for web/mobile clients
├── database/            # Schema and migration SQL files
├── docs/                # Product status, deployment, and update notes
├── tests/               # Automated tests and validation scripts
├── README.md            # Project overview
├── docker-compose.yml   # Local/container orchestration
├── Procfile             # Process definitions
└── .github/             # Deployment and automation configuration
```

## Product maturity

### Already implemented

- Authentication, JWT sessions, and password security
- Enterprise ownership and multi-farm structure
- Farm-scoped memberships and owner-only administration
- Invitation-based onboarding for managers and workers
- Daily report entry and same-day upsert behavior
- KPI calculations such as laying percentage, ratio, and live hen metrics
- Notification generation for low stock, abnormal production, and mortality risk
- Analytics for farm comparison and capital/performance visibility
- Events and reminders tied to farm activity
- Market price import and refresh workflows
- Chat and message support across farms and enterprises
- Game scoring with offline sync and leaderboard concepts

### Remaining beta-level work

The application is not yet a full production release. The current documentation and status reports still identify the most important next steps as:

- owner financial dashboard refinement and deeper enterprise analytics
- stronger communication and notification polish
- finalization of business rules, permissions, and auditing
- migration/CI hardening and production validation
- completing or clearly disabling any simulation-based flows

In short, the app already has the operational backbone; the next stage is improving business intelligence, governance, and production-readiness.

## Deployment and environment

The project is designed for a web/mobile front end and a hosted backend with PostgreSQL storage. The current deployment docs reference a live FastAPI backend and a web frontend deployed through GitHub Pages/Vercel, with Neon as the database provider.

Recommended environment variables include:

```env
DATABASE_URL=postgresql+psycopg://user:password@host/database
JWT_SECRET=replace-with-a-secret
FRONTEND_URL=http://localhost:8081
MARKET_PRICE_URL=https://approved-source.example/prices.json
```

For production email configuration, the project supports SMTP and Resend options, but credentials must stay in environment variables and never be committed.

## Documentation

The project status is tracked in the docs folder:

- [docs/BETA_APP_STATUS.md](docs/BETA_APP_STATUS.md)
- [docs/DEPLOYMENT_STATUS.md](docs/DEPLOYMENT_STATUS.md)
- [docs/PROJECT_STATUS_AND_TEST_PLAN.md](docs/PROJECT_STATUS_AND_TEST_PLAN.md)
- [docs/UPDATE_REPORT.md](docs/UPDATE_REPORT.md)

## Local development

### Backend

```bash
cd backend
python -m compileall -q app
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npx expo start
```

### Validation

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
cd backend && python -m compileall -q app
cd frontend && npx tsc --noEmit && npm run lint
```

## Summary

AvicoleTrack is now a functional beta platform for poultry enterprise management, with the main operational stack and product features in place. The project is moving toward a stronger owner decision-support layer, operational coordination, and production-grade stability rather than simple CRUD workflows.

The app is best described as a real beta product with strong product traction and a clear path to refinement, rather than a prototype or early demo.