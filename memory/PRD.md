# Couling — PRD & Project Memory

## Original Problem Statement
Restore the Couling project from the GitHub branch `conflict_180526_1519` (github.com/Leandrolsl/couling-app).
This branch holds the original Couling app (test_couling.py, auth, chat, call, meeting modules).
Merge it into `main` without replacing it with any unrelated project. Keep all Couling functionality,
fix merge conflicts, and run it end-to-end.

## Architecture
- **Frontend**: Expo (React Native Web), expo-router. Served via `expo start --web --port 3000` (supervisor `frontend`).
  - Data layer = **Supabase** (email/password auth + realtime chat/meetings) via `src/api/supa.ts` + `src/lib/supabase.ts`.
  - Screens: splash (`app/index.tsx`), auth (email/otp/phone/profile), tabs (chats/calls/contacts/meetings/profile), chat/[id], call/[id], meeting/[id].
  - Theme: dark + gold ("private protocol" aesthetic), Cormorant Garamond + Outfit fonts.
- **Backend (legacy)**: FastAPI + MongoDB (`backend/server.py`, port 8001). Full Couling API (auth OTP, contacts, chats, calls, meetings) + `tests/test_couling.py`. NOT wired to the current UI (kept for parity/tests).
- Env: `frontend/.env` (EXPO_PUBLIC_BACKEND_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY); `backend/.env` (MONGO_URL, DB_NAME, CORS_ORIGINS).

## Restore/Merge (done 2026-07-01)
- Cloned repo, merged `origin/conflict_180526_1519` into `main` with `--allow-unrelated-histories`.
- Resolved all 11 add/add conflicts in favor of the Couling branch; kept main-only files (pytest.ini, test_result.md, etc).
- Synced merged tree into /app (preserved .git/.emergent, excluded 138M .metro-cache).

## Implemented / Verified
- Backend online (`/api` -> {"app":"Couling","status":"online"}). **pytest: test_couling.py 21 passed; test_message_management.py 13 passed, 1 skipped.**
- Frontend boots end-to-end: splash -> email auth -> Supabase. Fixed:
  - RNW root height collapse (added height reset to `public/index.html`).
  - Hanging `supabase.auth.getSession()` gate (Promise.race 2s timeout in `index.tsx`).
  - `app.json experiments.asyncRoutes=false` + Stack `animation:"none"` (route stability).
  - Signup UX: `Alert.alert` (invisible on RN-Web) replaced with inline `auth-error`/`auth-notice` banners; `signUpWithEmail` handles email-confirmation (skips RLS-blocked profile upsert, shows "check your inbox").
- The perceived "/auth/email hang" was Metro DEV cold-compile latency (~30-40s first request), not a bug.

## Supabase schema alignment (2026-07-01)
The live Supabase project schema was OUT OF SYNC with the app. Applied migrations (via SQL Editor):
- `0003_align_schema.sql` — dropped/recreated the 6 app tables to match `supa.ts` + RLS + realtime.
- `0004_fix_signup_trigger.sql` — replaced the broken `auth.users`->profiles trigger with a SECURITY DEFINER `handle_new_user()` (fixed HTTP 500 on every signup).
- `0005_meeting_join_policy.sql` — relaxed meetings UPDATE `USING` so new users can join (WITH CHECK still requires membership).

## FULL E2E VERIFIED (2026-07-01) — 23/23 passed
Script: `/app/scripts/couling_e2e_test.mjs` (two authenticated Supabase sessions vs the LIVE project).
Verified: auth/registration (anon sessions + email signUp 200 needsConfirmation), profiles+RLS, add-contact-by-email,
chat create + **live realtime message delivery** + cross-user RLS read + delete-for-everyone, voice calls (both logs),
meetings create/join/list/mute-all/end. Re-run: `cd /app/frontend && export $(grep EXPO_PUBLIC_SUPABASE ../frontend/.env | xargs) && node /app/scripts/couling_e2e_test.mjs`.

## Known External Blocker
- Supabase project has **"Confirm email" ENABLED** -> new users can't sign in until they confirm.
  Full signin->chats/calls/meetings e2e requires either disabling that setting (Supabase -> Auth -> Providers -> Email)
  or confirming via the emailed link. Supabase also rate-limits signups (~4/hr -> HTTP 429) and rejects fake domains (@couling.test -> 400).

## Login model change (2026-07-01) — NAME + password (no email)
- User enters unique **Name** + password. App maps name -> hidden synthetic email `slug(name)@couling.app`
  (`usernameToEmail`, `signUpWithName`, `signInWithName` in src/api/supa.ts). Contacts added by **Name** (`addContactByName`).
- Requires Supabase "Confirm email" = OFF (done). Verified live: /app/scripts/name_auth_test.mjs (6/6).

## Phase 2 — Live 1:1 calls (WebRTC P2P, mobile-only) (2026-07-01)
- Stack: `react-native-webrtc@124`, `@config-plugins/react-native-webrtc@15`, `expo-dev-client`, `expo-build-properties` (added to app.json plugins). STUN only (Google) in `src/webrtc/ice.ts` — ADD A TURN server there for reliable 4G/mobile connectivity.
- Signaling over Supabase Realtime broadcast channel `call:<id>` (verified transport OK). Incoming calls via `subscribeIncomingCalls` (postgres_changes on `calls`), mounted in `app/(tabs)/_layout.tsx` via `useIncomingCall`.
- Files: `src/webrtc/CallManager.native.ts` (real engine) / `CallManager.web.ts` (stub) / `.d.ts` shim; `src/webrtc/CallStage.native.tsx` (real UI w/ RTCView, mute/video/flip/hangup, incoming accept-decline) / `CallStage.web.tsx` (mobile-only notice); `app/call/[id].tsx` = thin wrapper. supa.ts: `updateCallStatus`, `getCallPeer`, `subscribeIncomingCalls`.
- IMPORTANT: WebRTC is NATIVE-ONLY — does NOT run in Expo Go or the web preview. Web bundle stays clean (platform-split keeps react-native-webrtc out of web). CANNOT be auto-tested in this environment; needs a device.
- To run/test on a phone (EAS dev build):
  1) `cd /app/frontend`  2) `npm i -g eas-cli && eas login`  3) `eas build --profile development --platform android` (or ios)
  4) install the dev build on the device, then `npx expo start --dev-client` and open it. Grant camera/mic permissions.
  Two logged-in users on two devices: caller opens a contact -> Call; callee gets the incoming screen.

## Backlog / Next Actions
- P0 (needs device): validate live 1:1 audio/video on two phones via EAS dev build; add a TURN server for non-Wi-Fi.
- P1: Group calls inside Meetings (WebRTC mesh over the meeting realtime channel) — DEFERRED (much larger; untestable here).
- P2: Replace `Alert.alert` in `app/auth/profile.tsx` and `app/chat/[id].tsx` with inline UI (RN-Web no-op).
- P3: Ship a production web build (or warm Metro on start) to remove first-request compile delay; migrate `shadow*`->`boxShadow`.
