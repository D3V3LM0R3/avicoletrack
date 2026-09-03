# AvicoleTrack Current State and Test Plan

Date: 27 August 2026

## 1. Current State

AvicoleTrack is an Expo/React Native frontend with a FastAPI, SQLAlchemy, PostgreSQL-oriented backend. The project is now in beta development, with a working core product but several major product features still to be built and refined before it can be considered a mature release.

The main working vertical slice is:

1. Authentication and JWT sessions
2. Owner, manager, and worker roles
3. Enterprise farms and farm memberships
4. Flocks
5. Daily reports
6. Partial daily-report updates
7. Automatic KPI calculations
8. Rule-based alerts and notifications
9. Owner dashboard and farm comparison
10. Events and reminders for one or more farms
11. Owner invitations with selectable farm and role
12. Stored market prices with optional HTTPS JSON refresh

## 2. Implemented Backend

Important API areas currently registered in `backend/app/main.py`:

- `POST/GET /auth/...` and `PATCH /auth/me`
- `GET/POST/PATCH /farms/...`
- `GET/POST /flocks/...`
- `POST/GET/PATCH /daily-reports/...`
- `GET/PATCH /notifications/...`
- `POST/GET /events`
- `GET /analytics/dashboard`
- `GET /analytics/farm-comparison`
- `GET/POST /market-prices`
- `POST /market-prices/refresh`
- Personnel invitation and membership endpoints under `/personnel/...`

Daily reports support an upsert by `farm_id`, `flock_id`, and `report_date`. Re-submitting a report for the same flock and date updates the existing record rather than creating a duplicate.

Daily-report calculations are performed on the backend:

- Live hens = bird count - mortality
- Laying percentage = eggs produced / live hens * 100
- Ratio = eggs produced / live hens

Rules currently create notifications for:

- Egg stock at or below 100 eggs
- Mortality rate above 5 percent
- Laying percentage below 30 percent or above 100 percent

These thresholds are prototype defaults and should become configurable business settings later.

## 3. Implemented Frontend

The shared authenticated tab shell is role-aware:

- Owner: dashboard, reports, alerts, and owner management options
- Manager: operational dashboard content, reports, alerts, events, analytics, and permitted management options
- Worker: simplified daily update workflow, notifications, and report history

Owner-specific behavior includes:

- Per-farm dashboard summaries from the backend
- Reports showing farm, date, author, eggs, bird count, and stock
- Creating an event from a report
- Sending a notification to a farm
- Selecting a farm and role when inviting a user
- Farm activation/deactivation
- Profile name updates through the backend
- Owner-only Saisie tab removal

The market-price screen no longer uses predefined prices. It reads stored prices from the backend and can refresh from a configured HTTPS JSON source.

## 4. Database State

The fresh schema is in:

- `database/schema/001_initial_schema.sql`

Incremental changes are in:

- `database/migrations/007_daily_reports_flock_security.sql`
- `database/migrations/008_daily_report_alerts_and_updates.sql`
- `database/migrations/009_events.sql`
- `database/migrations/010_market_prices.sql`

The migrations are SQL files, not an automated migration runner. Apply them in order to an existing database. For a new database, use the schema and verify that the migration changes are represented before starting the API.

Required environment values include:

```env
DATABASE_URL=postgresql+psycopg://user:password@host/database
JWT_SECRET=replace-with-a-secret
FRONTEND_URL=http://localhost:8081
MARKET_PRICE_URL=https://approved-source.example/prices.json
```

`MARKET_PRICE_URL` is optional. If it is set, it must be HTTPS and return a JSON list with these fields:

```json
{
  "product": "Alveole 30 oeufs",
  "region": "Douala",
  "price": 2500,
  "unit": "FCFA",
  "source": "Approved source",
  "price_date": "2026-08-27"
}
```

## 5. Best Updates Before Production

### Priority 1: Complete integration safety

- Add a real migration tool such as Alembic and remove manual migration ambiguity.
- Add database constraints and indexes for same-day report uniqueness.
- Add transaction rollback handling around report, event, and notification writes.
- Add automated API tests with an isolated test database.
- Add seed/demo data through a repeatable script.
- Add CI checks for backend, frontend, migrations, and security configuration.

### Priority 2: Remove remaining simulated features

The following screens still contain simulation or incomplete backend behavior:

