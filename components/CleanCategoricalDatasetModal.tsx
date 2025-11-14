"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: Props) {
  const [counts, setCounts] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadPreview() {
    setLoading(true);

    const { data: countsData } = await supabase.rpc(
      "preview_categorical_cleaning_counts",
      { in_dataset: datasetId }
    );

    const { data: rowsData } = await supabase.rpc(
      "preview_categorical_cleaning",
      { in_dataset: datasetId, in_wide_format: true }
    );

    setCounts(countsData ?? null);
    setRows(rowsData ?? []);
    setLoading(false);
  }

  async function applyCleaning() {
    await supabase.rpc("clean_categorical_dataset", {
      p_dataset_id: datasetId,
    });
    await onCleaned();
    onOpenChange(false);
  }

  useEffect(() => {
    if (open) loadPreview();
  }, [open]);

  if (!open) return null;

  const total = counts?.reduce((a: number, r: any) => a + (r.count_rows || 0), 0) ?? 0;
  const matched = counts?.find((r: any) => r.match_status === "matched")?.count_rows ?? 0;
  const noAdm2 = counts?.find((r: any) => r.match_status === "no_adm2_match")?.count_rows ?? 0;
  const noAdm3 = counts?.find((r: any) => r.match_status === "no_adm3_name_match")?.count_rows ?? 0;

  return (
    <>
      <div className="modal-backdrop" onClick={() => onOpenChange(false)} />

      <div className="modal p-0 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            Clean Categorical Dataset — {datasetName}
          </h2>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-4 space-y-4 max-h-[70vh]">

          {/* Summary */}
          <div className="card p-4">
            <h3 className="font-medium mb-3">Match quality summary</h3>

            {counts === null ? (
              <div className="text-red-600">Failed to load preview.</div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                <SummaryBox label="Matched ADM3" value={matched} color="var(--gsc-green)" />
                <SummaryBox label="No ADM2 match" value={noAdm2} color="var(--gsc-red)" />
                <SummaryBox label="No ADM3 name match" value={noAdm3} color="var(--gsc-orange)" />
                <SummaryBox label="Total rows" value={total} color="var(--gsc-blue)" />
              </div>
            )}
          </div>

          {/* Rows */}
          <div className="card p-4">
            <h3 className="font-medium mb-3">Preview of reshaped categorical values</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1 text-left">Raw PCode</th>
                    <th className="px-2 py-1 text-left">Raw Name</th>
                    <th className="px-2 py-1 text-left">Category</th>
                    <th className="px-2 py-1 text-left">Value</th>
                    <th className="px-2 py-1 text-left">ADM3 PCode</th>
                    <th className="px-2 py-1 text-left">ADM3 Name</th>
                    <th className="px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-2 py-1">{r.admin_pcode_raw}</td>
                      <td className="px-2 py-1">{r.admin_name_raw}</td>
                      <td className="px-2 py-1">{r.category}</td>
                      <td className="px-2 py-1">{r.raw_value}</td>
                      <td className="px-2 py-1">{r.admin_pcode_clean}</td>
                      <td className="px-2 py-1">{r.admin_name_clean}</td>
                      <td className="px-2 py-1">{r.match_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Sticky footer */}
        <div className="flex justify-end gap-3 border-t bg-white p-4 sticky bottom-0">
          <button className="btn btn-secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={applyCleaning}>
            Apply Cleaning
          </button>
        </div>
      </div>
    </>
  );
}

function SummaryBox({ label, value, color }: any) {
  return (
    <div className="card p-3 text-center">
      <div className="text-sm">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
