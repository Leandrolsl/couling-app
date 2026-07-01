# Couling — Product Requirements Document

## Vision
Couling is a premium private communication platform — the discreet way to message, call, and host meetings without ever revealing your phone number. Think WhatsApp + Zoom + Discord, reimagined as a private club with dark, gold-mustard luxury aesthetics.

## Core Principles
- **Numbers are sacred.** A phone number is used once to verify identity, then disappears from every surface forever.
- **Connection is consent.** You only appear in someone's Circle if they already know your phone — and once added, the number is erased from view.
- **Exclusivity by design.** Dark theme, gold accents (#D4A437), serif headings — feels like a private club, not a generic messenger.

## Feature Set (v1.0 — Shipped)
1. **SMS OTP onboarding** — Phone entry → 6-digit code → Display name + emblem (mock OTP `123456` for MVP; Twilio swap-in ready).
2. **The Circle (Contacts)** — Add by phone; number is replaced with a `Hidden` lock badge immediately on add.
3. **Private Chats** — 1:1 messaging with gold-bordered sender bubbles, auto-polling, optimistic send.
4. **Voice & Video Calls** — Animated call screens with mute / speaker / video toggle / end. Backend logs every call.
5. **Group Meetings** — Create with shareable code (XXX-XXX-XXX); join by code. Organizer controls:
   - Mute all participants
   - Start a Private Talk with selected members (side-bar within the meeting)
   - End meeting for everyone
6. **Profile & Privacy** — Hidden-number toggle (locked on), encryption toggle, read receipts, member tier.

## Tech Stack
- **Frontend:** Expo SDK 54, expo-router, expo-blur, Cormorant Garamond + Outfit (Google Fonts).
- **Backend:** FastAPI + MongoDB (motor), `/api` prefix, Bearer token auth.
- **Design tokens:** Dark luxury archetype, #D4A437 gold accent.

## Mocked / Future Integrations
- **MOCKED:** SMS OTP (universal demo code `123456`) — swap for Twilio.
- **MOCKED:** Voice/video streaming (UI only) — swap for Agora / LiveKit / Daily.
- **MOCKED:** E2E encryption (badge/copy only) — swap for libsignal-style protocol; transport is TLS today.

## Smart Business Enhancement
**Founding Members Tier** — Every new signup is automatically marked `Founding · Gold` in their profile. This sets up future tier-gating (premium meeting durations, custom emblems, exclusive invites) and creates an immediate sense of exclusivity that drives early-adopter virality.

## Key API Surface
| Endpoint | Purpose |
|---|---|
| POST `/api/auth/send-otp` | Send demo OTP |
| POST `/api/auth/verify-otp` | Verify + issue Bearer token |
| POST `/api/auth/profile` | Set display name + emblem |
| GET `/api/me` | Current user |
| POST `/api/contacts/add` | Add to Circle (phone hidden after) |
| GET `/api/contacts` | Circle list (no phones) |
| POST `/api/chats/start` | Start/get 1:1 chat |
| GET/POST `/api/chats/{id}/messages` | Message stream |
| POST `/api/calls/initiate` | Log a call |
| POST `/api/meetings` | Host a meeting |
| POST `/api/meetings/join` | Join by code |
| POST `/api/meetings/{id}/mute-all` | Organizer only |
| POST `/api/meetings/{id}/private-talk` | Organizer only |
| POST `/api/meetings/{id}/end` | Organizer only |
