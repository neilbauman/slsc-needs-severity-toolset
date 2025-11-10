"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UploadDatasetModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadDatasetModal({ onClose, onUploaded }: UploadDatasetModalProps) {

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [collectedAt, setCollectedAt] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [adminLevel, setAdminLevel] = useState("");
  const [pcodeColumn, setPcodeColumn] = useState("");
  const [valueColumn, setValueColumn] = useState("");
  const [categoryColumn, setCategoryColumn] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSVColumns = (csvText: string) => {
    const firstLine = csvText.split("\n")[0];
    const headers = firstLine.split(",").map((h) => h.trim());
    setColumns(headers);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFile(selectedFile || null);
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const csvText = event.target?.result as string;
        parseCSVColumns(csvText);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleUpload = async () => {
    setError(null);
    if (!file || !name || !type || !category || !adminLevel || !pcodeColumn || !valueColumn) {
      setError("Please complete all required fields and select file column mappings.");
      return;
    }

    try {
      setLoading(true);

      // Upload dataset metadata
      const { data: dataset, error: datasetError } = await supabase
        .from("datasets")
        .insert([
          {
            name,
            description,
            source,
            collected_at: collectedAt || null,
            type,
            category,
            admin_level: adminLevel,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (datasetError) throw datasetError;

      // Read CSV data
      const csvText = await file.text();
      const rows = csvText
        .trim()
        .split("\n")
        .slice(1)
        .map((line) => {
          const cols = line.split(",").map((c) => c.trim());
          const headerIndex = (h: string) => columns.indexOf(h);
          const row: any = {};
          columns.forEach((col, i) => (row[col] = cols[i] || null));
          return row;
        });

      // Prepare records
      const values =
        type === "numeric"
          ? rows.map((r) => ({
              dataset_id: dataset.id,
              admin_pcode: r[pcodeColumn],
              value: parseFloat(r[valueColumn]) || null,
            }))
          : rows.map((r) => ({
              dataset_id: dataset.id,
              admin_pcode: r[pcodeColumn],
              category: r[categoryColumn] || null,
              value: parseFloat(r[valueColumn]) || null,
            }));

      // Insert data
      const table =
        type === "numeric" ? "dataset_values_numeric" : "dataset_values_categorical";
      const { error: insertError } = await supabase.from(table).insert(values);

      if (insertError) throw insertError;

      onUploaded();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl relative max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Upload New Dataset</h2>
            <p className="text-xs text-gray-500">Upload a CSV file and define metadata and mappings.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm text-gray-700">
          <div>
            <label className="block font-medium mb-1">Dataset File (CSV)</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Collected At</label>
              <input
                type="date"
                value={collectedAt}
                onChange={(e) => setCollectedAt(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">Select type</option>
                <option value="numeric">Numeric</option>
                <option value="categorical">Categorical</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">Select category</option>
                <option value="Core">Core</option>
                <option value="SSC Framework - P1">SSC Framework - P1</option>
                <option value="SSC Framework - P2">SSC Framework - P2</option>
                <option value="SSC Framework - P3">SSC Framework - P3</option>
                <option value="Underlying Vulnerability">Underlying Vulnerability</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Admin Level *</label>
            <select
              value={adminLevel}
              onChange={(e) => setAdminLevel(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="">Select admin level</option>
              <option value="ADM0">ADM0</option>
              <option value="ADM1">ADM1</option>
              <option value="ADM2">ADM2</option>
              <option value="ADM3">ADM3</option>
              <option value="ADM4">ADM4</option>
            </select>
          </div>

          {columns.length > 0 && (
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Column Mapping</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <label className="block font-medium mb-1">Admin PCode Column *</label>
                  <select
                    value={pcodeColumn}
                    onChange={(e) => setPcodeColumn(e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  >
                    <option value="">Select column</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {type === "categorical" && (
                  <div>
                    <label className="block font-medium mb-1">Category Column *</label>
                    <select
                      value={categoryColumn}
                      onChange={(e) => setCategoryColumn(e.target.value)}
                      className="w-full border rounded px-2 py-1"
                    >
                      <option value="">Select column</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-medium mb-1">Value Column *</label>
                  <select
                    value={valueColumn}
                    onChange={(e) => setValueColumn(e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  >
                    <option value="">Select column</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex justify-end mt-4">
            <button
              onClick={handleUpload}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded text-sm"
            >
              {loading ? "Uploading..." : "Upload Dataset"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
