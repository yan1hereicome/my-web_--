-- The `photos` and `saved_photos` tables already exist in the live project (created
-- by an earlier "TravelLens Photo Storage & Access Schema" migration — one unified
-- `photos` table with is_map_photo/is_face_photo flags, not the separate
-- photos/face_photos split an earlier draft of this file assumed). This migration
-- only adds columns that exist in the app's current TypeScript types but not yet in
-- the live table. Safe to re-run — every ADD COLUMN is IF NOT EXISTS.
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).

alter table public.photos
  add column if not exists capture_timestamp timestamptz,  -- ISO capture time, for chronological sort (captureDate/captureTime are locale display strings, not sortable)
  add column if not exists confidences jsonb,               -- number[], one per detected face
  add column if not exists ages jsonb,                      -- number[]
  add column if not exists genders jsonb,                   -- string[]
  add column if not exists expressions jsonb;                -- string[]

create index if not exists photos_user_id_capture_timestamp_idx
  on public.photos (user_id, capture_timestamp);
