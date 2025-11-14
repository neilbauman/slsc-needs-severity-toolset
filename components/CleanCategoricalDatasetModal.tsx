"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

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
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<
    { match_status: string; count_rows: number }[]
  >([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const close = () => onOpenChange(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    // summary
    const { data: summaryData, error: sumErr } = await supabase.rpc(
      "preview_categorical_cleaning_counts",
      { in_dataset: datasetId }
    );

    if (sumErr) {
      setError(sumErr.message);
      setLoading(false);
      return;
    }
    setSummary(summaryData || []);

    // preview rows
    const { data: rows, error: prevErr } = await supabase.rpc(
      "preview_categorical_cleaning",
      { in_dataset: datasetId, in_wide_format: true }
    );

    if (prevErr) {
      setError(prevErr.message);
      setLoading(false);
      return;
    }

    setPreview(rows || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const applyCleaning = async () => {
    setLoading(true);
    const { error: cleanErr } = await supabase.rpc(
      "clean_categorical_dataset",
      { in_dataset: datasetId }
    );
    setLoading(false);
    if (cleanErr) {
      setError(cleanErr.message);
      return;
    }
    await onCleaned();
    close();
  };

  if (!open) return null;

  const total = summary.reduce((s, x) => s + Number(x.count_rows), 0);
  const matched =
    summary.find((x) => x.match_status === "matched")?.count_rows || 0;
  const noAdm2 =
    summary.find((x) => x.match_status === "no_adm2_match")?.count_rows || 0;
  const noAdm3 =
    summary.find((x) => x.match_status === "no_adm3_name_match")
      ?.count_rows || 0;

  return (
    <>
      <div className="modal-backdrop" onClick={close} />
      <div className="modal p-6 space-y-6 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Clean Categorical Dataset — {datasetName}
          </h2>
          <button onClick={close} className="text-gray-500 hover:opacity-70">
            ✕
          </button>
        </div>

        {/* Summary Panel */}
        <div className="card p-4">
          <h3 className="font-medium mb-2">Match quality summary</h3>

          {error && (
            <div className="p-3 bg-red-100 text-red-800 rounded mb-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <div className="text-sm text-gray-600">Matched ADM3</div>
              <div className="text-xl font-semibold text-green-700">
                {matched}
              </div>
            </div>

            <div className="p-3 bg-red-50 rounded border border-red-200">
              <div className="text-sm text-gray-600">No ADM2 match</div>
              <div className="text-xl font-semibold text-red-700">{noAdm2}</div>
            </div>

            <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
              <div className="text-sm text-gray-600">No ADM3 name match</div>
              <div className="text-xl font-semibold text-yellow-700">
                {noAdm3}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className="text-sm text-gray-600">Total rows</div>
              <div className="text-xl font-semibold text-gray-800">{total}</div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <h3 className="font-medium mb-2">
            Preview of reshaped categorical values
          </h3>

          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 text-left">Raw PCode</th>
                  <th className="p-2 text-left">Raw Name</th>
                  <th className="p-2 text-left">Category</th>
                  <th className="p-2 text-left">Value</th>
                  <th className="p-2 text-left">ADM3 PCode</th>
                  <th className="p-2 text-left">ADM3 Name</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>

              <tbody>
                {preview.slice(0, 1000).map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{row.admin_pcode_raw}</td>
                    <td className="p-2">{row.admin_name_raw}</td>
                    <td className="p-2">{row.category}</td>
                    <td className="p-2">{row.value_raw}</td>
                    <td className="p-2">{row.admin_pcode_clean || "—"}</td>
                    <td className="p-2">{row.admin_name_clean || "—"}</td>
                    <td className="p-2">{row.match_status}</td>
                  </tr>
                ))}
                {preview.length === 0 && (
                  <tr>
                    <td className="p-2" colSpan={7}>
                      No preview rows to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <button className="btn btn-secondary" onClick={close}>
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
