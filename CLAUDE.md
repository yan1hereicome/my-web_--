# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (Next.js)
npm run dev        # start dev server at localhost:3000
npm run build      # production build
npm start          # serve production build
npm run lint       # ESLint check
npx tsc --noEmit   # TypeScript type check (no test suite exists)

# Deploy — Vercel (auto-deploy on push), which handles the dynamic routes
# (/share/[id], /collab/[id]) via SSR. next.config.ts has no `output: "export"` —
# don't add one without also solving those two routes, since static export can't
# serve IDs that are created at runtime and can't be enumerated at build time.

# Backend (optional Python FastAPI — only needed for nearby-places / AI diary / landmark features)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # starts at localhost:8000, auto-loads backend/.env (python-dotenv)

# Download face-api.js model weights (~21 MB, run once from project root)
bash _scripts/download-models.sh
```

## Environment

`.env.local` must exist at the project root:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`backend/.env` (optional, only for the AI diary/landmark endpoints — see below):
```
ANTHROPIC_API_KEY=...
```

## Architecture

**Travelries** is a travel photo app: upload photos (one or many) → extract GPS + EXIF → run client-side face detection → save to map/albums. It is a PWA (`app/manifest.ts`, `/pwa-icon` route).

### Data storage split

- **Auth**: Supabase Auth (`lib/supabase.ts`) — login, signup, session management, password reset.
- **Photo data (personal)**: Supabase `photos` table via `lib/photosApi.ts` (see Key shared types below) — replaced the old `map-<uid>`/`faces-<uid>`/`saved-<uid>` localStorage arrays. `face-labels-<uid>` (Faces page person-name labels) is the one thing still on localStorage.
- **Images (personal)**: uploaded to the `user-photos` Storage bucket (`uploadToUserPhotos` in `app/page.tsx`, path `<uid>/<photoId>.<ext>`); the row's `image_url` stores the resulting public URL directly. Falls back to a base64 data URL inline in the row if the Storage upload fails.
- **Supabase DB tables** (for social features):
  - `profiles` — display name + join date per user; auto-created on first profile page load if missing
  - `notifications` — per-user notifications, queried via `lib/notificationUtils.ts`
  - `collab_albums`, `collab_members`, `collab_photos` — collaborative albums, managed via `lib/collabUtils.ts`
  - `shares` — public photo share links, managed via `lib/shareUtils.ts`
  - `trip_diaries` — cached AI-generated diary text per trip, keyed by `(user_id, trip_key)`; see the AI diary/landmark caching note under Albums below
  - `follows`, `posts`, `post_likes`, `post_comments`, `post_tags` — social feed layer, managed via `lib/socialUtils.ts`; see Social feed below
  - RPC: `join_collab_album(p_invite_code)`, `record_share_view(p_share_id)`
- **Supabase Storage buckets**: `user-photos` (personal photos), `collab-photos` (collab album images), `shares` (shared photo images).

### Auth flow

`AuthGuard` (`components/AuthGuard.tsx`) wraps the entire app in `app/layout.tsx`. It calls `supabase.auth.getSession()` on mount and subscribes to `onAuthStateChange`. While the session check is in flight it renders a full-screen 🌍 spinner. Unauthenticated users are redirected to `/login`; public paths are `/login`, `/signup`, `/forgot-password`, `/reset-password`, and `/share/[id]` (matched with `path.startsWith("/share/")`).

`NotificationBell` is rendered directly in `app/layout.tsx` (not inside `Header`) so it floats over all pages globally.

Page transitions are handled by `app/template.tsx` (framer-motion fade+slide on every route change).

### Home page (`app/page.tsx`)

Single-file upload OR multi-file batch upload. On file select:
1. EXIF + GPS extracted via `exifr`
2. Face detection runs in browser (`face-api.js`)
3. Thumbnail created via `canvas.toDataURL`
4. Face-detection result upserted into Supabase `photos` (`is_face_photo: true`) via `lib/photosApi.ts`; clicking "Save to Map" afterward reuses that same row's id and adds `is_map_photo: true` + location fields, rather than creating a second row — see Key shared types below for why that matters.

**Batch upload**: selecting multiple files queues them into a `BatchFile[]` state and processes them sequentially via `processBatch()`. A live progress panel shows per-file status icons and a progress bar. Once all files finish, the panel switches to a review grid (one card per uploaded photo, with face-count/scenery badges) where tapping a photo lets you rename it before dismissing. Stats refresh after the batch completes.

**Dashboard stat cards**: total photos saved, unique locations visited, total faces detected — read live via `fetchMapPhotos`/`fetchFacePhotos` (`lib/photosApi.ts`).

**Highlights section**: most recent upload and photo with the most faces detected.

### Face detection

Two execution modes depending on whether the Python backend is running:

**Browser mode** (no backend): `app/page.tsx` uses face-api.js — tries SSD MobileNetV1 first (requires weights from `download-models.sh`), falls back to TinyFaceDetector. Returns 128-dim descriptors. No age/gender.

**API mode** (backend alive): `app/page.tsx` POSTs to `/analyze`. The backend runs a two-tier pipeline in `backend/utils/face_utils.py`:
- **Tier 1 (InsightFace buffalo_s)**: SCRFD detector at 640×640 with tiling for images larger than 640px (512px stride, 128px overlap). IoU-based NMS deduplicates tile boundaries. Returns 512-dim ArcFace (MobileFaceNet) embeddings + age + gender. Uses the small `buffalo_s` model pack with landmark modules disabled, and 640px tiles instead of the original 1280px (not `buffalo_l` / 1280px) to fit free-tier hosting's ~512MB RAM ceiling — see `backend/utils/face_utils.py` module docstring.
- **Tier 2 (SSD+dlib fallback)**: Used only if InsightFace/onnxruntime is not installed. Returns 128-dim dlib descriptors, no age/gender.
- EXIF Orientation is corrected before detection so portrait phone photos are upright.
- Backend `/analyze` response includes `ages`, `genders`, `confidences` in addition to `faceBoxes` and `descriptors`.

Result stored in `FacePhoto` with normalized bounding boxes (`x_norm`, `y_norm`, `w_norm`, `h_norm`).

`app/faces/page.tsx` clusters descriptors by Euclidean distance (DBSCAN on the backend, Euclidean threshold in-browser) to group same-person appearances — no server involved for the clustering step. The in-browser threshold is a fixed constant (`MATCH_THRESHOLD = 0.55` in that file, tuned empirically) — there is intentionally no UI to change it; a previous adjustable slider was removed because it kept resetting/drifting. Deleting a photo (single, via a per-photo confirm modal, or all at once via "Clear All") goes through `deletePhotoEverywhere` in `lib/savedUtils.ts` (thin wrapper over `photosApi.deletePhotoEverywhere`), which deletes the `photos` row outright — a deliberate simplification from the old per-view (map vs. faces) independent delete — and any matching `collab_photos` row by filename. `saved_photos` rows cascade automatically via its FK.

### Other pages

- **`app/saved/page.tsx`**: Grid of photos starred via `toggleSaved`. Downloads are triggered via a temporary `<a>` element against the image URL.
- **`app/stats/page.tsx`**: Aggregated read-only view computed from `fetchAllPhotos`/`getSavedIds` (`lib/photosApi.ts`) on mount. A **"Year in Review"** button renders a Spotify-Wrapped-style share card (`drawYearReviewCard`, see Share cards below) from the same `Stats` object already computed for the page — no extra fetch.
- **`app/profile/page.tsx`**: Reads/writes `profiles` table; validates old password via a re-`signInWithPassword` call before calling `updateUser`.
- **`app/collab/join/page.tsx`**: Accepts an invite code and calls `joinAlbumByCode` (RPC). Redirects to `/collab` on success.

### Albums (`app/albums/page.tsx`)

Photos grouped by location string. Filters:
- **Search bar**: matches filename or location (case-insensitive substring)
- **Date range chips**: All / This Week / This Month / This Year — filters by `captureDate` or `uploadedAt`
- Both filters compose: category → date range → search

**Trips view** (`viewMode === "trips"`, via `detectTrips()`) groups photos into trip cards by date gap. Each trip card has an **"AI Diary"** button — checks Supabase `trip_diaries` for a cached entry first (keyed by `trip_key`, the sorted/comma-joined ids of the trip's photos — stable across reloads and filter changes, unlike `trip.id` which is just an array index) and only POSTs to `/generate-diary` on a cache miss; a successful generation is written back via `saveTripDiary`. `DiaryModal` shows a "Re-generate" button once a diary is loaded, which is the only way to force a fresh API call. The single-photo detail modal (`PhotoModal`) has an **"Identify Landmark"** button — only shown when the photo has no `landmark_analyzed_at` yet; it resizes the image client-side (`resizeImageForApi`, max 1024px) before POSTing to `/recognize-landmark`, then persists the result via `saveLandmarkResult` (`photos.landmark_name`/`landmark_confidence`/`landmark_description`/`landmark_analyzed_at`). Once analyzed, the cached result renders directly from `MapPhoto` with only a small "Re-analyze" link to force another call. Both endpoints are no-ops with a Korean error message if the backend is offline or `ANTHROPIC_API_KEY` isn't set (the endpoints return `{error: "..."}` for that rather than a 500). The backend also resizes server-side (`_resize_for_api` in `claude_utils.py`) as a backstop, and logs model/token usage/duration/errors for both calls via the standard `logging` module. `PhotoModal` also has a **"Story"** button rendering an Instagram-story-shaped share card for that one photo (`drawPhotoStoryCard`, see Share cards below).

### Share cards (Canvas API)

`components/ShareCardModal.tsx` is a generic "render a card to a 1080×1920 canvas, then Save or Share it as a PNG" modal — it owns the canvas, the `toBlob`-based download, and the Web Share API call (`navigator.canShare({ files })`, falling back to download when file-sharing isn't supported, e.g. most desktop browsers); callers only supply a `draw(ctx, width, height)` function. `lib/canvasCard.ts` has the drawing helpers both callers share: `loadImage` (sets `crossOrigin: "anonymous"` — required to export the canvas without a tainted-canvas `SecurityError`, which works because Supabase Storage's public buckets serve permissive CORS by default), `drawImageCover` (CSS `object-fit: cover` equivalent), and `drawWrappedText`. Two draw functions currently exist: `drawPhotoStoryCard` (`app/albums/page.tsx`, one photo + its location/date) and `drawYearReviewCard` (`app/stats/page.tsx`, a dimmed cover photo behind the year's aggregate `Stats` — total photos, places visited, faces detected, top destination). Both are plain async functions, not components — `ShareCardModal` awaits whichever one is passed in.

### Notifications (`lib/notificationUtils.ts`)

Real-time notifications via Supabase Realtime. `subscribeToNotifications(userId, onNew)` opens a postgres_changes channel filtered to `user_id`. The `NotificationBell` component polls on mount and subscribes for live inserts. Notification types: `share_viewed`, `collab_joined`, `collab_photo_added`.

### Collaborative albums (`lib/collabUtils.ts`, `app/collab/page.tsx`)

Users create shared albums with an invite code. Others join via `joinAlbumByCode` (calls `join_collab_album` RPC). Roles: owner / contributor / viewer. Photos are uploaded to the `collab-photos` storage bucket and stored in `collab_photos` table. Individual album detail pages live at `/collab/[id]`.

### Sharing (`lib/shareUtils.ts`)

`sharePhoto(photo)` uploads the base64 image to the `shares` storage bucket, inserts a row into `shares`, and returns a public URL (`/share/[id]`). The share page is public (no auth required). Views are tracked via the `record_share_view` RPC.

### Social feed (`app/feed/page.tsx`, `lib/socialUtils.ts`)

A simple follow/feed/like layer, additive on top of the existing schema (new tables only — doesn't touch `photos` RLS). `posts` stores a **denormalized snapshot** of a photo (`image_url`/`caption`/`location`/`capture_date`) taken at post time via `createPost`, rather than a live FK into `photos` — so reading a followed user's feed never needs cross-user SELECT access to their `photos` rows. `posts.user_id` also has no FK into `profiles` (a user can post before a `profiles` row exists for them, since that row is otherwise lazily created on first `/profile` visit — see `app/profile/page.tsx`), so `fetchFeed` joins author names in client-side from a separate `profiles` query and falls back to "Traveler" for anyone missing one; `ensureProfile` is called on `/feed` load to backfill the current user's own row.

- **Follow**: `follows` (`follower_id`, `following_id`) — `followUser`/`unfollowUser`/`getFollowingIds`/`getFollowCounts`. Finding people to follow is a name search over `profiles` (`searchProfiles`, `ilike`), which needed a wider-than-"own row only" RLS select policy on `profiles` (added permissively in the same migration — Postgres OR's multiple permissive SELECT policies together, so this can only widen access).
- **Post**: `posts` — created from one of the current user's own map photos via the "Post" button's `NewPostModal` (a simple picker over `fetchMapPhotos`, not a new upload flow). RLS: visible to the author or anyone following them.
- **Like**: `post_likes` (`post_id`, `user_id`) — `toggleLike`; `fetchFeed` resolves counts and "did I like this" in two follow-up queries across all visible posts rather than per-post, to avoid N+1 queries.
- **Comment**: `post_comments` (`post_id`, `user_id`, `content`, `parent_comment_id`) — same visibility RLS as `post_likes` (author or a follower can read). `fetchComments`/`addComment`/`deleteComment`. Comments load lazily per post (only once its panel is expanded in the feed UI), not batched into `fetchFeed` — only `commentCount` is batched there, same N+1-avoidance pattern as like counts. `components/CommentThread.tsx` is a self-contained comment section (fetches its own comments, owns add/reply/like/delete) used by both `app/feed/page.tsx` (mounted only while a post's panel is expanded) and `app/post/[id]/page.tsx` (always mounted) — neither page duplicates comment state. Replies are one level deep only (`parent_comment_id`, set via `addComment(uid, postId, content, parentCommentId)`) — a reply can't itself be replied to, same flat-thread model Instagram/Facebook use. Comments can also be liked (`comment_likes` table, `toggleCommentLike`) — same `toggleLike`-shaped API as post likes.
- **Repost**: `createRepost` inserts a normal `posts` row owned by the reposter with `repost_of` (the original post's id) and a denormalized `original_author_name` — no new RLS policy needed since it's visible via the same "own or followed" rule as any post. Reposting a repost points `repost_of` at the *original*, not the repost, so reposts never chain. `on delete set null` (not cascade) on `repost_of`, so a repost survives the source post being deleted, consistent with posts already being snapshots rather than live references.
- **Share**: reuses `sharePhoto` (`lib/shareUtils.ts`) rather than a feed-specific mechanism — a post's `image_url` is already a public Storage URL, so `sharePhoto` skips re-uploading and just creates a `shares` row + `/share/[id]` link, same as sharing a photo from Albums. Falls back to clipboard copy when `navigator.share` isn't available.
- **Tag**: `post_tags` (`post_id`, `tagged_user_id`) — an explicit "tag people" picker in `NewPostModal` at post time, **not** free-text `@mention` parsing (`profiles.name` can contain spaces, e.g. "Jeong min", which makes parsing ambiguous without a separate single-token username field this app doesn't have). Tagging someone writes a notification for *them*, which a plain client insert can't do under RLS (every table here only allows inserting your own rows) — `tag_user_in_post(p_post_id, p_tagged_user_id)` is a `SECURITY DEFINER` RPC (same pattern as `join_collab_album`/`record_share_view`) that validates the caller owns the post, then inserts the tag and the `notifications` row (type `tagged_in_post`) together. Untagging is a plain delete (the post-owner-only RLS delete policy already covers it, no RPC needed). `fetchFeed` batches tagged users per post the same way it batches likes/comments.

Profile pictures (`profiles.avatar_url`) reuse the existing `user-photos` Storage bucket rather than a new one — `app/profile/page.tsx` uploads to `<uid>/avatar-<timestamp>.jpg` (a fresh filename per upload, not a fixed path with `upsert`, so it only ever needs the same insert-your-own-path Storage permission photo uploads already use). `Avatar` (in `app/feed/page.tsx`) renders the image when present, falling back to initials.

The "N following · N followers" counts on `/feed` are clickable, opening `FollowListModal` (`fetchFollowingProfiles`/`fetchFollowerProfiles` in `lib/socialUtils.ts`) with a Follow/Unfollow toggle per person, reusing the same `handleFollowToggle` as the search results. `searchProfiles` strips a leading `@` before matching against `profiles.name` — people type Instagram-style `@name` out of habit, but names are never stored with one.

**Viewing someone else's profile**: `app/u/[id]/page.tsx` — avatar, name, follower/following counts, a Follow/Unfollow button, and a post grid, reachable by clicking any avatar/name in the feed (post header), search results, or `FollowListModal` (all now wrapped in a `Link` to `/u/[id]`). Their posts only render if you already follow them (or it's your own profile) — `fetchUserPosts` runs the exact same query+RLS as the main feed, just filtered to one author, so it naturally comes back empty for someone you don't follow; the page shows a "Follow to see their posts" placeholder in that case rather than a silently-empty grid. `Avatar`/`initials` were extracted to `components/Avatar.tsx` once a second page needed them (previously local to `app/feed/page.tsx`).

**Engagement notifications**: liking or commenting on a post notifies its author (`notifications` type `post_liked`/`post_commented`) — via `AFTER INSERT` triggers on `post_likes`/`post_comments` (`notify_post_like`/`notify_post_comment` in `0008_engagement_notifications.sql`), not client code, so it fires regardless of which call site does the insert. Liking a comment or replying to one similarly notify that comment's author (`comment_liked`/`comment_replied`, via `notify_comment_like`/`notify_comment_reply` in `0009_comment_likes_and_replies.sql`) — a reply still separately triggers the post-level `notify_post_comment` too, so the post owner always hears about new comments even when a reply's notification instead goes to whoever it replied to. All these triggers (like `tag_user_in_post`) are `SECURITY DEFINER`, since `notifications` RLS only allows inserting your own rows and these need to insert one for the *other* user; all skip self-notifications. `NotificationBell`'s `TYPE_ICON`/`ACTION_TEXT` maps cover `post_liked`/`post_commented`/`tagged_in_post`/`comment_liked`/`comment_replied`, falling back to 🔔 for anything unmapped. For all of these the row renders two separate (non-nested) links: `data.from_user_id` resolved via `profilesByIds` links to `/u/[id]`, and — since `data.post_id` is stored by the same trigger/RPC — the action text ("liked your post" etc.) links to `/post/[id]`, so a notification answers both "who" and "which post/comment".

Tagged users under a post caption (`post.taggedUsers`) and deleting a feed post both follow the same conventions used elsewhere: names link to `/u/[id]`, and delete goes through a confirm/cancel modal (`DeletePostConfirmModal`) rather than deleting on click, mirroring `DeleteConfirmModal` in `app/albums/page.tsx`.

**Post detail page**: `app/post/[id]/page.tsx` — a single post (via `fetchPostById` in `lib/socialUtils.ts`, which reuses the same `enrichPosts` batching as the feed) with its full comment thread always expanded, like/comment/delete. Reached from a post's image in the feed, a post grid tile on `/u/[id]`, or a notification's action text. RLS applies exactly as in the feed ("own or followed"), so `fetchPostById` returning `null` — rendered as a "not available" placeholder — covers both a deleted post and one you're not allowed to see (e.g. tagged by someone you don't follow).

### Backend (optional)

`backend/main.py` is a FastAPI server. The frontend polls `GET /health` on load; if it responds the app enters "API mode" (server-side EXIF+face via `/analyze`, POI lookup via `/nearby-places`). If offline, falls back to browser-mode. **Not required** for any core functionality. `/health`'s response includes `utils_available`, `places_available`, `claude_available` — each backend feature degrades independently (missing deps or an unset `ANTHROPIC_API_KEY` return a JSON `error` field from that endpoint rather than a 500).

Key backend files:
- `backend/utils/face_utils.py` — two-tier face pipeline (InsightFace Tier 1, SSD+dlib Tier 2). InsightFace downloads `buffalo_l` (~200 MB) to `~/.insightface/models/buffalo_l/` on first run.
- `backend/utils/exif_utils.py` — EXIF extraction + reverse geocoding
- `backend/utils/places_utils.py` — Overpass API for nearby POIs
- `backend/utils/claude_utils.py` — Claude API (Anthropic SDK, model `claude-haiku-4-5` — chosen for low per-call cost over Opus) wrappers behind `/generate-diary` (photo metadata → short first-person travel diary, `client.messages.create`) and `/recognize-landmark` (photo → landmark name/confidence via `client.messages.parse` + a Pydantic `LandmarkResult` schema). Both require `ANTHROPIC_API_KEY`. Called from `app/albums/page.tsx` (Trips view "AI Diary" button, photo modal "Identify Landmark" button).

To install InsightFace tier: `pip install insightface onnxruntime` (already in `backend/requirements.txt`).

### Key shared types

`lib/types.ts` — `MapPhoto` (`lat?`/`lng?` are optional; photos without GPS still appear in Albums but are filtered out of the map) and `FacePhoto`. `rowToMapPhoto` / `rowToFacePhoto` convert a `public.photos` row into each — that table is a *single unified table* (one row can be a map photo, a face photo, or both, via `is_map_photo`/`is_face_photo` booleans), not a `photos`/`face_photos` split; a `saved_photos` join table backs favorites. `image_url` is stored directly on the row as the full Storage public URL (bucket `user-photos`) — there's no separate path column. `photos` also carries `landmark_name`/`landmark_confidence`/`landmark_description`/`landmark_analyzed_at` (nullable — presence of `landmark_analyzed_at` is what gates whether `/recognize-landmark` gets called again for that photo). Before writing any new migration against `photos`/`saved_photos`, check the live schema in the Supabase dashboard (Table Editor) rather than assuming — an earlier session drafted a competing two-table schema without checking first and had to throw it away.

`MapPhoto.captureTimestamp` is an ISO 8601 string populated alongside the display-only `captureDate`/`captureTime` (which are locale-formatted via `toLocaleDateString()`/`toLocaleTimeString()` and are **not** safe to sort or compare). Anything that needs chronological order — e.g. the map's route line — must sort by `captureTimestamp` (falling back to `uploadedAt` for photos saved before this field existed), never by `captureDate`.

`lib/photosApi.ts` is the only place that talks to the `photos`/`saved_photos` tables — `fetchMapPhotos`/`fetchFacePhotos`/`fetchAllPhotos` (filter+convert), `fetchSavedIds`/`toggleSavedPhoto`, `upsertPhoto` (insert-or-update by id; only the columns present in the input are written, so a partial update never clobbers unrelated columns already on the row — e.g. adding `is_map_photo: true` to an existing face-only row doesn't touch its `boxes`/`descriptors`), `renamePhoto`, `deletePhotoEverywhere`. `lib/savedUtils.ts` (`toggleSaved`/`getSavedIds`/`deletePhotoEverywhere`) is a thin per-caller wrapper that resolves the current user id and delegates to `photosApi` — pages import from `savedUtils`, not `photosApi`, for those three. Unauthenticated/guest sessions get empty results everywhere rather than an error (in practice unreachable — `AuthGuard` requires login on every page that calls these).

### Map (`app/map/page.tsx`)

Uses `react-leaflet` with OpenStreetMap tiles (free, no API key). Leaflet default icons overridden with `L.divIcon` showing a circular photo thumbnail + count badge for clustered markers. Loaded client-side only (Leaflet requires `window`). Only photos with `lat` and `lng` defined are shown.

Two optional overlay toggles, mutually exclusive with the marker view when heatmap is on:
- **Route**: a `RouteLayer` component draws photos as a Polyline in chronological order (sorted by `captureTimestamp`, see above) — a white casing line for contrast against any tile color, an animated flowing dashed line on top (`route-flow-line` keyframe in `app/globals.css`), and a rotated arrow `Marker` at each segment midpoint (bearing computed via `bearingDeg()`) showing travel direction.
- **Heatmap**: `HeatmapLayer` wraps the `leaflet.heat` plugin (`L.heatLayer`, imperatively added/removed via `useMap()` + `useEffect` since it has no react-leaflet component) — replaces the cluster markers while active.

### Metadata / Viewport

`app/layout.tsx` exports two named constants — `metadata` (title, description, appleWebApp) and `viewport` (themeColor). Next.js App Router requires `themeColor` in the `viewport` export, **not** inside `metadata`. Putting it in `metadata` produces a build warning.
