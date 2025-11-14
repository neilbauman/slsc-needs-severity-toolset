"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface CategoricalModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

type CategoricalPreviewRow = {
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  category: string | null;
  value_raw: number | null;
  admin_pcode_clean: string | null;
  admin_name_clean: string | null;
  match_status: string | null;
};

type CategoricalCountRow = {
  match_status: string | null;
  count_rows: number | null;
};

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CategoricalModalProps) {
  const [wideFormat, setWideFormat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CategoricalPreviewRow[]>([]);
  const [counts, setCounts] = useState<CategoricalCountRow[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) counts for all rows
        const { data: countData, error: countErr } = await supabase.rpc(
          "preview_categorical_cleaning_counts",
          {
            in_dataset: datasetId,
            in_wide_format: wideFormat,
          }
        );

        if (countErr) throw countErr;

        const normalizedCounts = (countData || []) as CategoricalCountRow[];
        if (!cancelled) setCounts(normalizedCounts);

        // 2) preview rows (slice to 1000 client-side)
        const { data: previewData, error: previewErr } = await supabase.rpc(
          "preview_categorical_cleaning",
          {
            in_dataset_id: datasetId,
            in_wide_format: wideFormat,
          }
        );

        if (previewErr) throw previewErr;

        const previewRows = ((previewData || []) as CategoricalPreviewRow[])
          .slice(0, 1000);

        if (!cancelled) setRows(previewRows);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Error loading categorical preview:", err);
          setError(err.message || "Failed to load preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, datasetId, wideFormat]);

  if (!open) return null;

  const matched =
    counts.find((c) => c.match_status === "matched")?.count_rows ?? 0;
  const noAdm2 =
    counts.find((c) => c.match_status === "no_adm2_match")?.count_rows ?? 0;
  const noAdm3 =
    counts.find((c) => c.match_status === "no_adm3_name_match")?.count_rows ??
    0;
  const total = counts.reduce(
    (sum, c) => sum + Number(c.count_rows ?? 0),
    0
  );

  async function handleApply() {
    setApplyLoading(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc(
        "clean_categorical_dataset",
        { p_dataset_id: datasetId }
      );
      if (rpcErr) throw rpcErr;

      await onCleaned();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error applying categorical cleaning:", err);
      setError(err.message || "Failed to apply cleaning.");
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <ModalShell onClose={() => onOpenChange(false)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">
            Clean Categorical Dataset — {datasetName}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Reshapes raw categorical rows into long format and matches PSA
            ADM3 codes to NAMRIA boundaries.
          </p>
        </div>

        {/* Layout toggle: Wide vs Long */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-600">Layout:</span>
          <button
            type="button"
            className={`px-2 py-1 rounded border text-xs ${
              wideFormat ? "bg-gray-100 border-gray-400" : "bg-white border-gray-200"
            }`}
            onClick={() => setWideFormat(true)}
            disabled={loading}
          >
            Treat as wide
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded border text-xs ${
              !wideFormat ? "bg-gray-100 border-gray-400" : "bg-white border-gray-200"
            }`}
            onClick={() => setWideFormat(false)}
            disabled={loading}
          >
            Treat as long
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="Matched ADM3" value={matched} tone="good" />
        <SummaryCard label="No ADM2 match" value={noAdm2} tone="bad" />
        <SummaryCard
          label="No ADM3 name match"
          value={noAdm3}
          tone="warn"
        />
        <SummaryCard label="Total rows" value={total} tone="neutral" />
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Scrollable preview */}
      <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-white">
        <div className="min-w-full">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                  <Td colSpan={7}>Loading preview…</Td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <Td colSpan={7}>No preview rows to display.</Td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={`${row.admin_pcode_raw}-${row.category}-${idx}`}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <Td>{row.admin_pcode_raw || "—"}</Td>
                    <Td>{row.admin_name_raw || "—"}</Td>
                    <Td>{row.category || "—"}</Td>
                    <Td>
                      {typeof row.value_raw === "number"
                        ? row.value_raw
                        : "—"}
                    </Td>
                    <Td>{row.admin_pcode_clean || "—"}</Td>
                    <Td>{row.admin_name_clean || "—"}</Td>
                    <Td className="capitalize">
                      {row.match_status || "—"}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onOpenChange(false)}
          disabled={applyLoading}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleApply}
          disabled={applyLoading || loading}
        >
          {applyLoading ? "Applying…" : "Apply Cleaning"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative z-10 w-[min(100vw-2rem, 1100px)] max-h-[85vh] bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col p-5">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2 text-left text-xs font-semibold text-gray-700 ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
  className = "",
}: {
  children: React.ReactNode;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-4 py-2 whitespace-nowrap text-gray-800 ${className}`}
    >
      {children}
    </td>
  );
}
