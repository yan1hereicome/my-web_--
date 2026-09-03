// Shared types used across pages

export type MapPhoto = {
  id: string;
  fileName: string;
  imageUrl: string;
  lat?: number;
  lng?: number;
  location?: string;
  captureDate?: string;
  captureTime?: string;
  captureTimestamp?: string; // ISO 8601, for chronological sorting — captureDate/captureTime are locale-formatted display strings and aren't reliably sortable
  uploadedAt?: string;
  faceCount?: number;
  landmarkName?: string | null;
  landmarkConfidence?: string | null;
  landmarkDescription?: string | null;
  landmarkAnalyzedAt?: string; // presence means landmark recognition has already run — skip re-calling the API
};

export type FacePhoto = {
  id: string;
  fileName: string;
  imageUrl: string;
  faceCount: number;
  uploadedAt: string;
  boxes?: Array<{ x: number; y: number; width: number; height: number }>;
  descriptors?: number[][];
  confidences?: number[];
  ages?: number[];
  genders?: string[];
  expressions?: string[];
  lat?: number;
  lng?: number;
  location?: string;
};

// Both converters read from the same `photos` table (public.photos) — a single
// row can be a map photo, a face photo, or both, per its is_map_photo/is_face_photo
// flags. image_url is the full public Storage URL, stored directly on the row
// (not a path that needs a separate getPublicUrl() call).

// Convert a Supabase photos row to MapPhoto
export function rowToMapPhoto(row: Record<string, unknown>): MapPhoto {
  return {
    id: row.id as string,
    fileName: row.file_name as string,
    imageUrl: row.image_url as string,
    lat: (row.lat as number) ?? undefined,
    lng: (row.lng as number) ?? undefined,
    location: (row.location as string) ?? undefined,
    captureDate: (row.capture_date as string) ?? undefined,
    captureTime: (row.capture_time as string) ?? undefined,
    captureTimestamp: (row.capture_timestamp as string) ?? undefined,
    uploadedAt: row.uploaded_at as string,
    faceCount: (row.face_count as number) ?? 0,
    landmarkName: (row.landmark_name as string) ?? undefined,
    landmarkConfidence: (row.landmark_confidence as string) ?? undefined,
    landmarkDescription: (row.landmark_description as string) ?? undefined,
    landmarkAnalyzedAt: (row.landmark_analyzed_at as string) ?? undefined,
  };
}

// Convert a Supabase photos row to FacePhoto
export function rowToFacePhoto(row: Record<string, unknown>): FacePhoto {
  return {
    id: row.id as string,
    fileName: row.file_name as string,
    imageUrl: row.image_url as string,
    faceCount: (row.face_count as number) ?? 0,
    uploadedAt: row.uploaded_at as string,
    boxes: (row.boxes as FacePhoto["boxes"]) ?? undefined,
    descriptors: (row.descriptors as number[][]) ?? undefined,
    confidences: (row.confidences as number[]) ?? undefined,
    ages: (row.ages as number[]) ?? undefined,
    genders: (row.genders as string[]) ?? undefined,
    expressions: (row.expressions as string[]) ?? undefined,
    lat: (row.lat as number) ?? undefined,
    lng: (row.lng as number) ?? undefined,
    location: (row.location as string) ?? undefined,
  };
}
