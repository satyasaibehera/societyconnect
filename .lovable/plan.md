Here's the plan to deliver all 5 changes. A few items need your input before I can wire OTP fully — flagged at the end.

## 1. Password field fixes (Login + both registration forms)

- Remove the second eye icon that browsers add (Edge/Chrome) by adding CSS to hide `::-ms-reveal` and the WebKit password-reveal pseudo-element on every password input.
- Set the registration password field's initial `showPassword` state to `false` (masked by default).

Files: `src/index.css`, `src/components/registration/SocietyAdminRegForm.tsx`, `src/components/registration/ResidentRegDialog.tsx`, `src/pages/Login.tsx`.

## 2. Registration bifurcation + resident phone field

- The `RegistrationChoice` screen already bifurcates the flow — I'll polish it (clearer headings, "Choose registration type" header, equal-weight cards).
- Add a mandatory **Phone** field to Resident registration, split into a **country-code Select** (with common ISO dial codes: +91, +1, +44, +61, +971, +65, etc.) and a numeric **phone input**. Combined `+<code><number>` value is what gets stored/verified.
- Add the same split phone field to **Society Admin** registration (since OTP applies to both).

## 3. Society dropdown fix

- Current query likely filters `is_active = true`, but newly-created societies are inserted with `is_active = false` (pending Super Admin approval). I'll inspect `ResidentRegDialog.tsx` and change the filter to show **approved & active** societies. If none of your societies are approved yet, I'll also surface a one-click way for you to mark one approved (via the existing Approvals page) — but I won't auto-flip any flags.

## 4. OTP verification (email + phone)

**Email OTP** — implemented via a new edge function `send-email-otp` + `verify-email-otp`:
- Generates a 6-digit code, stores a SHA-256 hash in a new `otp_codes` table with `kind`, `target`, `expires_at` (10 min), `attempts`, `verified_at`.
- Sends the code via **Resend** (requires `RESEND_API_KEY` secret).
- Client shows an "Send code" button → 6-digit input → "Verify" → green check + locks the email field.

**Phone OTP via Firebase** — Firebase Phone Auth runs entirely client-side:
- Add `firebase` package; initialize with your Firebase web config (apiKey, authDomain, projectId, appId, messagingSenderId — all publishable, hardcoded in `src/integrations/firebase/client.ts`).
- Use `RecaptchaVerifier` (invisible) + `signInWithPhoneNumber` → user enters OTP → `confirmationResult.confirm(code)` returns a Firebase ID token.
- A new edge function `verify-firebase-phone` validates the Firebase ID token against Google's public keys and confirms the phone number matches what the user entered. Only then the phone is marked verified.
- The Firebase user session is signed out immediately after verification (we only use it as a verification gate; the real account lives in Lovable Cloud).

**Submit gating** — the "Submit Registration" button stays disabled until both `emailVerified` and `phoneVerified` flags are true (in addition to all other required fields).

## 5. Post-registration approval

- This already works: `register-account` inserts with `status='pending'` (resident) or creates an inactive society + pending role_request (admin), and `ProtectedRoute` routes them to `PendingApproval`.
- I'll harden it: after a successful submit, **sign the user out immediately** and show a success screen ("Registration submitted — pending approval. You'll be able to sign in once approved.") instead of dropping them into the pending page. That way they can't bypass approval by re-using their session.

---

## Technical notes

- New table `otp_codes` (id, kind ['email'|'phone'], target, code_hash, expires_at, attempts, verified_at, created_at) with RLS that blocks all client access — only edge functions (service role) touch it.
- Edge functions: `send-email-otp`, `verify-email-otp`, `verify-firebase-phone`. All use `corsHeaders` + Zod validation.
- Rate limit: 1 send per 60s per target, 5 verify attempts per code.

## What I need from you to finish OTP

1. **Resend API key** for sending email OTPs — I'll request it via the secrets prompt once you confirm. (Free tier: 3k emails/month, requires a verified sender domain or you can use Resend's onboarding sandbox.)
2. **Firebase web config** for your Firebase project — apiKey, authDomain, projectId, appId, messagingSenderId. These are publishable (not secret). You'll get them from Firebase Console → Project Settings → Your apps → Web app. You'll also need to enable **Phone** sign-in under Authentication → Sign-in method, and add your Lovable preview + published domains to **Authorized domains**.

If you'd prefer, I can implement everything *except* the actual OTP send/verify with a **dev-mode mock** (code shown in a toast) so you can test the full UX immediately, then swap in Resend + Firebase once you have keys. Let me know.
