export type PhotoData = {
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadTime: string;
  previewUrl: string;
  captureDate: string;
  captureTime: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  facesDetected: number;
};

type PhotoPreviewProps = {
  photo: PhotoData | null;
  isAnalyzing: boolean;
  error: string | null;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}

export default function PhotoPreview({
  photo,
  isAnalyzing,
  error,
}: PhotoPreviewProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Analysis Result</h2>
      <p className="mt-2 text-sm text-slate-600">
        Selected image preview and extracted metadata
      </p>

      {!photo ? (
        <div className="mt-6 flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
          <div>
            <p className="text-lg font-medium text-slate-600">
              No photo selected yet
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Upload a photo to start analysis
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <img
              src={photo.previewUrl}
              alt={photo.fileName}
              className="h-[420px] w-full object-cover"
            />
          </div>

          <div className="space-y-3">
            <InfoRow label="File name" value={photo.fileName} />
            <InfoRow label="File type" value={photo.fileType} />
            <InfoRow label="File size" value={photo.fileSize} />
            <InfoRow label="Uploaded at" value={photo.uploadTime} />
            <InfoRow label="Capture date" value={photo.captureDate} />
            <InfoRow label="Capture time" value={photo.captureTime} />
            <InfoRow label="Location" value={photo.location} />
            <InfoRow
              label="Coordinates"
              value={
                photo.latitude !== null && photo.longitude !== null
                  ? `${photo.latitude}, ${photo.longitude}`
                  : "Not available"
              }
            />
            <InfoRow
              label="Faces detected"
              value={String(photo.facesDetected)}
            />

            {isAnalyzing && (
              <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                Analyzing photo...
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}