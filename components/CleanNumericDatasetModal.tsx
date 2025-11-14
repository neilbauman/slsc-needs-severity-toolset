"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";

interface NumericPreviewRow {
  raw_admin_pcode: string;
  raw_admin_name: string;
  raw_value: number | null;
  adm3_pcode: string | null;
  adm3_name: string | null;
  match_status: string;
}

interface SummaryCounts {
  matched: number;
  no_adm2_match: number;
  no_adm3_name_match: number;
  total: number;
}

interface Props {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned
}: Props) {
  const [summary, setSummary] = useState<SummaryCounts | null>(null);
  const [rows, setRows] = useState<NumericPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadPreview();
  }, [open]);

  async function loadPreview() {
    setLoading(true);

    // Summary counts
    const { data: counts } = await supabase.rpc(
      "preview_numeric_cleaning_v2_counts",
      { in_dataset: datasetId }
    );

    if (counts && Array.isArray(counts)) {
      const sum: SummaryCounts = {
        matched: 0,
        no_adm2_match: 0,
        no_adm3_name_match: 0,
        total: 0
      };
      for (const c of counts) {
        if (c.match_status === "matched") sum.matched = c.count_rows;
        if (c.match_status === "no_adm2_match") sum.no_adm2_match = c.count_rows;
        if (c.match_status === "no_adm3_name_match")
          sum.no_adm3_name_match = c.count_rows;
        sum.total += Number(c.count_rows);
      }
      setSummary(sum);
    }

    // Preview rows
    const { data: preview } = await supabase.rpc(
      "preview_numeric_cleaning_v2",
      { in_dataset: datasetId }
    );

    setRows(preview ?? []);
    setLoading(false);
  }

  async function applyCleaning() {
    await supabase.rpc("clean_numeric_dataset", {
      in_dataset: datasetId
    });
    await onCleaned();
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={() => onOpenChange(false)} />

      <div className="modal p-0 flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            Clean Numeric Dataset — {datasetName}
          </h2>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="overflow-y-auto max-h-[70vh] p-6">
          {/* SUMMARY */}
          {summary && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-green-50 border text-center">
                <div className="font-semibold">Matched</div>
                <div className="text-2xl" style={{ color: "var(--gsc-green)" }}>
                  {summary.matched}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border text-center">
                <div className="font-semibold">No ADM2 match</div>
                <div className="text-2xl" style={{ color: "var(--gsc-red)" }}>
                  {summary.no_adm2_match}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-yellow-50 border text-center">
                <div className="font-semibold">No ADM3 name match</div>
                <div className="text-2xl" style={{ color: "var(--gsc-orange)" }}>
                  {summary.no_adm3_name_match}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border text-center">
                <div className="font-semibold">Total rows</div>
                <div className="text-2xl">{summary.total}</div>
              </div>
            </div>
          )}

          {/* TABLE */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-2 text-left">Raw PCode</th>
                  <th className="p-2 text-left">Raw Name</th>
                  <th className="p-2 text-left">Value</th>
                  <th className="p-2 text-left">ADM3 PCode</th>
                  <th className="p-2 text-left">ADM3 Name</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{r.raw_admin_pcode}</td>
                    <td className="p-2">{r.raw_admin_name}</td>
                    <td className="p-2">{r.raw_value ?? ""}</td>
                    <td className="p-2">{r.adm3_pcode ?? "—"}</td>
                    <td className="p-2">{r.adm3_name ?? "—"}</td>
                    <td className="p-2">{r.match_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* STICKY FOOTER */}
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
