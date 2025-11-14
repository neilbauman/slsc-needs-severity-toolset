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

type PreviewRow = {
  dataset_id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  category: string | null;
  value_raw: number | null;
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
};

type CountRow = {
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
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wideFormat, setWideFormat] = useState(true);

  useEffect(() => {
    if (!open) return;
    loadPreview();
  }, [open, wideFormat]);

  async function loadPreview() {
    setLoading(true);
    setError(null);

    try {
      // 1) Counts (all rows)
      const { data: countData, error: countErr } = await supabase.rpc(
        "preview_categorical_cleaning_counts",
        {
          in_dataset: datasetId,
          in_wide_format: wideFormat,
        }
      );
      if (countErr) throw countErr;
      setCounts((countData ?? []) as CountRow[]);

      // 2) Preview rows (first 1000)
      const { data: previewData, error: previewErr } = await supabase.rpc(
        "preview_categorical_cleaning",
        {
          in_dataset_id: datasetId,
          in_wide_format: wideFormat,
        }
      );
      if (previewErr) throw previewErr;

      setRows(((previewData ?? []) as PreviewRow[]).slice(0, 1000));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const matched =
    counts.find((r) => r.match_status === "matched")?.count_rows || 0;
  const noAdm2 =
    counts.find((r) => r.match_status === "no_adm2_match")?.count_rows || 0;
  const noAdm3 =
    counts.find((r) => r.match_status === "no_adm3_name_match")
      ?.count_rows || 0;
  const total = counts.reduce(
    (t, r) => t + Number(r.count_rows || 0),
    0
  );

  async function apply() {
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
      setError(err.message);
    } finally {
      setApplyLoading(false);
    }
  }

  if (!open) return null;

  return (
    <ModalShell onClose={() => onOpenChange(false)}>
      <Header
        title={`Clean Categorical Dataset — ${datasetName}`}
      />

      {/* FORMAT TOGGLE */}
      <div className="mb-4">
        <label className="mr-3 text-sm font-medium">Format:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={wideFormat ? "wide" : "long"}
          onChange={(e) => setWideFormat(e.target.value === "wide")}
        >
          <option value="wide">Wide</option>
          <option value="long">Long</option>
        </select>
      </div>

      {/* SUMMARY BARS */}
      <SummaryRow
        matched={matched}
        noAdm2={noAdm2}
        noAdm3={noAdm3}
        total={total}
      />

      {error && <ErrorBox message={error} />}

      <ScrollableTable>
        <thead>
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
            <tr><Td colSpan={7}>Loading…</Td></tr>
          ) : rows.length === 0 ? (
            <tr><Td colSpan={7}>No preview rows</Td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                <Td>{r.admin_pcode_raw || "—"}</Td>
                <Td>{r.admin_name_raw || "—"}</Td>
                <Td>{r.category || "—"}</Td>
                <Td>{r.value_raw ?? "—"}</Td>
                <Td>{r.admin_pcode_clean || "—"}</Td>
                <Td>{r.admin_name_clean || "—"}</Td>
                <Td className="capitalize">{r.match_status || "—"}</Td>
              </tr>
            ))
          )}
        </tbody>
      </ScrollableTable>

      <FooterButtons
        onCancel={() => onOpenChange(false)}
        onApply={apply}
        applyLoading={applyLoading}
      />
    </ModalShell>
  );
}

/* ====================================================================== */
/* ===================== SHARED COMPONENTS ============================== */
/* ====================================================================== */

function Header({ title }: { title: string }) {
  return (
    <div className="mb-4 flex justify-between items-center">
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function SummaryRow({
  matched,
  noAdm2,
  noAdm3,
  total,
}: {
  matched: number;
  noAdm2: number;
  noAdm3: number;
  total: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
      <SummaryBox label="Matched ADM3" value={matched} color="green" />
      <SummaryBox label="No ADM2 match" value={noAdm2} color="red" />
      <SummaryBox label="No ADM3 name match" value={noAdm3} color="orange" />
      <SummaryBox label="Total Rows" value={total} color="gray" />
    </div>
  );
}

function SummaryBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const bg = {
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    orange: "bg-yellow-50 border-yellow-200 text-yellow-800",
    gray: "bg-gray-50 border-gray-200 text-gray-800",
  }[color];

  return (
    <div className={`border rounded-md p-3 text-center ${bg}`}>
      <div className="text-xs font-medium mb-1">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-3 border border-red-300 bg-red-50 text-red-700 px-3 py-2 rounded">
      {message}
    </div>
  );
}

function ScrollableTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-[55vh] mb-5">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

function FooterButtons({
  onCancel,
  onApply,
  applyLoading,
}: {
  onCancel: () => void;
  onApply: () => void;
  applyLoading: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button className="btn btn-secondary" onClick={onCancel}>
        Cancel
      </button>
      <button
        className="btn btn-primary"
        onClick={onApply}
        disabled={applyLoading}
      >
        {applyLoading ? "Applying…" : "Apply Cleaning"}
      </button>
    </div>
  );
}

function Th({ children }: any) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold border-b bg-gray-50">
      {children}
    </th>
  );
}

function Td({ children, colSpan }: any) {
  return (
    <td
      colSpan={colSpan}
      className="px-4 py-2 text-gray-700 border-b whitespace-nowrap"
    >
      {children}
    </td>
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-[min(100vw-2rem,900px)] max-h-[90vh] rounded-xl shadow-xl p-6 flex flex-col border border-gray-300 overflow-hidden">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
