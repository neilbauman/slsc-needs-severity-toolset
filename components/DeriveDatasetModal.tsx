"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";

interface DerivedDatasetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DerivedDatasetModal({ open, onOpenChange }: DerivedDatasetModalProps) {
  const [baseA, setBaseA] = useState("");
  const [baseB, setBaseB] = useState("");
  const [method, setMethod] = useState<"ratio" | "difference" | "sum">("ratio");
  const [preview, setPreview] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!baseA || !baseB) {
      setError("Please select both base datasets.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc("preview_derived_dataset_v2", {
        base_a: baseA,
        base_b: baseB,
        method,
        target_admin_level: "ADM4",
      });

      if (error) throw error;

      // Separate data rows and summary
      const normalRows = data.filter((row: any) => row.admin_name !== "SUMMARY");
      const summaryRow = data.find((row: any) => row.admin_name === "SUMMARY");

      setPreview(normalRows);
      setSummary(summaryRow?.summary || null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Derive New Dataset</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Base Dataset A (UUID)</Label>
              <Input value={baseA} onChange={(e) => setBaseA(e.target.value)} placeholder="Dataset A UUID" />
            </div>
            <div>
              <Label>Base Dataset B (UUID)</Label>
              <Input value={baseB} onChange={(e) => setBaseB(e.target.value)} placeholder="Dataset B UUID" />
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <Label>Method:</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "ratio" | "difference" | "sum")}
              className="border p-2 rounded"
            >
              <option value="ratio">Ratio (A ÷ B)</option>
              <option value="difference">Difference (A - B)</option>
              <option value="sum">Sum (A + B)</option>
            </select>
            <Button onClick={handlePreview} disabled={loading}>
              {loading ? "Loading..." : "Preview"}
            </Button>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {preview.length > 0 && (
            <div className="border rounded-md mt-4 overflow-y-auto max-h-[50vh]">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border px-3 py-2 text-left">Admin PCode</th>
                    <th className="border px-3 py-2 text-left">Admin Name</th>
                    <th className="border px-3 py-2 text-right">Derived Value</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="border px-3 py-1">{row.admin_pcode}</td>
                      <td className="border px-3 py-1">{row.admin_name}</td>
                      <td className="border px-3 py-1 text-right">
                        {row.result_value !== null ? row.result_value.toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary && (
            <div className="mt-4 p-3 border rounded-md bg-gray-50 text-sm">
              <h4 className="font-semibold mb-1">Preview Summary</h4>
              <div className="flex flex-wrap gap-6">
                <span>Min: <strong>{summary.min}</strong></span>
                <span>Max: <strong>{summary.max}</strong></span>
                <span>Avg: <strong>{summary.avg}</strong></span>
                <span>Count: <strong>{summary.count}</strong></span>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
