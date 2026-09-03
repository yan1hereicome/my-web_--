// Supabase-backed replacement for the old `map-<uid>` / `faces-<uid>` localStorage
// arrays. Both "views" (map, faces) read from the same public.photos table — a
// photo row can be a map photo, a face photo, or both, via is_map_photo/is_face_photo.
import { supabase } from "./supabase";
import { MapPhoto, FacePhoto, rowToMapPhoto, rowToFacePhoto } from "./types";

export async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function fetchPhotoRows(uid: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("user_id", uid)
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error("fetchPhotoRows failed:", error);
    return [];
  }
  return data ?? [];
}

export async function fetchMapPhotos(uid: string): Promise<MapPhoto[]> {
  return (await fetchPhotoRows(uid)).filter((r) => r.is_map_photo).map(rowToMapPhoto);
}

export async function fetchFacePhotos(uid: string): Promise<FacePhoto[]> {
  return (await fetchPhotoRows(uid)).filter((r) => r.is_face_photo).map(rowToFacePhoto);
}

// For pages that need both counts (Stats) without two round trips.
export async function fetchAllPhotos(uid: string): Promise<{ mapPhotos: MapPhoto[]; facePhotos: FacePhoto[] }> {
  const rows = await fetchPhotoRows(uid);
  return {
    mapPhotos: rows.filter((r) => r.is_map_photo).map(rowToMapPhoto),
    facePhotos: rows.filter((r) => r.is_face_photo).map(rowToFacePhoto),
  };
}

export async function fetchSavedIds(uid: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("saved_photos").select("photo_id").eq("user_id", uid);
  if (error) {
    console.error("fetchSavedIds failed:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.photo_id as string));
}

export async function toggleSavedPhoto(uid: string, photoId: string): Promise<boolean> {
  const { data } = await supabase
    .from("saved_photos")
    .select("photo_id")
    .eq("user_id", uid)
    .eq("photo_id", photoId)
    .maybeSingle();
  if (data) {
    await supabase.from("saved_photos").delete().eq("user_id", uid).eq("photo_id", photoId);
    return false;
  }
  await supabase.from("saved_photos").insert({ user_id: uid, photo_id: photoId });
  return true;
}

export type PhotoUpsertInput = {
  id: string;
  fileName: string;
  imageUrl: string;
  lat?: number | null;
  lng?: number | null;
  location?: string | null;
  captureDate?: string | null;
  captureTime?: string | null;
  captureTimestamp?: string | null;
  faceCount?: number;
  isMapPhoto?: boolean;
  isFacePhoto?: boolean;
  boxes?: FacePhoto["boxes"];
  descriptors?: number[][];
  confidences?: number[];
  ages?: number[];
  genders?: string[];
  expressions?: string[];
  landmarkName?: string | null;
  landmarkConfidence?: string | null;
  landmarkDescription?: string | null;
  landmarkAnalyzedAt?: string;
};

// Insert-or-update by id. Only the columns present in `input` are written on an
// update (Postgres ON CONFLICT DO UPDATE), so e.g. reconciling a face-only row
// into a map+face row doesn't clobber boxes/descriptors already stored on it.
export async function upsertPhoto(uid: string, input: PhotoUpsertInput): Promise<void> {
  const row: Record<string, unknown> = {
    id: input.id,
    user_id: uid,
    file_name: input.fileName,
    image_url: input.imageUrl,
  };
  if (input.lat              !== undefined) row.lat = input.lat;
  if (input.lng              !== undefined) row.lng = input.lng;
  if (input.location         !== undefined) row.location = input.location;
  if (input.captureDate      !== undefined) row.capture_date = input.captureDate;
  if (input.captureTime      !== undefined) row.capture_time = input.captureTime;
  if (input.captureTimestamp !== undefined) row.capture_timestamp = input.captureTimestamp;
  if (input.faceCount        !== undefined) row.face_count = input.faceCount;
  if (input.isMapPhoto       !== undefined) row.is_map_photo = input.isMapPhoto;
  if (input.isFacePhoto      !== undefined) row.is_face_photo = input.isFacePhoto;
  if (input.boxes            !== undefined) row.boxes = input.boxes;
  if (input.descriptors      !== undefined) row.descriptors = input.descriptors;
  if (input.confidences      !== undefined) row.confidences = input.confidences;
  if (input.ages             !== undefined) row.ages = input.ages;
  if (input.genders          !== undefined) row.genders = input.genders;
  if (input.expressions      !== undefined) row.expressions = input.expressions;
  if (input.landmarkName        !== undefined) row.landmark_name = input.landmarkName;
  if (input.landmarkConfidence  !== undefined) row.landmark_confidence = input.landmarkConfidence;
  if (input.landmarkDescription !== undefined) row.landmark_description = input.landmarkDescription;
  if (input.landmarkAnalyzedAt  !== undefined) row.landmark_analyzed_at = input.landmarkAnalyzedAt;

  const { error } = await supabase.from("photos").upsert(row);
  if (error) throw new Error(error.message);
}

// Persists a landmark-recognition result so PhotoModal never has to re-call
// /recognize-landmark for a photo that's already been analyzed.
export async function saveLandmarkResult(
  uid: string,
  photoId: string,
  result: { landmarkName: string | null; landmarkConfidence: string | null; landmarkDescription: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("photos")
    .update({
      landmark_name: result.landmarkName,
      landmark_confidence: result.landmarkConfidence,
      landmark_description: result.landmarkDescription,
      landmark_analyzed_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .eq("user_id", uid);
  if (error) throw new Error(error.message);
}

// trip_key is the sorted, comma-joined list of a trip's photo ids — stable
// regardless of array index or active filters (see detectTrips() in app/albums/page.tsx).
export async function fetchTripDiary(uid: string, tripKey: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("trip_diaries")
    .select("diary_text")
    .eq("user_id", uid)
    .eq("trip_key", tripKey)
    .maybeSingle();
  if (error) {
    console.error("fetchTripDiary failed:", error);
    return null;
  }
  return (data?.diary_text as string) ?? null;
}

export async function saveTripDiary(uid: string, tripKey: string, diaryText: string, language: string): Promise<void> {
  const { error } = await supabase
    .from("trip_diaries")
    .upsert(
      { user_id: uid, trip_key: tripKey, diary_text: diaryText, language, generated_at: new Date().toISOString() },
      { onConflict: "user_id,trip_key" },
    );
  if (error) throw new Error(error.message);
}

export async function renamePhoto(uid: string, photoId: string, fileName: string): Promise<void> {
  await supabase.from("photos").update({ file_name: fileName }).eq("id", photoId).eq("user_id", uid);
}

// Deletes the photo row (saved_photos cascades via its FK) and any collab_photos
// row this user added under the same filename.
export async function deletePhotoEverywhere(uid: string, photoId: string, fileName?: string): Promise<void> {
  await supabase.from("photos").delete().eq("id", photoId).eq("user_id", uid);
  if (fileName) {
    await supabase.from("collab_photos").delete().eq("added_by", uid).eq("file_name", fileName);
  }
}
