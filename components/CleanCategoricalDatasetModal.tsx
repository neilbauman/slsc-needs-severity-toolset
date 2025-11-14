"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  datasetId: string;
  open: boolean;
  onClose: () => void;
}

interface CatRow {
  admin_pcode_raw: string;
  admin_name_raw: string;
  category: string;
  raw_value: number | null;
  admin_pcode_clean: string | null;
  admin_name_clean: string | null;
  match_status: string;
}

interface CountRow {
  match_status: string;
  count_rows: number;
  total_rows: number;
}

export default function CleanCategoricalDatasetModal({ datasetId, open, onClose }: Props) {
  const [rows, setRows] = useState<CatRow[]>([]);
  const [summary, setSummary] = useState({ matched: 0, noAdm2: 0, noAdm3: 0, total: 0 });
  const [wideFormat, setWideFormat] = useState(true);

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, wideFormat]);

  const loadData = async () => {
    // Summary
    const { data: summaryData } = await supabase.rpc<CountRow[]>(
      "preview_categorical_cleaning_counts",
      { in_dataset: datasetId, in_wide_format: wideFormat }
    );

    if (summaryData) {
      const matched = summaryData.find((r) => r.match_status === "matched")?.count_rows ?? 0;
      const noAdm2 = summaryData.find((r) => r.match_status === "no_adm2_match")?.count_rows ?? 0;
      const noAdm3 = summaryData.find((r) => r.match_status === "no_adm3_name_match")?.count_rows ?? 0;
      const total = summaryData[0]?.total_rows ?? matched + noAdm2 + noAdm3;

      setSummary({ matched, noAdm2, noAdm3, total });
    }

    // Preview rows
    const { data: previewData } = await supabase.rpc<CatRow[]>(
      "preview_categorical_cleaning",
      { in_dataset: datasetId, in_wide_format: wideFormat }
    );

    if (previewData) setRows(previewData.slice(0, 100));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Clean Categorical Dataset</h2>

        {/* FORMAT SELECTOR */}
        <div className="mb-3">
          <label className="mr-2 text-sm font-medium">Format:</label>
          <select
            className="border p-1 rounded"
            value={wideFormat ? "wide" : "long"}
            onChange={(e) => setWideFormat(e.target.value === "wide")}
          >
            <option value="wide">Wide</option>
            <option value="long">Long</option>
          </select>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <SummaryCard label="Matched ADM3" value={summary.matched} tone="good" />
          <SummaryCard label="No ADM2 match" value={summary.noAdm2} tone="bad" />
          <SummaryCard label="No ADM3 name match" value={summary.noAdm3} tone="warn" />
          <SummaryCard label="Total Rows" value={summary.total} tone="neutral" />
        </div>

        {/* TABLE */}
        <div className="flex-1 overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
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
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <Td>{r.admin_pcode_raw}</Td>
                  <Td>{r.admin_name_raw}</Td>
                  <Td>{r.category}</Td>
                  <Td>{r.raw_value ?? "—"}</Td>
                  <Td>{r.admin_pcode_clean ?? "—"}</Td>
                  <Td>{r.admin_name_clean ?? "—"}</Td>
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
  return <th className="px-3 py-2 font-semibold text-left">{children}</th>;
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
