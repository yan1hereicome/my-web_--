-- Adds persistence for the two Claude-backed AI features so results are cached
-- instead of re-calling the API every time a photo/trip is viewed again.
-- Safe to re-run — every ADD COLUMN / CREATE is IF NOT EXISTS.
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).
-- Double-check the `user_id` column type/reference below matches the live `photos`
-- table before running (see CLAUDE.md note on verifying schema before migrating).

-- Landmark recognition result, cached per photo row.
alter table public.photos
  add column if not exists landmark_name text,
  add column if not exists landmark_confidence text,       -- "high" | "medium" | "low"
  add column if not exists landmark_description text,
  add column if not exists landmark_analyzed_at timestamptz; -- set once analysis has run; presence = "already analyzed, skip API call"

-- AI travel diary, cached per trip. A "trip" is a client-side grouping (date-gap +
-- GPS clustering, see detectTrips() in app/albums/page.tsx) with no DB row of its
-- own, so trip_key is the sorted, comma-joined list of that trip's photo ids —
-- stable regardless of array index or active filters, and naturally invalidated
-- if the trip's photo membership changes.
create table if not exists public.trip_diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_key text not null,
  diary_text text not null,
  language text not null default 'ko',
  generated_at timestamptz not null default now(),
  unique (user_id, trip_key)
);

alter table public.trip_diaries enable row level security;

create policy if not exists "trip_diaries_select_own"
  on public.trip_diaries for select
  using (auth.uid() = user_id);

create policy if not exists "trip_diaries_insert_own"
  on public.trip_diaries for insert
  with check (auth.uid() = user_id);

create policy if not exists "trip_diaries_update_own"
  on public.trip_diaries for update
  using (auth.uid() = user_id);

create policy if not exists "trip_diaries_delete_own"
  on public.trip_diaries for delete
  using (auth.uid() = user_id);
