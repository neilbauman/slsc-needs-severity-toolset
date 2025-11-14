"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import CleanNumericDatasetModal from "@/components/CleanNumericDatasetModal";
import CleanCategoricalDatasetModal from "@/components/CleanCategoricalDatasetModal";

export default function RawDatasetPage({ params }: { params: { dataset_id: string } }) {
  const supabase = supabaseBrowser();
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<any>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    // 1) Load dataset metadata
    const { data: ds } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", datasetId)
      .maybeSingle();
    setDataset(ds);

    if (ds) {
      // 2) Load raw rows from correct raw table
      if (ds.type === "numeric") {
        const { data } = await supabase
          .from("dataset_values_numeric_raw")
          .select("*")
          .eq("dataset_id", datasetId)
          .limit(2000);

        setRawRows(data ?? []);
      } else {
        const { data } = await supabase
          .from("dataset_values_categorical_raw")
          .select("*")
          .eq("dataset_id", datasetId)
          .limit(2000);

        setRawRows(data ?? []);
      }
    }
    setLoading(false);
  }

  if (!dataset) return null;

  const isNumeric = dataset.type === "numeric";

  return (
    <div className="p-6 space-y-6">

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold">
          Raw Dataset: {dataset.name}
        </h1>
        <p className="text-sm opacity-75">
          Type: {dataset.type} · Admin level: {dataset.admin_level} · Category: {dataset.category}
        </p>
      </div>

      {/* HOW THIS WORKS */}
      <div className="card p-4">
        <h3 className="font-semibold mb-2">How this works</h3>
        <ul className="list-disc ml-6 text-sm">
          <li>
            Numeric cleaning uses <code>preview_numeric_cleaning_v2</code> to preview matches,
            then <code>clean_numeric_dataset</code> writes into <code>dataset_values_numeric</code>.
          </li>
          <li>
            Categorical cleaning reshapes wide/long input using <code>preview_categorical_cleaning</code> and writes matches into <code>dataset_values_categorical</code>.
          </li>
          <li>
            Raw rows in <code>dataset_values_numeric_raw</code> and <code>dataset_values_categorical_raw</code> are never modified.
          </li>
        </ul>
      </div>

      {/* CLEAN BUTTON */}
      <div className="flex justify-end">
        {isNumeric ? (
          <button className="btn btn-primary" onClick={() => setShowNumericModal(true)}>
            Clean numeric dataset
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowCategoricalModal(true)}>
            Clean categorical dataset
          </button>
        )}
      </div>

      {/* RAW PREVIEW TABLE */}
      <div className="card p-4">
        <h3 className="font-semibold mb-3">Raw values (preview)</h3>

        {loading ? (
          <p>Loading…</p>
        ) : rawRows.length === 0 ? (
          <p>No raw rows found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-100 border-b">
                <tr>
                  {Object.keys(rawRows[0]).map((col) => (
                    <th key={col} className="px-2 py-1 text-left border-b">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    {Object.keys(rawRows[0]).map((col) => (
                      <td key={col} className="px-2 py-1 border-b">
                        {typeof row[col] === "object"
                          ? JSON.stringify(row[col])
                          : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALS */}
      <CleanNumericDatasetModal
        datasetId={datasetId}
        datasetName={dataset.name}
        open={showNumericModal}
        onOpenChange={setShowNumericModal}
        onCleaned={load}
      />

      <CleanCategoricalDatasetModal
        datasetId={datasetId}
        datasetName={dataset.name}
        open={showCategoricalModal}
        onOpenChange={setShowCategoricalModal}
        onCleaned={load}
      />
    </div>
  );
}
