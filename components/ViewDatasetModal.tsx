"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

interface ViewDatasetModalProps {
  dataset: any;
  onClose: () => void;
}

interface DatasetRow {
  admin_pcode: string;
  value?: number | string | null;
  category?: string | null;
}

export default function ViewDatasetModal({ dataset, onClose }: ViewDatasetModalProps) {
  const supabase = createClient();

  const [data, setData] = useState<DatasetRow[]>([]);
  const [adminMap, setAdminMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"admin_pcode" | "admin_name" | "value">("admin_pcode");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!dataset) return;

      try {
        setLoading(true);
        setError(null);

        // 1. Load admin boundaries for name lookups
        const { data: boundaries, error: boundariesError } = await supabase
          .from("admin_boundaries")
          .select("admin_pcode, name");

        if (boundariesError) throw boundariesError;

        const map: Record<string, string> = {};
        boundaries?.forEach((b) => {
          map[b.admin_pcode] = b.name;
        });
        setAdminMap(map);

        // 2. Load dataset values
        const table =
          dataset.type === "numeric"
            ? "dataset_values_numeric"
            : "dataset_values_categorical";

        const { data: datasetValues, error: datasetError } = await supabase
          .from(table)
          .select("*")
          .eq("dataset_id", dataset.id)
          .limit(1000);

        if (datasetError) throw datasetError;

        setData(datasetValues || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error loading dataset.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataset, supabase]);

  const resolveAdminName = (pcode: string): string => {
    if (!pcode) return "—";
    if (adminMap[pcode]) return adminMap[pcode];

    // Try truncated versions (for adm roll-ups)
    for (let i = pcode.length; i >= 2; i--) {
      const prefix = pcode.slice(0, i);
      if (adminMap[prefix]) return adminMap[prefix];
    }

    // Try padded versions (for shorter pcodes)
    for (let i = pcode.length; i <= 11; i++) {
      const padded = pcode.padEnd(i, "0");
      if (adminMap[padded]) return adminMap[padded];
    }

    return "—";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  const sortData = (key: "admin_pcode" | "admin_name" | "value") => {
    const newAsc = sortKey === key ? !sortAsc : true;
    setSortKey(key);
    setSortAsc(newAsc);

    setData((prev) => {
      const sorted = [...prev].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (key === "admin_name") {
          aVal = resolveAdminName(a.admin_pcode);
          bVal = resolveAdminName(b.admin_pcode);
        } else {
          aVal = (a as any)[key];
          bVal = (b as any)[key];
        }

        if (aVal < bVal) return newAsc ? -1 : 1;
        if (aVal > bVal) return newAsc ? 1 : -1;
        return 0;
      });
      return sorted;
    });
  };

  if (!dataset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 my-8 relative flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-2xl font-light"
        >
          ×
        </button>

        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">{dataset.name}</h2>
          <p className="text-xs text-gray-500 mt-1">{dataset.description || "—"}</p>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 px-6 py-3 border-b bg-gray-50">
          <div><strong>Type:</strong> {dataset.type || "—"}</div>
          <div><strong>Category:</strong> {dataset.category || "—"}</div>
          <div><strong>Admin Level:</strong> {dataset.admin_level || "—"}</div>
          <div><strong>Collected At:</strong> {formatDate(dataset.collected_at)}</div>
          <div><strong>Source:</strong> {dataset.metadata?.source || "—"}</div>
          <div><strong>Created:</strong> {formatDate(dataset.created_at)}</div>
        </div>

        {/* Dataset Table */}
        <div className="flex-1 overflow-y-auto max-h-[70vh] p-4">
          {loading ? (
            <p className="text-gray-500 text-sm text-center mt-10">Loading data...</p>
          ) : error ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : data.length === 0 ? (
            <p className="text-gray-500 text-sm text-center mt-10">No data found.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="min-w-full text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th
                      className="text-left p-2 border cursor-pointer select-none"
                      onClick={() => sortData("admin_pcode")}
                    >
                      Admin PCode {sortKey === "admin_pcode" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th
                      className="text-left p-2 border cursor-pointer select-none"
                      onClick={() => sortData("admin_name")}
                    >
                      Admin Name {sortKey === "admin_name" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    {dataset.type === "categorical" && (
                      <th className="text-left p-2 border">Category</th>
                    )}
                    <th
                      className="text-left p-2 border cursor-pointer select-none"
                      onClick={() => sortData("value")}
                    >
                      Value {sortKey === "value" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="p-2 border font-mono text-[11px]">{row.admin_pcode}</td>
                      <td className="p-2 border text-[11px]">
                        {resolveAdminName(row.admin_pcode)}
                      </td>
                      {dataset.type === "categorical" && (
                        <td className="p-2 border text-[11px]">
                          {row.category || "—"}
                        </td>
                      )}
                      <td className="p-2 border text-[11px] text-right">
                        {row.value ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-sm bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
