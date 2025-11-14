"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

interface CategoricalCountRow {
  match_status: string | null;
  count_rows: number | null;
}

interface CategoricalPreviewRow {
  dataset_id: string | null;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  category: string | null;
  raw_value: number | null;
  region_code: string | null;
  province_code: string | null;
  muni_code: string | null;
  adm1_pcode_psa_to_namria: string | null;
  adm2_pcode_psa_to_namria: string | null;
  adm2_pcode_match: string | null;
  adm2_name_match: string | null;
  admin_pcode_clean: string | null;
  admin_name_clean: string | null;
  match_status: string | null;
}

export default function CleanCategoricalDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [counts, setCounts] = useState<CategoricalCountRow[]>([]);
  const [rows, setRows] = useState<CategoricalPreviewRow[]>([]);

  // For now: these datasets are wide (`__ssc_shape = "wide"`)
  // If you later support long format, we can add a toggle.
  const wideFormat = true;

  const close = () => onOpenChange(false);

  useEffect(() => {
    if (!open) return;
    void loadPreview();
  }, [open, datasetId]);

  async function loadPreview() {
    setLoading(true);
    setError(null);

    try {
      // 1) Counts for all rows (no 1000 limit)
      const { data: countData, error: countErr } =
        await supabase.rpc("preview_categorical_cleaning_counts", {
          in_dataset: datasetId,
          in_wide_format: wideFormat,
        });

      if (countErr) {
        throw countErr;
      }
      setCounts((countData || []) as CategoricalCountRow[]);

      // 2) Detailed sample (we’ll render up to 1000)
      const { data: previewData, error: previewErr } =
        await supabase.rpc("preview_categorical_cleaning", {
          in_dataset: datasetId,
          in_wide_format: wideFormat,
        });

      if (previewErr) {
        throw previewErr;
      }
      setRows((previewData || []) as CategoricalPreviewRow[]);
    } catch (e: any) {
      console.error("loadPreview categorical error", e);
      setError(e?.message ?? "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
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
        throw rpcError;
      }

      await onCleaned();
      close();
    } catch (e: any) {
      console.error("apply categorical cleaning error", e);
      setError(e?.message ?? "Failed to apply cleaning");
    } finally {
      setApplying(false);
    }
  }

  if (!open) return null;

  const totalRows = counts.reduce(
    (sum, c) => sum + (c.count_rows ?? 0),
    0
  );
  const matched =
    counts.find((c) => c.match_status === "matched")?.count_rows ?? 0;
  const noAdm2 =
    counts.find((c) => c.match_status === "no_adm2_match")?.count_rows ??
    0;
  const noAdm3 =
    counts.find((c) => c.match_status === "no_adm3_name_match")
      ?.count_rows ?? 0;

  const limitedRows = rows.slice(0, 1000);

  return (
    <>
      <div className="modal-backdrop" onClick={close} />
      <div className="modal flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Clean categorical dataset
            </h2>
            <p className="text-sm text-gray-600">
              {datasetName} ({datasetId})
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <SummaryBox
              label="Total rows"
              value={totalRows}
              tone="neutral"
            />
            <SummaryBox
              label="Matched ADM3"
              value={matched}
              tone="good"
            />
            <SummaryBox
              label="No ADM2 match"
              value={noAdm2}
              tone="bad"
            />
            <SummaryBox
              label="No ADM3 name match"
              value={noAdm3}
              tone="warn"
            />
          </div>

          {loading && (
            <div className="text-sm text-gray-600">
              Loading preview…
            </div>
          )}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Preview table */}
          {!loading && !error && limitedRows.length > 0 && (
            <div className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">
                  Sample of cleaned mapping (showing up to 1000 rows)
                </h3>
                <p className="text-xs text-gray-500">
                  Wide-format building typologies expanded to category rows.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Raw ADM3 PSA pcode</Th>
                      <Th>Raw name</Th>
                      <Th>Category</Th>
                      <Th className="text-right">Raw value</Th>
                      <Th>Region</Th>
                      <Th>Province</Th>
                      <Th>Municipality</Th>
                      <Th>NAMRIA ADM2 pcode</Th>
                      <Th>NAMRIA ADM2 name</Th>
                      <Th>NAMRIA ADM3 pcode</Th>
                      <Th>NAMRIA ADM3 name</Th>
                      <Th>Match status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitedRows.map((row, idx) => (
                      <tr
                        key={`${row.admin_pcode_raw ?? "row"}-${
                          row.category ?? "cat"
                        }-${idx}`}
                        className={
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }
                      >
                        <Td>{row.admin_pcode_raw ?? "—"}</Td>
                        <Td>{row.admin_name_raw ?? "—"}</Td>
                        <Td>{row.category ?? "—"}</Td>
                        <Td className="text-right">
                          {row.raw_value ?? "—"}
                        </Td>
                        <Td>{row.region_code ?? "—"}</Td>
                        <Td>{row.province_code ?? "—"}</Td>
                        <Td>{row.muni_code ?? "—"}</Td>
                        <Td>{row.adm2_pcode_psa_to_namria ?? "—"}</Td>
                        <Td>{row.adm2_name_match ?? "—"}</Td>
                        <Td>{row.admin_pcode_clean ?? "—"}</Td>
                        <Td>{row.admin_name_clean ?? "—"}</Td>
                        <Td className="capitalize">
                          {row.match_status ?? "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 1000 && (
                <p className="mt-2 text-xs text-gray-500">
                  Showing first 1000 rows of {rows.length} total.
                </p>
              )}
            </div>
          )}

          {!loading && !error && limitedRows.length === 0 && (
            <div className="text-sm text-gray-600">
              No preview rows found for this dataset.
            </div>
          )}
        </div>

        {/* Footer (fixed to bottom of modal) */}
        <div className="border-t px-4 py-3 bg-white flex items-center justify-between">
          <p className="text-xs text-gray-600">
            This will overwrite existing cleaned categorical values for
            this dataset.
          </p>
          <div className="flex gap-2">
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
              {applying ? "Applying…" : "Apply & save cleaned dataset"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Shared small helpers

function SummaryBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "bad" | "warn" | "neutral";
}) {
  let bg = "bg-white";
  let border = "border-gray-200";
  if (tone === "good") {
    bg = "bg-green-50";
    border = "border-green-200";
  } else if (tone === "bad") {
    bg = "bg-red-50";
    border = "border-red-200";
  } else if (tone === "warn") {
    bg = "bg-yellow-50";
    border = "border-yellow-200";
  }

  return (
    <div className={`card px-3 py-2 border ${bg} ${border}`}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
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
      className={
        "px-2 py-1 text-left text-[11px] font-semibold text-gray-700 " +
        className
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={"px-2 py-1 align-top text-[11px] " + className}>
      {children}
    </td>
  );
}
