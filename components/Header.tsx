export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          TravelLens
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Travel Photo Analysis App
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Upload a photo and analyze EXIF metadata such as date, time, GPS
          location, and detected faces.
        </p>
      </div>
    </header>
  );
}