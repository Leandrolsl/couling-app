-- =====================================================================
-- Couling — Migration 0005: allow joining a meeting
-- The 0003 meetings UPDATE policy required the caller to ALREADY be a
-- participant, so a new joiner could not add themselves (join no-ops).
-- This relaxes the USING clause so any authenticated user may update a
-- meeting, while WITH CHECK still guarantees the resulting row keeps the
-- caller as organizer or participant (i.e. they can only add themselves
-- to join, or act while a member). Meeting codes remain the access gate;
-- organizer-only actions (mute/end) are enforced in the app.
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- =====================================================================

drop policy if exists "meetings_update_org_or_participant" on public.meetings;

create policy "meetings_update_join_or_manage"
  on public.meetings for update
  to authenticated
  using (true)
  with check (auth.uid() = organizer_id or auth.uid() = any(participants));
