"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface CleanCategoricalDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void> | void;
}

type CategoricalPreviewRow = {
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  category: string | null;
  value_raw: number | null;
  region_code?: string | null;
  province_code?: string | null;
  muni_code?: string | null;
  adm1_pcode_psa_to_namria?: string | null;
  adm2_pcode_psa_to_namria?: string | null;
  adm2_pcode_match?: string | null;
  adm2_name_match?: string | null;
  admin_pcode_clean?: string | null;
  admin_name_clean?: string | null;
  match_status: string;
};

type CountRow = {
  match_status: string;
  count_rows: number;
};

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanCategoricalDatasetModalProps) {
  const [previewRows, setPreviewRows] = useState<CategoricalPreviewRow[]>([]);
  const [counts, setCounts] = useState<CountRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wideFormat, setWideFormat] = useState(true); // default for your building typologies

  const close = () => onOpenChange(false);

  useEffect(() => {
    if (!open) return;
    void loadData();
  }, [open, datasetId, wideFormat]);

  async function loadData() {
    if (!datasetId) return;
    setLoading(true);
    setError(null);

    try {
      // 1) counts for *all* rows
      const { data: countData, error: countErr } = await supabase.rpc<
        CountRow[]
      >("preview_categorical_cleaning_counts", {
        in_dataset: datasetId,
        in_wide_format: wideFormat,
      });

      if (countErr) {
        setError(countErr.message);
      } else {
        setCounts(countData ?? []);
      }

      // 2) preview up to 1,000 rows
      const { data: rowsData, error: rowsErr } = await supabase.rpc<
        CategoricalPreviewRow[]
      >("preview_categorical_cleaning", {
        in_dataset_id: datasetId,
        in_wide_format: wideFormat,
      });

      if (rowsErr) {
        setError((prev) => prev ?? rowsErr.message);
        setPreviewRows([]);
      } else {
        setPreviewRows((rowsData ?? []).slice(0, 1000));
      }
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error while loading preview.");
      setPreviewRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!datasetId) return;
    setApplying(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc(
        "clean_categorical_dataset",
        {
          p_dataset_id: datasetId,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
      } else {
        await onCleaned?.();
        close();
      }
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error while applying cleaning.");
    } finally {
      setApplying(false);
    }
  }

  if (!open) return null;

  const matched =
    counts?.find((c) => c.match_status === "matched")?.count_rows ?? 0;
  const noAdm2 =
    counts?.find((c) => c.match_status === "no_adm2_match")?.count_rows ?? 0;
  const noAdm3Name =
    counts?.find((c) => c.match_status === "no_adm3_name_match")
      ?.count_rows ?? 0;
  const total =
    counts?.reduce((sum, c) => sum + Number(c.count_rows ?? 0), 0) ?? 0;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal max-h-[80vh] w-full max-w-5xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Clean Categorical Dataset — {datasetName}
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Summary */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-800">
                Match quality summary
              </h3>
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>Data layout (wide vs long)</span>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    className="h-3 w-3"
                    checked={wideFormat}
                    onChange={() => setWideFormat(true)}
                  />
                  <span>Wide</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    className="h-3 w-3"
                    checked={!wideFormat}
                    onChange={() => setWideFormat(false)}
                  />
                  <span>Long</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <SummaryCard
                label="Matched ADM3"
                value={matched}
                tone="success"
              />
              <SummaryCard
                label="No ADM2 match"
                value={noAdm2}
                tone="danger"
              />
              <SummaryCard
                label="No ADM3 name match"
                value={noAdm3Name}
                tone="warning"
              />
              <SummaryCard label="Total rows" value={total} tone="neutral" />
            </div>
          </section>

          {/* Preview table */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-800">
                Preview of reshaped categorical values
              </h3>
              {total > 0 && (
                <p className="text-xs text-gray-500">
                  Showing first {Math.min(1000, total)} of {total} rows
                </p>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Raw PCode</Th>
                    <Th>Raw Name</Th>
                    <Th>Category</Th>
                    <Th>Value</Th>
                    <Th>ADM3 PCode</Th>
                    <Th>ADM3 Name</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-4 px-4 text-center text-gray-500"
                      >
                        Loading preview…
                      </td>
                    </tr>
                  ) : previewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-4 px-4 text-center text-gray-500"
                      >
                        No preview rows to display.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, idx) => (
                      <tr
                        key={`${row.admin_pcode_raw ?? ""}-${row.category ?? ""}-${idx}`}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <Td>{row.admin_pcode_raw ?? "—"}</Td>
                        <Td>{row.admin_name_raw ?? "—"}</Td>
                        <Td>{row.category ?? "—"}</Td>
                        <Td>
                          {row.value_raw === null || row.value_raw === undefined
                            ? "—"
                            : row.value_raw}
                        </Td>
                        <Td>{row.admin_pcode_clean ?? "—"}</Td>
                        <Td>{row.admin_name_clean ?? "—"}</Td>
                        <Td className="capitalize">
                          {row.match_status || "—"}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex justify-end gap-3 bg-white">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={close}
            disabled={applying}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApply}
            disabled={applying || loading}
          >
            {applying ? "Applying…" : "Apply Cleaning"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "warning" | "neutral";
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: "bg-green-50 border-green-200 text-green-700",
    danger: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
    neutral: "bg-gray-50 border-gray-200 text-gray-700",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses[tone]}`}>
      <div className="text-xs font-medium">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 whitespace-nowrap text-gray-800">{children}</td>;
}
