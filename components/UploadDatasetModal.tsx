"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabaseClient";

export default function UploadDatasetModal({ onClose, onSuccess }: any) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [datasetType, setDatasetType] = useState<"numeric" | "categorical" | "">("");
  const [mapping, setMapping] = useState<any>({ pcode: "", value: "", category: "" });
  const [metadata, setMetadata] = useState({
    name: "",
    description: "",
    admin_level: "ADM2",
    category: "",
    is_baseline: false,
    is_derived: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        if (!data.length) return setError("CSV appears empty.");
        setHeaders(Object.keys(data[0]));
        setPreview(data.slice(0, 10));
      },
    });
  };

  // Save dataset
  const handleSave = async () => {
    setError(null);
    if (!csvFile || !datasetType || !mapping.pcode) {
      setError("Please complete all required fields before saving.");
      return;
    }
    setLoading(true);
    try {
      const { data: dataset, error: insertError } = await supabase
        .from("datasets")
        .insert({
          name: metadata.name.trim(),
          description: metadata.description.trim(),
          admin_level: metadata.admin_level,
          type: datasetType,
          category: metadata.category || null,
          is_baseline: metadata.is_baseline,
          is_derived: metadata.is_derived,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as any[];
          let formatted: any[] = [];
          if (datasetType === "numeric") {
            formatted = data
              .filter((r) => r[mapping.pcode] && r[mapping.value])
              .map((r) => ({
                dataset_id: dataset.id,
                admin_pcode: String(r[mapping.pcode]),
                value: Number(String(r[mapping.value]).replace(/,/g, "")),
              }));
            if (formatted.length)
              await supabase.from("dataset_values_numeric").insert(formatted);
          } else {
            formatted = data
              .filter((r) => r[mapping.pcode] && r[mapping.category])
              .map((r) => ({
                dataset_id: dataset.id,
                admin_pcode: String(r[mapping.pcode]),
                category: String(r[mapping.category]),
                value: r[mapping.value]
                  ? Number(String(r[mapping.value]).replace(/,/g, ""))
                  : null,
              }));
            if (formatted.length)
              await supabase.from("dataset_values_categorical").insert(formatted);
          }
          setLoading(false);
          onSuccess?.();
          onClose?.();
        },
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-lg">
        <h2 className="text-xl font-serif mb-4">Upload New Dataset</h2>

        {/* File */}
        <input type="file" accept=".csv" onChange={handleFileUpload} className="mb-4" />

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Dataset name"
            value={metadata.name}
            onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
            className="border p-2 rounded"
          />
          <input
            type="text"
            placeholder="Description"
            value={metadata.description}
            onChange={(e) =>
              setMetadata({ ...metadata, description: e.target.value })
            }
            className="border p-2 rounded"
          />
          <select
            value={metadata.admin_level}
            onChange={(e) =>
              setMetadata({ ...metadata, admin_level: e.target.value })
            }
            className="border p-2 rounded"
          >
            <option value="ADM0">Admin Level 0 (National)</option>
            <option value="ADM1">Admin Level 1 (Region)</option>
            <option value="ADM2">Admin Level 2 (Province)</option>
            <option value="ADM3">Admin Level 3 (Municipality)</option>
            <option value="ADM4">Admin Level 4 (Barangay)</option>
            <option value="ADM5">Admin Level 5 (Sitio / Locality)</option>
          </select>
          <select
            value={metadata.category}
            onChange={(e) =>
              setMetadata({ ...metadata, category: e.target.value })
            }
            className="border p-2 rounded"
          >
            <option value="">Select category</option>
            <option value="SSC Framework - P1">SSC Framework – P1</option>
            <option value="SSC Framework - P2">SSC Framework – P2</option>
            <option value="SSC Framework - P3">SSC Framework – P3</option>
            <option value="Hazard">Hazard</option>
            <option value="Underlying Vulnerability">Underlying Vulnerability</option>
          </select>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={metadata.is_baseline}
              onChange={(e) =>
                setMetadata({ ...metadata, is_baseline: e.target.checked })
              }
            />
            <span>Baseline Dataset</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={metadata.is_derived}
              onChange={(e) =>
                setMetadata({ ...metadata, is_derived: e.target.checked })
              }
            />
            <span>Derived Dataset</span>
          </label>
        </div>

        {/* Column Mapping */}
        {headers.length > 0 && (
          <>
            <h3 className="font-semibold mb-2">Map CSV Columns</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {["pcode", "value", "category"].map((key) => (
                <div key={key}>
                  <label className="block text-sm capitalize">
                    {key === "pcode"
                      ? "Admin Pcode"
                      : key === "value"
                      ? "Value Column (numeric)"
                      : "Category Column (if categorical)"}
                  </label>
                  <select
                    value={mapping[key]}
                    onChange={(e) =>
                      setMapping({ ...mapping, [key]: e.target.value })
                    }
                    className="border p-2 rounded w-full"
                  >
                    <option value="">Select column</option>
                    {headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="mr-4">
                <input
                  type="radio"
                  name="type"
                  value="numeric"
                  checked={datasetType === "numeric"}
                  onChange={() => setDatasetType("numeric")}
                />{" "}
                Numeric dataset
              </label>
              <label className="ml-4">
                <input
                  type="radio"
                  name="type"
                  value="categorical"
                  checked={datasetType === "categorical"}
                  onChange={() => setDatasetType("categorical")}
                />{" "}
                Categorical dataset
              </label>
            </div>

            <div className="border rounded max-h-64 overflow-y-auto text-sm">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="border p-1">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {headers.map((h) => (
                        <td key={h} className="border p-1">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end mt-4 space-x-2">
          <button onClick={onClose} className="px-3 py-1 border rounded hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {loading ? "Saving..." : "Save Dataset"}
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    </div>
  );
}
