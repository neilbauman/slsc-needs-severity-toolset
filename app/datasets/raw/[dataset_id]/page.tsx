"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CleanNumericDatasetModal from "@/components/CleanNumericDatasetModal";
import CleanCategoricalDatasetModal from "@/components/CleanCategoricalDatasetModal";

export default function RawDatasetPage({ params }: { params: { dataset_id: string } }) {
  const datasetId = params.dataset_id;

  const [dataset, setDataset] = useState<any>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNumericModal, setShowNumericModal] = useState(false);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);

  async function load() {
    setLoading(true);

    // Load metadata
    const { data: ds, error: dsErr } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", datasetId)
      .single();

    if (dsErr) {
      console.error(dsErr);
      setLoading(false);
      return;
    }
    setDataset(ds);

    // Load raw rows based on type
    if (ds.type === "numeric") {
      const { data: rows } = await supabase
        .from("dataset_values_numeric_raw")
        .select("*")
        .eq("dataset_id", datasetId)
        .limit(200);

      setRawRows(rows || []);
    } else {
      const { data: rows } = await supabase
        .from("dataset_values_categorical_raw")
        .select("*")
        .eq("dataset_id", datasetId)
        .limit(200);

      setRawRows(rows || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [datasetId]);

  if (loading || !dataset) {
    return (
      <div className="p-6 text-gray-600">
        Loading raw dataset…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Raw Dataset: {dataset.name}
      </h1>

      <div>
        <p><strong>Type:</strong> {dataset.type}</p>
        <p><strong>Admin level:</strong> {dataset.admin_level}</p>
        {dataset.description && <p><strong>Description:</strong> {dataset.description}</p>}
      </div>

      <div className="card p-4">
        <h2 className="font-semibold mb-2">How this works</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            Numeric cleaning uses <code>preview_numeric_cleaning_v2</code> to preview
            matching, then <code>clean_numeric_dataset</code> to write into
            <code> dataset_values_numeric</code>.
          </li>
          <li>
            Categorical cleaning reshapes wide/long using <code>preview_categorical_cleaning</code> and writes matches into
            <code> dataset_values_categorical</code>.
          </li>
          <li>
            Raw rows remain in staging tables (
            <code>dataset_values_numeric_raw</code> /
            <code>dataset_values_categorical_raw</code>) and are never modified.
          </li>
        </ul>
      </div>

      <div className="flex justify-end">
        {dataset.type === "numeric" ? (
          <button
            className="btn btn-primary"
            onClick={() => setShowNumericModal(true)}
          >
            Clean numeric dataset
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setShowCategoricalModal(true)}
          >
            Clean categorical dataset
          </button>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2">Raw values (preview)</h2>

        <div className="overflow-x-auto border rounded bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                {rawRows.length > 0 &&
                  Object.keys(rawRows[0]).map((col) => (
                    col !== "raw_row" && (
                      <th key={col} className="px-3 py-2 border-b text-left">
                        {col}
                      </th>
                    )
                  ))}
              </tr>
            </thead>
            <tbody>
              {rawRows.length === 0 && (
                <tr>
                  <td className="p-3 text-gray-500">No raw rows found.</td>
                </tr>
              )}

              {rawRows.map((row, i) => (
                <tr key={i} className="border-b">
                  {Object.keys(row).map((col) =>
                    col !== "raw_row" ? (
                      <td key={col} className="px-3 py-2">
                        {String(row[col] ?? "")}
                      </td>
                    ) : null
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNumericModal && dataset.type === "numeric" && (
        <CleanNumericDatasetModal
          datasetId={datasetId}
          datasetName={dataset.name}
          onClose={() => setShowNumericModal(false)}
          onCleaned={load}
        />
      )}

      {showCategoricalModal && dataset.type === "categorical" && (
        <CleanCategoricalDatasetModal
          datasetId={datasetId}
          datasetName={dataset.name}
          onClose={() => setShowCategoricalModal(false)}
          onCleaned={load}
        />
      )}
    </div>
  );
}
