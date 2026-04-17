"use client";

import type { ChangeEvent } from "react";

type UploadBoxProps = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
};

export default function UploadBox({
  onFileSelect,
  disabled = false,
}: UploadBoxProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Upload Photo</h2>
      <p className="mt-2 text-sm text-slate-600">
        Use a real phone camera photo for EXIF date/time/GPS testing. Screenshot
        files often do not contain this metadata.
      </p>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-base font-medium text-slate-700">
          Choose one photo to analyze
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Recommended: JPG or HEIC from your phone camera
        </p>

        <label
          className={`mt-6 inline-flex cursor-pointer items-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition ${
            disabled ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {disabled ? "Analyzing..." : "Select Photo"}
          <input
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
            disabled={disabled}
          />
        </label>
      </div>
    </section>
  );
}