- Forgot-password flow: needs reset-token storage, expiry, and email delivery.
- Flock detail editing: needs `PATCH /flocks/{id}` and live detail/report loading.
- Stock movement: needs stock movement model, API, current-balance calculation, and low-stock rules.
- Synchronization: needs a real queue upload endpoint and conflict resolution based on server records.
- Report export: needs backend generation or a documented client export implementation.
- Market-price online refresh: needs a real approved data provider and scheduled refresh policy; the current endpoint is ready but provider-specific.

Do not describe these features as production-ready until their backend behavior exists.

### Priority 3: Business-rule validation

Confirm with the business owner:

- Eggs per alveole and carton packaging quantities
- Whether dashboard eggs means latest daily production or a cumulative period total
- Mortality denominator and whether mortality is daily or cumulative
- Low-stock thresholds per product and farm
- Directeur/Responsable permissions
- Revenue, costs, and profitability formulas
- Event reminder scheduling and delivery channels

### Priority 4: Authorization hardening

- Enforce owner-only access for owner administration endpoints consistently.
- Add explicit manager versus worker operation policies in one backend policy module.
- Avoid broad exception handling in permission filtering; catch `HTTPException` specifically.
- Add audit logs for report edits, invitations, membership changes, and notifications.
- Never rely on frontend hiding for authorization.

## 6. Verification Commands

Run from the repository root unless stated otherwise.

### Backend syntax and route checks

```bash
cd backend
python -m compileall -q app
python -c "from app.main import app; print(sorted(app.openapi()['paths']))"
```

Expected result: the API imports without an exception and includes daily reports, analytics, events, notifications, market prices, farms, and auth paths.

### Backend calculation smoke check

```bash
cd backend
python -c "from app.models.daily_report import DailyReport; from app.services.daily_reports import calculate_kpis; r=DailyReport(bird_count=100, mortality=5, eggs_produced=80); calculate_kpis(r); assert abs(r.laying_percentage-(80/95*100)) < 1e-9; assert abs(r.ratio-(80/95)) < 1e-9; print('KPI check passed')"
```

### Backend test suite

The repository currently has no installed `pytest` command. Install test dependencies and add tests before relying on this command:

```bash
cd backend
python -m pip install pytest httpx
python -m pytest -q
```

Required API tests should cover:

- Owner, manager, and worker login
- Farm access isolation
- Worker can create and edit only their own reports
- Manager and owner report visibility
- Same-day report upsert
- Single-field partial update without overwriting other fields
- KPI recalculation after eggs update
- Invalid mortality rejection
- Low-stock and abnormal-production notifications
- Notification read state
- Multi-farm event creation
- Invitation farm/role validation
- Owner-only administration actions

### Frontend type and lint checks

```bash
cd frontend
npx tsc --noEmit
npx eslint .
```

### Frontend manual role test

Use separate accounts or test users:

1. Log in as owner.
2. Confirm the owner dashboard shows real farm data.
3. Confirm the owner bottom navigation has Reports and does not have Saisie.
4. Open Reports and verify farm, date, and author values.
5. Send a farm notification and verify it appears for the intended recipient.
6. Create an event for one or multiple farms.
7. Create an invitation and confirm the selected farm and role.
8. Log in as manager.
9. Confirm the manager sees operational reports and alerts but not owner personnel/farm administration.
10. Log in as worker.
11. Confirm the worker sees the simplified update workflow and cannot see owner actions.
12. Submit eggs, return to the home screen, and confirm dashboard values refresh.

### Database verification

After applying the schema/migrations, verify:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'daily_reports'
ORDER BY ordinal_position;

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('events', 'notifications', 'market_prices');
```

Also verify that `daily_reports.created_by`, `daily_reports.feed_used_bags`, and the `market_prices` table exist.

## 7. Release Gate

Do not call the prototype ready for real users until all of these are true:

- Backend starts with a configured database.
- Migrations run successfully on a clean database and an existing database.
- Automated backend tests pass.
- Frontend TypeScript and lint checks pass.
- Owner, manager, and worker role flows have been manually tested.
- No screen presents mock data as real data.
- Stock, password recovery, synchronization, and export behavior is either implemented or clearly disabled.
- Market-price source and business formulas are approved.
- Secrets are supplied through environment variables and are absent from source control.
