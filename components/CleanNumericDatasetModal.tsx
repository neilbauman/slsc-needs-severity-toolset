"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  datasetId: string;
  open: boolean;
  onClose: () => void;
}

interface NumericRow {
  raw_admin_pcode: string;
  raw_admin_name: string;
  raw_value: number | null;
  adm3_pcode: string | null;
  adm3_name: string | null;
  match_status: string;
}

interface CountRow {
  match_status: string;
  count_rows: number;
  total_rows: number;
}

export default function CleanNumericDatasetModal({ datasetId, open, onClose }: Props) {
  const [rows, setRows] = useState<NumericRow[]>([]);
  const [summary, setSummary] = useState<{ matched: number; noAdm2: number; noAdm3: number; total: number }>({
    matched: 0,
    noAdm2: 0,
    noAdm3: 0,
    total: 0,
  });

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      // Load summary
      const { data: summaryData } = await supabase.rpc<CountRow[]>(
        "preview_numeric_cleaning_v2_counts",
        { in_dataset: datasetId }
      );

      if (summaryData) {
        const matched = summaryData.find((r) => r.match_status === "matched")?.count_rows ?? 0;
        const noAdm2 = summaryData.find((r) => r.match_status === "no_adm2_match")?.count_rows ?? 0;
        const noAdm3 = summaryData.find((r) => r.match_status === "no_adm3_name_match")?.count_rows ?? 0;
        const total = summaryData[0]?.total_rows ?? matched + noAdm2 + noAdm3;

        setSummary({ matched, noAdm2, noAdm3, total });
      }

      // Load preview rows
      const { data: previewData } = await supabase.rpc<NumericRow[]>(
        "preview_numeric_cleaning_v2",
        { in_dataset: datasetId }
      );

      if (previewData) setRows(previewData.slice(0, 100)); // Preview first 100
    };

    load();
  }, [open, datasetId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Clean Numeric Dataset</h2>

        {/* SUMMARY */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <SummaryCard label="Matched" value={summary.matched} tone="good" />
          <SummaryCard label="No ADM2" value={summary.noAdm2} tone="bad" />
          <SummaryCard label="No ADM3" value={summary.noAdm3} tone="warn" />
          <SummaryCard label="Total" value={summary.total} tone="neutral" />
        </div>

        {/* TABLE */}
        <div className="flex-1 overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
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
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <Td>{r.raw_admin_pcode}</Td>
                  <Td>{r.raw_admin_name}</Td>
                  <Td>{r.raw_value ?? "—"}</Td>
                  <Td>{r.adm3_pcode ?? "—"}</Td>
                  <Td>{r.adm3_name ?? "—"}</Td>
                  <Td className="capitalize">{r.match_status}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white border-t pt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Apply Cleaning</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children }: { children: string }) {
  return <th className="text-left px-3 py-2 font-semibold">{children}</th>;
}
function Td({ children }: any) {
  return <td className="px-3 py-2">{children}</td>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const colors: any = {
    good: "bg-green-50 text-green-700",
    bad: "bg-red-50 text-red-700",
    warn: "bg-yellow-50 text-yellow-700",
    neutral: "bg-gray-50 text-gray-700",
  };
  return (
    <div className={`p-3 rounded border ${colors[tone]} text-center`}>
      <div className="text-sm">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
