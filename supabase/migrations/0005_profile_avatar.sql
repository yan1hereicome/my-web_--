-- Adds a profile picture column. The image itself reuses the existing
-- `user-photos` Storage bucket (already public — see uploadToUserPhotos in
-- app/page.tsx) under path `<uid>/avatar.<ext>`, so no new bucket is needed.
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).

alter table public.profiles
  add column if not exists avatar_url text;
