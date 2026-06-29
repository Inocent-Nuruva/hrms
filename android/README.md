# HRMS Employee App (iOS + Android / React Native + Expo)

Clean, professional mobile app for the HRMS user/employee self-service side on both iPhone and Android.

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
npm run ios       # on macOS with Xcode / iOS Simulator installed
```

- Use **Expo Go** on a physical phone to scan the QR for the fastest setup (limited native features).
- For native builds, this repo now contains both generated native projects:
  - `android/android/` for Android Studio / Gradle
  - `android/ios/` for Xcode / iOS Simulator / device builds

## Testing on iPhone (no Mac required) using EAS Build + dev client

You can fully test the **real native iOS app** (including biometrics/Face ID, exact location permissions, Wi-Fi SSID for attendance, secure storage, notifications, etc.) from a Linux machine.

### 1. Setup (done for you)
- `expo-dev-client` is installed.
- `eas.json` is configured with profiles:
  - `development` — full native dev client for your iPhone (recommended for testing).
  - `development-simulator` — if you ever get simulator access.
  - `preview` — shareable test build.
  - `production` — App Store.
- Added `npm run start:dev-client`.

### 2. Critical: Make your backend reachable from the iPhone
The default `http://192.168.1.30:8888` only works if:
- Phone and dev machine are on the **same Wi-Fi**.
- Your backend is listening on all interfaces (0.0.0.0 not localhost).
- Firewall allows it.

Better options:
- Use a LAN IP that the phone can ping.
- Or expose via **ngrok**, **Cloudflare Tunnel**, **Tailscale**, or similar.
- Or temporarily hardcode a public/reachable URL in `src/lib/config.ts`.

You can also override at build time via `EXPO_PUBLIC_API_BASE_URL` (see eas.json).

### 3. First-time EAS + Apple setup
```bash
cd android
npm install

# Login to Expo
npx eas login

# Configure EAS (creates/updates eas.json if needed)
npx eas build:configure
```

You will need:
- Free **Expo account**.
- An **Apple ID**. For installing on a physical iPhone you will likely need an **Apple Developer Program** membership ($99/year) to register devices and create signing certificates/profiles. EAS can manage this for you.

During first build EAS will ask you to authenticate with Apple and set up credentials (it can store them securely).

### 4. Build a custom dev client for your iPhone
```bash
npx eas build --platform ios --profile development
```

- This runs in the cloud (macOS runner). Takes 10-25 minutes the first time.
- When it finishes, EAS gives you a **link** (and QR).
- Open the link in **Safari on your iPhone** → it installs a custom "HRMS" dev client app (not plain Expo Go).
- Trust the profile if prompted (Settings → General → VPN & Device Management).

(For subsequent JS-only changes you don't need to rebuild the native client.)

### 5. Run and test on the phone
On your Linux machine:
```bash
npm run start:dev-client
# or
npx expo start --dev-client
```

- A QR code appears in the terminal.
- Open the **custom dev client app** you installed on the iPhone.
- Scan the QR code with it.
- The full native app launches on your iPhone, with hot reloading for JS changes.

Test:
- Login + biometrics
- Attendance check-in/out (location + Wi-Fi info)
- Leave requests
- Notifications, profile editing, etc.

### 6. Quick alternative for UI testing (no build needed)
```bash
npm run web
```
Then open `http://YOUR_LINUX_IP:8081` (or the tunnel) in Safari on the iPhone. This runs the web version of the mobile app. Many flows work, but native-only features (Face ID prompt, exact Wi-Fi SSID, push notifs, secure store) are simulated or missing.

### Tips
- Update the IP in `eas.json` (development profile) and/or `src/lib/config.ts` before building.
- To force a clean native rebuild: `npx eas build --platform ios --profile development --clear-cache`
- You can also build preview versions for other testers: `--profile preview`
- For Android on Linux (much easier locally): set up an emulator or USB device and use `npm run android` or `npx expo start --android`.

See full EAS docs: https://docs.expo.dev/build/setup/
```

## Configuration

Edit the API base URL in:

## Configuration

Edit the API base URL in:

```ts
src/lib/config.ts
export const API_BASE_URL = 'http://192.168.1.30:8888';
```

Change to your backend (must be reachable from the device/emulator; use your machine LAN IP, not localhost).

## Key screens

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

## Running and building natively

```bash
npx expo install --fix
npx expo prebuild
```

- Android:

```bash
npm run android
```

- iOS (macOS only):

```bash
npm run ios
```

- The generated iOS project is at `ios/` and can also be opened directly in Xcode using `ios/HRMS.xcodeproj` or `ios/HRMS.xcworkspace` after installing CocoaPods on macOS.

## Notes
- This is the **employee/user side** only (self-service). Admin-heavy features live on the web.
- All "my" endpoints (`/api/me/...` and `/api/employees/me`) are used where available.
- The web and this mobile app happily share the same backend.
- iOS feature parity uses the same Expo/React Native codebase, so attendance, leave, profile, notifications, biometrics, payroll, promotion, and shift views stay aligned across platforms.

Enjoy a clean, fast, trustworthy mobile experience for your users!
