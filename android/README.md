# HRMS Employee App (Android / React Native + Expo)

Clean, professional **Google-style** mobile app for the HRMS user/employee self-service side.

- Not "AI-ish" — standard Material Design 3 inspired UI (clean cards, typography, primary blue accents, bottom nav, plenty of breathing room).
- Built with **Expo + TypeScript + React Native Paper**.
- Uses the **exact same user-specific APIs** the web app consumes:
  - Auth: `/api/auth/login`, `/api/auth/2fa/complete-login`, `/api/auth/me`, refresh, logout
  - Profile: `/api/employees/me`, `/api/users/me`, PATCH `/api/users/{id}`
  - Leave (user): `/api/me/leave/requests`, `/api/me/leave/balances`, `/api/leave/types`
  - Attendance: `/api/attendance/mobile-punches/check-in`, `check-out`, list punches

## Project location
This entire mobile app lives in `/hrms/android` (as requested). The web Next.js project is at the parent level.

## Quick start (dev)

```bash
cd /hrms/android

# Install (already done after bootstrap)
npm install

# Start the dev server (Expo)
npm start
# or
npm run android   # if you have an emulator/device connected
```

- Use **Expo Go** app on a physical Android phone to scan the QR for the fastest experience (no need for full Android Studio initially).
- For native build later: `npx expo prebuild` then open the generated `android/` folder in Android Studio.

## Configuration

Edit the API base URL in:

```ts
src/lib/config.ts
export const API_BASE_URL = 'http://192.168.1.30:8888';
```

Change to your backend (must be reachable from the device/emulator; use your machine LAN IP, not localhost).

## Key screens (Google-like UX)

- **Home**: Greeting, quick action cards (Check-in, Request leave), assignment snapshot, leave balance preview, recent requests.
- **Attendance**: Big primary "Check In" + outlined "Check Out" buttons + scrollable recent punches list (pull-to-refresh).
- **Leave**: Balances list + My requests + beautiful "Apply for leave" form (select type + dates + reason). Submits via the employee-scoped `/api/me/leave/requests`.
- **Me (Profile)**: Avatar, core org info, editable basic fields (first/last name, phone). More rich sections (contacts, addresses, etc.) are view-only here (same as web).

## Auth flow supported
Email + password → if server returns `requiresOtp` + `tempToken`, shows OTP step → calls `/api/auth/2fa/complete-login`.

Tokens are stored securely with `expo-secure-store`.

## Tech choices for "standard + wonderful" UI
- `react-native-paper` (MD3 components, elevation, ripples, chips, cards — exactly the Google material language).
- Bottom tabs + top app bar (subtle, not flashy).
- React Query for data + optimistic refresh after mutations.
- Lucide icons (clean line icons).
- Pull-to-refresh, loading states, empty states, error alerts everywhere.
- Light theme only for a crisp professional feel (easy to add dark later).

## Building a standalone APK (optional)

```bash
npx expo install --fix
npx expo build:android   # or use EAS: eas build -p android
```

Or after `npx expo prebuild` you get a full native Android project under the generated `android/` subfolder and can build from Android Studio / gradle.

## Notes
- This is the **employee/user side** only (self-service). Admin-heavy features live on the web.
- All "my" endpoints (`/api/me/...` and `/api/employees/me`) are used where available.
- The web and this mobile app happily share the same backend.

Enjoy a clean, fast, trustworthy mobile experience for your users!
