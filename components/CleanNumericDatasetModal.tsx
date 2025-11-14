"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadPreview();
  }, [open]);

  async function loadPreview() {
    setLoading(true);
    const { data } = await supabase.rpc("preview_numeric_cleaning_v2", {
      in_dataset: datasetId,
    });
    setRows(data ?? []);
    setLoading(false);
  }

  async function runClean() {
    setLoading(true);
    await supabase.rpc("clean_numeric_dataset", { in_dataset: datasetId });
    setLoading(false);
    await onCleaned();
    onOpenChange(false);
  }

  if (!open) return null;

  const matched = rows.filter((r) => r.match_status === "matched").length;
  const noAdm2 = rows.filter((r) => r.match_status === "no_adm2_match").length;
  const noAdm3 = rows.filter((r) => r.match_status === "no_adm3_name_match").length;

  return (
    <>
      <div className="modal-backdrop" onClick={() => onOpenChange(false)} />
      <div className="modal p-6 max-h-[90vh] overflow-y-auto">

        {/* HEADER */}
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Clean Numeric Dataset — {datasetName}
          </h2>
          <button onClick={() => onOpenChange(false)}>✕</button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4 bg-green-50">
            <div className="text-sm font-medium" style={{ color: "var(--gsc-green)" }}>
              Matched ADM3
            </div>
            <div className="text-2xl font-semibold">{matched}</div>
          </div>
          <div className="card p-4 bg-red-50">
            <div className="text-sm font-medium" style={{ color: "var(--gsc-red)" }}>
              No ADM2 match
            </div>
            <div className="text-2xl font-semibold">{noAdm2}</div>
          </div>
          <div className="card p-4 bg-orange-50">
            <div className="text-sm font-medium" style={{ color: "var(--gsc-orange)" }}>
              No ADM3 name match
            </div>
            <div className="text-2xl font-semibold">{noAdm3}</div>
          </div>
        </div>

        {/* PREVIEW TABLE */}
        <div className="card p-4 mb-6">
          <h3 className="font-semibold mb-2">Preview (first rows)</h3>
          <div className="overflow-auto max-h-[50vh]">
            {rows.length === 0 ? (
              <p>No rows.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    {Object.keys(rows[0]).map((col) => (
                      <th key={col} className="px-2 py-1 border-b text-left bg-gray-100">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b">
                      {Object.keys(rows[0]).map((col) => (
                        <td key={col} className="px-2 py-1">
                          {r[col] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3">
          <button className="btn btn-secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={runClean} disabled={loading}>
            {loading ? "Cleaning…" : "Run cleaning & save"}
          </button>
        </div>
      </div>
    </>
  );
}
