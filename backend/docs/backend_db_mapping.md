# Backend functionality and database mapping

This document describes the backend functionality (API endpoints, core flows, and permissions) and how they map to the PostgreSQL database tables and relationships.

## Overview

- Framework: FastAPI
- ORM: SQLAlchemy (Declarative mappings)
- DB connection: `app.core.config.settings.database_url` (configured via `.env`) and created in `app.db.session` using `create_engine` and `SessionLocal`.
- Migrations / SQL: `database/migrations/` and `database/schema/` contain raw SQL migration files.

## Database session and configuration

- `app/core/config.py` reads configuration (including `database_url`) from environment (BaseSettings).
- `app/db/session.py` creates the SQLAlchemy engine with `settings.database_url` and exposes `get_db()` dependency which yields `SessionLocal()`.

Paths:
- `app/core/config.py` ([app/core/config.py](app/core/config.py))
- `app/db/session.py` ([app/db/session.py](app/db/session.py))

## Models (tables)

All models are SQLAlchemy declarative models. Table names and key columns:

- `users` (`app.models.user.User`)
  - id (PK), name, email (unique, indexed), password_hash, role, is_active, created_at, updated_at

- `enterprises` (`app.models.enterprise.Enterprise`)
  - id (PK), name, owner_id (FK -> users.id, indexed), created_at, updated_at, is_active

- `farms` (`app.models.farm.Farm`)
  - id (PK), enterprise_id (FK -> enterprises.id, indexed), name, location, active, food_type, food_quantity, food_unit, water_quantity, water_unit, created_at

- `farm_memberships` (`app.models.farm_membership.FarmMembership`)
  - id (PK), user_id (FK -> users.id, ondelete=CASCADE), farm_id (FK -> farms.id, ondelete=CASCADE), role, created_at, updated_at, is_active
  - unique constraint: (`user_id`, `farm_id`) enforced by `unique_user_farm`

- `flocks` (`app.models.flock.Flock`)
  - id (PK), farm_id (FK -> farms.id, ondelete=CASCADE), bird_count, breed, start_date, archived, archived_at, updated_at

- `daily_reports` (`app.models.daily_report.DailyReport`)
  - id (PK), farm_id (FK -> farms.id, ondelete=CASCADE), flock_id (FK -> flocks.id, ondelete=RESTRICT), report_date, bird_count, mortality, eggs_produced, laying_percentage, ratio, hen_age, egg_stock, cartons, alveoli, remaining_eggs, notes, feed_used_bags, water_used_liters, created_by, created_at, updated_at

- `invitations` (`app.models.invitation.Invitation`)
  - id (PK), enterprise_id (FK -> enterprises.id, ondelete=CASCADE, indexed), farm_id (FK -> farms.id, ondelete=CASCADE, indexed), invited_email (indexed), role, token_hash (unique), expires_at (indexed), used_at, created_by (FK -> users.id), is_active, created_at

Files:
- Models live in `app/models/` (see individual files: [app/models](app/models)).

## API routes and how they interact with the DB

All API routes are under `app/api/routes/` and use `get_db()` and SQLAlchemy `Session` to query/update tables. Authentication uses JWT tokens created in `app.core.security` and `get_current_user` dependency to resolve the user from the token.

Paths:
- `app/api/routes/auth.py` ([app/api/routes/auth.py](app/api/routes/auth.py))
  - POST `/auth/register` (RegisterRequest -> `users`, `enterprises` or `farm_memberships`, uses `invitations` when token provided)
    - Public flows:
      - Owner registration: creates a `users` row (role OWNER) and an `enterprises` row (owner_id -> new user).
      - Invitation registration: verifies `invitation_token` by hashing and looking up `invitations.token_hash`, checks invitation validity and expiry, validates invited farm (joins `farms`), then creates `users` and `farm_memberships`, marks `invitation.used_at` and deactivates invitation.
  - POST `/auth/login` (OAuth2 form) -> verifies `users` by `email`, checks `password_hash`, then issues JWT access token (no DB write). Returns `user` data from `users` table.
  - GET `/auth/me` -> returns current user resolved via `get_current_user` dependency (reads `users`).

