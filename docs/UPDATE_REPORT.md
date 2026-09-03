# AvicoleTrack Update Report

Date: 2026-08-28

## Delivered

### Follow-up release updates

- Added farm-filtered reports, report search, and tap-to-view report details.
- Corrected dashboard report navigation and replaced the hardcoded Mbankomo farm label with live farm data.
- Added persisted report water consumption through migration `012_report_water_time.sql`; saisie defaults water to 10 liters while allowing edits.
- Added migration `013_inventory_quantity_checks.sql` for non-negative farm food and water quantities.
- Added shared preference state so language changes update navigation labels and theme changes rerender the application shell.

- Added migration `011_release_readiness.sql` with farm food type, food quantity/unit, water quantity/unit, persistent flock archive state, and missing membership timestamps/active state.
- Added development QA data in `database/seed/011_release_readiness_demo.sql` for food, water, and flock lifecycle fields.
- Fixed farm comparison so every requested farm is returned, including farms without reports, and report totals tolerate nullable legacy values.
- Added persistent `PATCH /flocks/{flock_id}` editing and archive/unarchive support with authorization checks.
- Added archive-aware flock listing through `include_archived=true`.
- Replaced flock detail mock data and simulated saves with live flock/report API calls.
- Added flock search by flock name, breed, and farm name.
- Added farm summary modal with live member, flock, and report counts.
- Added a working Audit & Historique screen backed by daily reports and events.
- Made the menu profile header navigate to profile settings.

## Validation

- `python -m compileall -q backend/app` passed.
- `npx tsc --noEmit` passed.
- VS Code diagnostics reported no errors in the touched frontend files.
- `git diff --check` passed for tracked changes.

## Deployment note

The workspace has `psql` installed, but no running PostgreSQL service or configured `DATABASE_URL` was available during this update. The live database migration therefore still needs to be run in the target environment, after migrations 001-011 are applied:

```bash
psql "$DATABASE_URL" -f database/migrations/011_release_readiness.sql
psql "$DATABASE_URL" -f database/seed/011_release_readiness_demo.sql
```

Run the seed file only against a development or QA database.

## Remaining product considerations

- Enterprise branding/image fields are not present in the current backend contract, so the menu uses the authenticated user and existing farm context. Adding uploaded enterprise/user images requires storage and upload endpoints.
- Password change requires a dedicated secure endpoint with current-password verification; the current settings screen still labels this as unavailable rather than pretending it succeeded.
