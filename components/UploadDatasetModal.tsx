"use client";

import { useState } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabaseClient";

interface UploadDatasetModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

const CATEGORY_OPTIONS = [
  "Core",
  "SSC Framework - P1",
  "SSC Framework - P2",
  "SSC Framework - P3",
  "Hazards",
  "Underlying Vulnerability",
];

const ADMIN_LEVELS = ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4"];
const DATA_TYPES = ["numeric", "categorical"];

export default function UploadDatasetModal({
  onClose,
  onUploaded,
}: UploadDatasetModalProps) {
  const supabase = createClient();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    source: "",
    type: "",
    category: "",
    admin_level: "",
    collected_at: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setPreview([]);
    if (!selectedFile) return;

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPreview(results.data.slice(0, 5));
      },
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file.");
      return;
    }
    if (!form.name || !form.type || !form.category || !form.admin_level) {
      setError("Please complete all required fields.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Upload CSV to Supabase Storage
      const filePath = `datasets/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("datasets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert metadata record
      const { data, error: insertError } = await supabase
        .from("datasets")
        .insert([
          {
            name: form.name,
            description: form.description,
            source: form.source,
            collected_at: form.collected_at || null,
            type: form.type,
            category: form.category,
            admin_level: form.admin_level,
            is_baseline: true,
            is_derived: false,
            metadata: {
              original_filename: file.name,
              storage_path: filePath,
              source: form.source,
            },
          },
        ])
        .select();

      if (insertError) throw insertError;

      console.log("Inserted dataset:", data);
      setSuccess(true);
      onUploaded();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 my-8 p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-2xl font-light"
        >
          ×
        </button>

        {/* Header */}
        <h2 className="text-xl font-semibold text-gray-800 mb-1">
          Upload New Dataset
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Upload a CSV file and provide metadata for registration.
        </p>

        {/* Form */}
        <div className="space-y-3 text-sm">
          {/* File Upload */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Dataset File (CSV)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-700 border rounded-md p-1.5"
            />
            {preview.length > 0 && (
              <div className="mt-2 border rounded bg-gray-50 p-2 text-xs overflow-x-auto">
                <div className="font-semibold mb-1">Preview (first 5 rows)</div>
                <pre className="whitespace-pre-wrap text-[11px]">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Source */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Source</label>
            <input
              type="text"
              name="source"
              value={form.source}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Collected Date */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Collected At
            </label>
            <input
              type="date"
              name="collected_at"
              value={form.collected_at}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Type *</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select type</option>
              {DATA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Admin Level */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Admin Level *
            </label>
            <select
              name="admin_level"
              value={form.admin_level}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select admin level</option>
              {ADMIN_LEVELS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error / Success / Actions */}
        <div className="mt-6 flex justify-between items-center">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">Upload complete!</p>}

          <button
            onClick={handleUpload}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-white ${
              loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Uploading..." : "Upload Dataset"}
          </button>
        </div>
      </div>
    </div>
  );
}