- `app/api/routes/personnel.py` ([app/api/routes/personnel.py](app/api/routes/personnel.py))
  - POST `/personnel/invitations` (InvitationCreate) -> creates `invitations` after validating enterprise ownership and farm membership; deactivates previous invitations for same email+farm; generates `token_hash`, sets `expires_at`, `created_by`, `is_active`.
  - GET `/personnel/farms/{farm_id}` -> lists invitations for a farm (reads `invitations`).
  - GET `/personnel/farms/{farm_id}/members` -> lists members by joining `users` and `farm_memberships` (reads `users`, `farm_memberships`).
  - PATCH `/personnel/memberships/{membership_id}/deactivate` -> sets `farm_memberships.is_active = False` (writes `farm_memberships`).
  - PATCH `/personnel/memberships/{membership_id}/activate` -> sets `farm_memberships.is_active = True`.
  - DELETE `/personnel/invitations/{invitation_id}` -> sets `invitations.is_active = False` (owner-only).
  - DELETE `/personnel/farms/{farm_id}/invitations` -> deactivates active invitations for a farm.
  - PATCH `/personnel/invitations/{invitation_id}/reactivate` -> reactivates an invitation if not used and not expired.

- `app/api/routes/farms.py` ([app/api/routes/farms.py](app/api/routes/farms.py))
  - POST `/farms` (FarmCreate) -> creates a `farms` row linked to an `enterprises` row owned by the current user (OWNER flow).
  - GET `/farms` -> For OWNER returns farms joined to `enterprises` where owner_id == current_user.id; For MANAGER/WORKER returns farms joined via `farm_memberships` where membership is active.
  - GET `/farms/{farm_id}` -> reads `farms` (requires `require_farm_access` permission check which looks at `enterprises`/`farm_memberships`).
  - PATCH `/farms/{farm_id}` -> updates `farms` fields (`name`, `location`, `active`) (OWNER-only after ownership checks), writes to `farms`.
  - DELETE `/farms/{farm_id}` -> logical delete: sets `farms.active = False`.

- `app/api/routes/flocks.py` ([app/api/routes/flocks.py](app/api/routes/flocks.py))
  - POST `/flocks` (FlockCreate) -> creates `flocks` row for a verified `farm_id` after `require_flock_create_access` checks (OWNER or authorized MANAGER).
  - GET `/flocks` -> lists flocks accessible to the user: OWNER -> flocks for farms owned by their enterprises; MANAGER/WORKER -> flocks via `farm_memberships` active.
  - GET `/flocks/{flock_id}` -> reads `flocks` (permission check `require_flock_access`).

- `app/api/routes/daily_reports.py` ([app/api/routes/daily_reports.py](app/api/routes/daily_reports.py))
  - POST `/daily-reports` (DailyReportCreate) -> validates `farm` and optionally `flock`, computes `laying_percentage` and `ratio`, then inserts a `daily_reports` row with computed fields.
  - GET `/daily-reports` -> lists `daily_reports` ordered by `report_date` desc.
  - GET `/daily-reports/{report_id}` -> reads a single `daily_reports` row.

- `app/api/routes/health.py` ([app/api/routes/health.py](app/api/routes/health.py))
  - GET `/health` -> simple health-check, no DB interaction.

## Security, permissions and helpers

- Authentication: `app.core.security` handles password hashing (`hash_password`, `verify_password`) and JWT creation (`create_access_token`). Tokens embed `subject` (user.id) and `role`.
- `app.core.dependencies.get_current_user` is used in many routes to fetch the `users` row corresponding to the token subject and enforce authentication.
- Permissions implemented in `app.core.permissions` and helpers in `app.core.invitations` enforce:
  - enterprise ownership (owner-only actions)
  - farm-level access via `farm_memberships` (MANAGER/WORKER)
  - flock creation and access checks that resolve Flock -> Farm -> Enterprise or Membership.

Files:
- `app/core/security.py` ([app/core/security.py](app/core/security.py))
- `app/core/dependencies.py` ([app/core/dependencies.py](app/core/dependencies.py))
- `app/core/permissions.py` ([app/core/permissions.py](app/core/permissions.py))
- `app/core/invitations.py` ([app/core/invitations.py](app/core/invitations.py))

## Migrations and raw SQL

- The repository contains raw SQL migration files in `database/migrations/` (e.g. `003_auth_and_roles.sql`, `004_enterprises.sql`, etc.) and an initial schema in `database/schema/001_initial_schema.sql`. These show the expected PostgreSQL table structures and indexes used in production.

## How to generate a PDF (optional)

If you want this Markdown converted to PDF, you can use a simple script or a toolchain such as `pandoc` or Python libraries (ReportLab, WeasyPrint). Example (Pandoc):

```bash
pip install pandoc -y   # or install system pandoc
pandoc docs/backend_db_mapping.md -o docs/backend_db_mapping.pdf
```

Or use Python to render with `markdown` + `weasyprint`.

## Notes and next steps

- This file documents the current backend code and the DB mappings as implemented in the `app/models` and `app/api/routes` sources.
- If you want, I can also generate a PDF copy of this file and add a script to `scripts/` to automate the conversion.

---
Generated from the source files in `app/` on inspection of the repository.
