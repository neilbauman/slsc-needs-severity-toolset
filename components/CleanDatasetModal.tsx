"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

interface CleanDatasetModalProps {
  datasetId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface RawRow {
  id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  value_raw: number | null;
  raw_row: any;
}

interface CleanPreview {
  id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  value_raw: number | null;
  admin_pcode_clean: string | null;
  admin_name_clean: string | null;
  match_status: "matched" | "unmatched";
}

export default function CleanDatasetModal({
  datasetId,
  isOpen,
  onClose,
}: CleanDatasetModalProps) {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CleanPreview[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    matched: 0,
    unmatched: 0,
  });

  const [step, setStep] = useState<"preview" | "result">("preview");

  // -------------------------------
  // Normalization helpers
  // -------------------------------
  const normalize = (s: string | null) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  // -------------------------------
  // RULE B: Deterministic ADM3 matcher
  // -------------------------------
  async function runCleaningPreview() {
    setLoading(true);

    // 1. load raw rows
    const { data: rawRows, error } = await supabase
      .from("dataset_values_numeric_raw")
      .select("*")
      .eq("dataset_id", datasetId)
      .limit(2000);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // 2. load ADM tables (assuming adm3 table name = gis_adm3)
    const { data: admData, error: admError } = await supabase
      .from("gis_features")
      .select("adm_code, adm_name, adm_level")
      .eq("adm_level", 3);

    if (admError) {
      console.error(admError);
      setLoading(false);
      return;
    }

    // build name index
    const nameIndex = new Map<string, any>();
    admData.forEach((a) => {
      nameIndex.set(normalize(a.adm_name), a);
    });

    // 3. apply Rule B to preview rows
    const previewRows: CleanPreview[] = rawRows.slice(0, 20).map((row) => {
      let admin_pcode_clean: string | null = null;
      let admin_name_clean: string | null = null;
      let match_status: "matched" | "unmatched" = "unmatched";

      // attempt Rule B transformation
      const rawP = row.admin_pcode_raw;
      const rawN = normalize(row.admin_name_raw);

      let trimmed: string | null = null;
      if (rawP && rawP.endsWith("000")) {
        trimmed = rawP.slice(0, -3); // remove trailing 000
      }

      // try name match
      const nameMatch = nameIndex.get(rawN);
      if (nameMatch) {
        admin_pcode_clean = nameMatch.adm_code;
        admin_name_clean = nameMatch.adm_name;
        match_status = "matched";
      } else if (trimmed) {
        // fallback: try partial prefix match
        const prefix = trimmed.slice(0, 6);
        const fallback = admData.find((a) => a.adm_code.startsWith(prefix));
        if (fallback) {
          admin_pcode_clean = fallback.adm_code;
          admin_name_clean = fallback.adm_name;
          match_status = "matched";
        }
      }

      return {
        id: row.id,
        admin_pcode_raw: row.admin_pcode_raw,
        admin_name_raw: row.admin_name_raw,
        value_raw: row.value_raw,
        admin_pcode_clean,
        admin_name_clean,
        match_status,
      };
    });

    // compute stats
    const matched = previewRows.filter((r) => r.match_status === "matched").length;

    setPreview(previewRows);
    setStats({
      total: rawRows.length,
      matched,
      unmatched: rawRows.length - matched,
    });

    setLoading(false);
  }

  // -------------------------------
  // Apply Cleaning (RPC)
  // -------------------------------
  async function applyCleaning() {
    setLoading(true);

    const { data, error } = await supabase.rpc("clean_numeric_dataset", {
      input_dataset_id: datasetId,
    });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setStep("result");
    router.refresh();
    setLoading(false);
  }

  // -------------------------------
  // open → load preview
  // -------------------------------
  useEffect(() => {
    if (isOpen) runCleaningPreview();
  }, [isOpen]);

  if (!isOpen) return null;

  // --------------------------------------------------------------------
  // UI — matches `/datasets/page.tsx` aesthetic (tailwind cards, tables)
  // --------------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-auto py-10">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-8">
        <h2 className="text-2xl font-bold mb-6">Clean Dataset</h2>

        {loading && <p className="text-gray-600">Processing…</p>}

        {!loading && step === "preview" && (
          <>
            <div className="border rounded p-4 mb-6 bg-gray-50">
              <h3 className="font-semibold mb-2">Summary</h3>
              <p>Total raw rows: {stats.total}</p>
              <p>Matched (deterministic): {stats.matched}</p>
              <p>Unmatched: {stats.unmatched}</p>
            </div>

            <h3 className="text-lg font-semibold mb-3">Preview (20 rows)</h3>
            <div className="overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">Raw Pcode</th>
                    <th className="px-3 py-2 text-left">Raw Name</th>
                    <th className="px-3 py-2 text-left">Value</th>
                    <th className="px-3 py-2 text-left">Clean Pcode</th>
                    <th className="px-3 py-2 text-left">Clean Name</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-3 py-2">{row.admin_pcode_raw}</td>
                      <td className="px-3 py-2">{row.admin_name_raw}</td>
                      <td classn="px-3 py-2">{row.value_raw}</td>
                      <td className="px-3 py-2">
                        {row.admin_pcode_clean || <span className="text-red-600">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row.admin_name_clean || <span className="text-red-600">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row.match_status === "matched" ? (
                          <span className="text-green-600 font-semibold">Matched</span>
                        ) : (
                          <span className="text-red-600 font-semibold">Unmatched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
              >
                Cancel
              </button>
              <button
                onClick={applyCleaning}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Apply Cleaning
              </button>
            </div>
          </>
        )}

        {!loading && step === "result" && (
          <>
            <p className="text-green-600 font-semibold mb-4">
              Cleaning complete! Dataset has been processed.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
