"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void> | void;
}

type NumericPreviewRow = {
  // RPC can return either raw_admin_* or admin_*_raw – support both
  raw_admin_pcode?: string | null;
  raw_admin_name?: string | null;
  raw_value?: number | null;
  admin_pcode_raw?: string | null;
  admin_name_raw?: string | null;
  value_raw?: number | null;

  region_code?: string | null;
  province_code?: string | null;
  muni_code?: string | null;

  adm2_guess?: string | null;
  adm2_name_match?: string | null;

  adm3_pcode?: string | null;
  adm3_name?: string | null;
  admin_pcode_clean?: string | null;
  admin_name_clean?: string | null;

  match_status: string;
};

type CountRow = {
  match_status: string;
  count_rows: number;
};

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const [previewRows, setPreviewRows] = useState<NumericPreviewRow[]>([]);
  const [counts, setCounts] = useState<CountRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => onOpenChange(false);

  useEffect(() => {
    if (!open) return;
    void loadData();
  }, [open, datasetId]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      // 1) counts (full dataset)
      const {
        data: countData,
        error: countErr,
      } = await supabase.rpc("preview_numeric_cleaning_v2_counts", {
        in_dataset: datasetId,
      });

      if (countErr) {
        setError(countErr.message);
      } else {
        setCounts((countData as CountRow[] | null) ?? []);
      }

      // 2) preview up to 1,000 rows on the client side
      const {
        data: rowsData,
        error: rowsErr,
      } = await supabase.rpc("preview_numeric_cleaning_v2", {
        in_dataset: datasetId,
      });

      if (rowsErr) {
        setError((prev) => prev ?? rowsErr.message);
        setPreviewRows([]);
      } else {
        const rows = (rowsData as NumericPreviewRow[] | null) ?? [];
        setPreviewRows(rows.slice(0, 1000));
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
      const { error: rpcError } = await supabase.rpc("clean_numeric_dataset", {
        in_dataset: datasetId,
      });

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
            Clean Numeric Dataset — {datasetName}
          </h2>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Summary */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-gray-800">
              Match quality summary
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <SummaryCard
                label="Matched"
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
                Preview of cleaned rows
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
                        colSpan={6}
                        className="py-4 px-4 text-center text-gray-500"
                      >
                        Loading preview…
                      </td>
                    </tr>
                  ) : previewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-4 px-4 text-center text-gray-500"
                      >
                        No preview rows to display.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, idx) => {
                      const rawPcode =
                        row.raw_admin_pcode ?? row.admin_pcode_raw ?? "";
                      const rawName =
                        row.raw_admin_name ?? row.admin_name_raw ?? "";
                      const value =
                        (row.raw_value ??
                          row.value_raw ??
                          null) as number | null;
                      const adm3Pcode =
                        row.adm3_pcode ?? row.admin_pcode_clean ?? "";
                      const adm3Name =
                        row.adm3_name ?? row.admin_name_clean ?? "";
                      return (
                        <tr
                          key={idx}
                          className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <Td>{rawPcode}</Td>
                          <Td>{rawName}</Td>
                          <Td>
                            {value === null || value === undefined
                              ? "—"
                              : value}
                          </Td>
                          <Td>{adm3Pcode || "—"}</Td>
                          <Td>{adm3Name || "—"}</Td>
                          <Td className="capitalize">
                            {row.match_status || "—"}
                          </Td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Footer (non-sticky, at bottom of modal) */}
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
