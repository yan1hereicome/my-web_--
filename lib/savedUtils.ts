type MapPhoto = {
  id: string;
  fileName: string;
  imageUrl: string;
  lat: number;
  lng: number;
  location?: string;
  captureDate?: string;
  captureTime?: string;
  uploadedAt?: string;
  faceCount?: number;
};

export const SAVED_KEY = "savedPhotos";

export function toggleSaved(photo: MapPhoto): boolean {
  const raw = localStorage.getItem(SAVED_KEY);
  const list: MapPhoto[] = raw ? JSON.parse(raw) : [];
  const exists = list.some((p) => p.id === photo.id);
  const next = exists ? list.filter((p) => p.id !== photo.id) : [photo, ...list];
  localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  return !exists;
}

export function isSaved(id: string): boolean {
  const raw = localStorage.getItem(SAVED_KEY);
  if (!raw) return false;
  return (JSON.parse(raw) as MapPhoto[]).some((p) => p.id === id);
}
