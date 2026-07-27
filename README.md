# ESS Onboarding Portal

Production starter for the Employee Self-Service onboarding portal.

## Stack
- Next.js 16 (Pages Router for portal screens)
- React 19 + TypeScript
- CSS in `src/styles/globals.css`

## Project structure

```text
src/
  components/
    common/
    auth/
    layout/
  pages/
    _app.tsx
    login.tsx
    change-password.tsx
    dashboard.tsx
    onboarding/
      index.tsx
      [step].tsx
  hooks/
  services/
  types/
  utils/
  styles/
  App.tsx
```

## Environment

Copy `.env.example` to `.env.local` and set:

```env
# Origin only (no trailing /api) — request paths already start with /api/...
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.30:8888
```

## API integration points

Auth API methods are centralized in:
- `src/services/api.ts`
- `src/services/authService.ts`

Replace endpoint contracts there as soon as backend APIs are provided.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
