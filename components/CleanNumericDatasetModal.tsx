"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface NumericModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

type NumericPreviewRow = {
  raw_admin_pcode: string | null;
  raw_admin_name: string | null;
  raw_value: number | null;
  adm3_pcode: string | null;
  adm3_name: string | null;
  match_status: string | null;
};

type NumericCountRow = {
  match_status: string | null;
  count_rows: number | null;
};

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: NumericModalProps) {
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<NumericPreviewRow[]>([]);
  const [counts, setCounts] = useState<NumericCountRow[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) summary counts (all rows)
        const { data: countData, error: countErr } = await supabase.rpc(
          "preview_numeric_cleaning_v2_counts",
          { in_dataset: datasetId }
        );

        if (countErr) throw countErr;

        const normalizedCounts = (countData || []) as NumericCountRow[];
        if (!cancelled) setCounts(normalizedCounts);

        // 2) preview rows (limit to 1000 client-side)
        const { data: previewData, error: previewErr } = await supabase.rpc(
          "preview_numeric_cleaning_v2",
          { in_dataset: datasetId }
        );

        if (previewErr) throw previewErr;

        const previewRows = ((previewData || []) as NumericPreviewRow[]).slice(
          0,
          1000
        );

        if (!cancelled) setRows(previewRows);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Error loading numeric preview:", err);
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
  }, [open, datasetId]);

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
      const { error: rpcErr } = await supabase.rpc("clean_numeric_dataset", {
        in_dataset: datasetId,
      });
      if (rpcErr) throw rpcErr;

      await onCleaned();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error applying numeric cleaning:", err);
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
            Clean Numeric Dataset — {datasetName}
          </h2>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="Matched" value={matched} tone="good" />
        <SummaryCard label="No ADM2 match" value={noAdm2} tone="bad" />
        <SummaryCard label="No ADM3 name match" value={noAdm3} tone="warn" />
        <SummaryCard label="Total rows" value={total} tone="neutral" />
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-white">
        <div className="min-w-full">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                  <Td colSpan={6}>Loading preview…</Td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <Td colSpan={6}>No preview rows to display.</Td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={`${row.raw_admin_pcode}-${idx}`}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <Td>{row.raw_admin_pcode || "—"}</Td>
                    <Td>{row.raw_admin_name || "—"}</Td>
                    <Td>
                      {typeof row.raw_value === "number"
                        ? row.raw_value
                        : "—"}
                    </Td>
                    <Td>{row.adm3_pcode || "—"}</Td>
                    <Td>{row.adm3_name || "—"}</Td>
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
      <div className="relative z-10 w-[min(100vw-2rem, 960px)] max-h-[85vh] bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col p-5">
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
