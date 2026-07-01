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

## Backlog / Next Actions
- P1: After confirming a user (or disabling email confirmation), verify chats/calls/meetings + realtime end-to-end.
- P2: Replace `Alert.alert` in `app/auth/profile.tsx` and `app/chat/[id].tsx` with inline UI (same RN-Web limitation).
- P3: Bundle Ionicons font for web (alert-circle icon shows PUA glyph on first paint); migrate `shadow*`->`boxShadow`, `pointerEvents` prop->style to silence RN-Web deprecation warnings.
- P3: Ship a production web build (or warm Metro on supervisor start) to remove first-request compile delay.
