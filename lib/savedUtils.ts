import { supabase } from "./supabase";
import * as photosApi from "./photosApi";

async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function deletePhotoEverywhere(photoId: string, fileName?: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  await photosApi.deletePhotoEverywhere(uid, photoId, fileName);
}

export async function toggleSaved(photoId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  return photosApi.toggleSavedPhoto(uid, photoId);
}

export async function getSavedIds(): Promise<Set<string>> {
  const uid = await currentUserId();
  if (!uid) return new Set();
  return photosApi.fetchSavedIds(uid);
}
