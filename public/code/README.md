# ESS Login — Code Package

Complete source files for the **Magic Link + OTP Login** flow.

## File Structure

```
code/
├── types/
│   └── auth.ts                    # All TypeScript interfaces
├── lib/
│   ├── validations.ts             # Zod schemas
│   └── auth-client.ts             # API fetch + mock helpers
├── hooks/
│   ├── useMagicLink.ts            # Send-OTP hook
│   └── useOTPVerification.ts      # Verify-OTP hook
├── components/
│   └── auth/
│       ├── MagicLinkRequestForm.tsx  # Step 1 form
│       ├── OTPVerificationForm.tsx   # Step 2 OTP input
│       └── LoginFlow.tsx             # Orchestrator
├── pages/
│   └── login.tsx                  # Full page (Next.js)
└── tailwind.config.ts             # Brand tokens + shadcn compat
```

## Setup

### 1. Install dependencies

```bash
npm install zod react-hook-form @hookform/resolvers sonner lucide-react
npx shadcn@latest add card input label button tabs input-otp
```

### 2. Add shadcn components needed

```bash
npx shadcn@latest add form
```

### 3. Environment variables

```env
NEXT_PUBLIC_API_URL=https://your-api.example.com
NEXT_PUBLIC_USE_MOCK_AUTH=true   # set false in production
```

### 4. Copy files

Copy the `code/` files into your project:

| File | Destination |
|------|-------------|
| `types/auth.ts` | `src/types/auth.ts` |
| `lib/validations.ts` | `src/lib/validations.ts` |
| `lib/auth-client.ts` | `src/lib/auth-client.ts` |
| `hooks/useMagicLink.ts` | `src/hooks/useMagicLink.ts` |
| `hooks/useOTPVerification.ts` | `src/hooks/useOTPVerification.ts` |
| `components/auth/*.tsx` | `src/components/auth/*.tsx` |
| `pages/login.tsx` | `app/login/page.tsx` (App Router) |
| `tailwind.config.ts` | `tailwind.config.ts` |

### 5. Logo asset

Place `alliance-logo.png` at `public/assets/alliance-logo.png`.

## API Endpoints Required

### `POST /api/auth/send-otp`
```json
// Request
{ "contact": "user@alliance.co.tz", "method": "email" }

// Response
{ "success": true, "message": "OTP sent", "otpSent": true, "expiresInSeconds": 600 }
```

### `POST /api/auth/verify-otp`
```json
// Request
{ "contact": "user@alliance.co.tz", "otp": "123456" }

// Response
{ "success": true, "token": "jwt...", "redirectUrl": "/onboarding/dashboard" }
```

## URL Pre-fill

Supports `?email=user@company.com` query parameter for pre-filling
the email field (e.g. from invitation emails).

```
https://yourapp.com/login?email=john.doe@alliance.co.tz
```

## Mock Mode

Set `NEXT_PUBLIC_USE_MOCK_AUTH=true` to use built-in mocks (no real API needed).
Any 6-digit code will be accepted in mock mode.
