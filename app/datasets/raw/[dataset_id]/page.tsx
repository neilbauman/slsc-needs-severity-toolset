"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase/supabaseBrowser";
import CleanNumericDatasetModal from "@/components/CleanNumericDatasetModal";
import CleanCategoricalDatasetModal from "@/components/CleanCategoricalDatasetModal";

export default function RawDatasetPage({ params }) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [cleanModalOpen, setCleanModalOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const datasetName = dataset?.name ?? "Dataset";
  const datasetType =
    (dataset?.value_type ?? dataset?.type ?? "numeric").toLowerCase();
  const isNumeric = datasetType === "numeric";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Load dataset info
        const { data: ds, error: dsErr } = await supabase
          .from("datasets")
          .select("*")
          .eq("id", datasetId)
          .single();

        if (dsErr) throw dsErr;
        if (cancelled) return;
        setDataset(ds);

        // Load raw preview
        const { data: raw, error: rawErr } = await supabase
          .from("dataset_values_raw")
          .select("*")
          .eq("dataset_id", datasetId)
          .limit(50);

        if (rawErr) throw rawErr;
        if (cancelled) return;

        setRows(raw ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message ?? "Failed to load dataset.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [datasetId, refreshToken]);

  function handleCleaned() {
    setRefreshToken((x) => x + 1);
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Raw Dataset</h1>
          <p className="text-sm text-gray-500">
            {datasetName} ·{" "}
            <span className="uppercase tracking-wide text-xs">
              {isNumeric ? "NUMERIC" : "CATEGORICAL"}
            </span>
          </p>
        </div>

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => setCleanModalOpen(true)}
        >
          Clean Dataset
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded border border-red-300 text-sm">
          {error}
        </div>
      )}

      {/* RAW PREVIEW */}
      <div className="border rounded">
        <div className="border-b px-4 py-2 bg-gray-50 font-medium text-sm">
          Raw Values (Preview)
        </div>

        {loading ? (
          <div className="py-6 text-center text-gray-500 text-sm">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-gray-500 text-sm">
            No raw rows found.
          </div>
        ) : (
          <div className="max-h-[460px] overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="border px-3 py-2 text-left font-semibold"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-1 border whitespace-nowrap">
                        {row[col] === null || row[col] === undefined
                          ? "—"
                          : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CLEANING MODALS */}
      {isNumeric ? (
        <CleanNumericDatasetModal
          datasetId={datasetId}
          datasetName={datasetName}
          open={cleanModalOpen}
          onOpenChange={setCleanModalOpen}
          onCleaned={handleCleaned}
        />
      ) : (
        <CleanCategoricalDatasetModal
          datasetId={datasetId}
          datasetName={datasetName}
          open={cleanModalOpen}
          onOpenChange={setCleanModalOpen}
          onCleaned={handleCleaned}
        />
      )}
    </div>
  );
}
