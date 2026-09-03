# Frontend security fix

## What changed

- Removed the hard-coded test accounts and fabricated `fake_jwt_*` tokens from login and registration.
Login now calls the backend `POST /auth/login` endpoint and only creates a session when the backend returns a valid signed token.
- Owner and invitation registration now call `POST /auth/register`; they do not log the user in locally before server validation.
- Invitation codes are no longer considered valid because their text contains a particular word. The backend validates their hash, expiry, active state, and invited email.
- Access tokens are stored with Expo SecureStore instead of AsyncStorage. Profile metadata remains in AsyncStorage and is not used as authentication.
- On Web, auth storage uses session storage because SecureStore is native-only. On Android/iOS, tokens use SecureStore; a native client without the module falls back to AsyncStorage with a warning. Build/reinstall a development client after adding `expo-secure-store` to use secure native storage.
- Set `EXPO_PUBLIC_API_URL` to the reachable backend base URL before running the app. The development fallback is `http://localhost:8000`.

## Verification

`npm run lint` passes with no errors or warnings.

`npm audit --omit=dev` still reports transitive vulnerabilities in the Expo 54 toolchain (`image-size`, `postcss`, and `uuid`). npm proposes upgrading to Expo 57 with `--force`, which is a breaking change and was not applied as part of this focused authentication fix.