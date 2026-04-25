export default function MapPlaceholder() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Map Section</h2>
          <p className="mt-2 text-sm text-slate-600">
            The map will be added in the next step after connecting photo data.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Coming Soon
        </span>
      </div>

      <div className="mt-6 flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-700">
            Map placeholder area
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Later, uploaded photo locations will appear here.
          </p>
        </div>
      </div>
    </section>
  );
}
