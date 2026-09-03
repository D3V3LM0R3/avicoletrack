
# AvicoleTrack

AvicoleTrack is a poultry farm management, monitoring, analysis and decision-support platform.

## Main Areas

- Production
- Farm Management
- Analytics
- Alerts and Notifications
- Orders
- Deliveries
- Farming Events
- Market Analysis

## User Roles

- Aviculteur
- Chef d'Entreprise
- Directeur / Responsable

## Project Structure

frontend/   - User interface
backend/    - API and business logic
database/   - Database resources
docs/       - Project documentation
tests/      - Automated and manual tests

## Development Status

**Current stage: Beta completed.** Core farm operations, capital management,
communication, exports, and the game experience are implemented and validated.

The project has moved beyond a simple prototype and is now being shaped as a real beta product for poultry enterprise management.

Implemented:

- User registration and login
- JWT authentication
- Password hashing
- User roles
- Enterprise ownership
- Multiple farms per enterprise
- Farm-scoped memberships
- OWNER / MANAGER / WORKER authorization
- Farm-scoped flock access
- OWNER-only farm creation
- OWNER-only personnel management
- Invitation-based MANAGER/WORKER registration
- Invitation expiration
- Invitation cancellation
- Invitation reactivation before expiration
- One-time invitation tokens
- Farm membership activation/deactivation
- Protected farm and flock endpoints
- Daily reporting and KPI calculations
- Alerts and notifications
- Farm comparison analytics
- Event and market-pricing workflows

---

## Completed Beta Capabilities

The beta supports reliable operations for owners, managers, and workers, with
clear business visibility across farms.

Delivered additions include the owner capital dashboard with FCFA profit/loss
periods and farm comparisons, enterprise chat with direct/group conversations,
and the endless chicken game with offline score synchronization and a shared
leaderboard.

## Validation

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
cd backend && python -m compileall -q app
cd frontend && npx tsc --noEmit && npm run lint
```

Connection to GitHub. 