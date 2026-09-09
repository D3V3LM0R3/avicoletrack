# AvicoleTrack Deployment Status

Updated: 2026-09-09

## Hosting

| Component | Provider | URL / location | Status |
| --- | --- | --- | --- |
| Frontend | Vercel | https://avicoletrack-gules.vercel.app | Deployed; login and navigation issue resolved |
| Frontend backup/static deployment | GitHub Pages | https://d3v3lm0r3.github.io/avicoletrack/ | GitHub Actions deployment exists; project-path routing is configured |
| Backend API | FastAPI Cloud | https://avicoletrack.fastapicloud.dev | Live and responding |
| PostgreSQL database | Neon | Neon project connection configured through `DATABASE_URL` | Connected and serving application data |
| Transactional email | Brevo SMTP | `smtp-relay.brevo.com:587` | Configuration currently failing authentication |
| Transactional email | Resend API | `https://api.resend.com/emails` | Preferred provider; requires API key and verified sender |

## Repository Layout

- Frontend: `frontend/` (Expo SDK 54, Expo Router, React Native Web)
- Backend: `backend/` (FastAPI, SQLAlchemy, PostgreSQL)
- Database migrations: `database/migrations/` and `backend/migrations/`
- GitHub Pages workflow: `.github/workflows/deploy-pages.yml`

## Production Configuration

### Frontend

The frontend is built as a static Expo web app.

```text
EXPO_PUBLIC_API_URL=https://avicoletrack.fastapicloud.dev
EXPO_PUBLIC_INVITATION_BASE_URL=https://avicoletrack-gules.vercel.app/register-invitation
```

`EXPO_PUBLIC_*` variables are public and are embedded into the browser bundle. They must not contain secrets.

For GitHub Pages builds, the workflow sets:

```text
EXPO_PUBLIC_WEB_BASE_PATH=/avicoletrack
```

Vercel must build from the `frontend` directory with no `/avicoletrack` base path.

### Backend

The backend uses these important environment variables:

```text
DATABASE_URL=<Neon PostgreSQL connection string>
JWT_SECRET=<private secret>
ACCESS_TOKEN_EXPIRE_MINUTES=60
FRONTEND_URL=<production frontend origin>
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=<Brevo login email>
SMTP_PASSWORD=<Brevo SMTP key>
SMTP_FROM_EMAIL=<verified Brevo sender>
SMTP_USE_TLS=true
RESEND_API_KEY=<private Resend API key>
RESEND_FROM_EMAIL=<verified Resend sender>
```

`FRONTEND_URL` should be the frontend origin without a trailing slash. For the current Vercel deployment:

```text
FRONTEND_URL=https://avicoletrack-gules.vercel.app
```

The backend uses `FRONTEND_URL` for CORS and for verification/password-reset links.
Resend is preferred when both `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set;
SMTP remains available as a fallback.
Access tokens include a JWT expiration claim and expire after 60 minutes by default.
Set `ACCESS_TOKEN_EXPIRE_MINUTES` in FastAPI Cloud to change the timeout, then
redeploy the backend. Existing tokens keep their original expiration.

## Verified Facts

- The FastAPI health endpoint responds successfully:
  `https://avicoletrack.fastapicloud.dev/health`
- Neon-backed API requests have succeeded in production.
- A successful production login returned HTTP 200 and a subsequent `/farms` request also returned HTTP 200.
- The Expo web export completes successfully and generates 58 static routes.
- The backend package builds successfully with explicit setuptools package configuration.

## Remaining Problems

### 1. Transactional email provider

The previous Brevo configuration reported:

```text
smtplib.SMTPAuthenticationError: (535, b'5.7.8 Authentication failed')
```

Resend is now the preferred provider. Registration commits the user to Neon,
then the backend sends through Resend when its variables are configured.

Configure these FastAPI Cloud variables:

- `RESEND_API_KEY`: private Resend API key
- `RESEND_FROM_EMAIL`: sender using a verified Resend domain

### 2. Frontend login/navigation behavior — resolved

The frontend has experienced repeated redirects/loading behavior, especially in Chrome. The root cause investigated so far was authentication state being re-read during route changes and stale browser `sessionStorage` containing `auth_token`.

The fix now:

- avoid reloading auth state on every nested route change;
- avoid forcing every authenticated auth screen back to the tabs route;
- prevent a stale web session from creating an auth redirect loop;
- show a persistent email-verification notice on the login page.

For local browser recovery, clear site data for the frontend origin, including `sessionStorage`, then reload.

### 3. Analytics graphs — pending

Add visual graphs to the analytics tab for production and operational trends.
The frontend entry point is `frontend/app/analyse/index.tsx`; the supporting
analytics endpoints are in `backend/app/api/routes/analytics.py`. Planned graph
areas include egg production, laying percentage, mortality, stock, and financial
trends where the underlying data is available.

## Next Work Order

1. Correct Brevo SMTP credentials and redeploy the backend.
2. Register a fresh test account and confirm that the verification email arrives.
3. Verify the email, log in, load the farms/dashboard data, and test an invitation link.
4. Add graphs to the analytics tab and validate them with production data.
5. Confirm the final frontend domain and keep only that domain in production CORS/email-link configuration.
