"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabaseClient";

interface RawRow {
  id: string;
  admin_pcode_raw: string | null;
  admin_name_raw: string | null;
  value_raw?: string | null;
  shape?: string | null;
  raw_row: any;
}

export default function RawDatasetDetailPage({ params }: any) {
  const dataset_id = params.dataset_id;

  const [numericRows, setNumericRows] = useState<RawRow[]>([]);
  const [categoricalRows, setCategoricalRows] = useState<RawRow[]>([]);
  const [dataset, setDataset] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // dataset metadata
      const { data: ds } = await supabase
        .from("datasets")
        .select("*")
        .eq("id", dataset_id)
        .single();
      setDataset(ds);

      // numeric rows
      const { data: num } = await supabase
        .from("dataset_values_numeric_raw")
        .select("*")
        .eq("dataset_id", dataset_id)
        .limit(5000);
      setNumericRows(num || []);

      // categorical rows
      const { data: cat } = await supabase
        .from("dataset_values_categorical_raw")
        .select("*")
        .eq("dataset_id", dataset_id)
        .limit(5000);
      setCategoricalRows(cat || []);

      setLoading(false);
    }

    load();
  }, [dataset_id]);

  if (loading) return <p className="p-4">Loading…</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Raw Dataset: {dataset?.name || dataset_id}
      </h1>

      <p className="text-gray-600">
        Admin-level: {dataset?.admin_level} — Type: {dataset?.type}
      </p>

      {numericRows.length > 0 && (
        <>
          <h2 className="text-xl font-semibold">Numeric Raw Rows</h2>
          <table className="w-full text-xs border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Admin PCode Raw</th>
                <th className="p-2 border">Admin Name Raw</th>
                <th className="p-2 border">Value Raw</th>
                <th className="p-2 border">is %?</th>
              </tr>
            </thead>
            <tbody>
              {numericRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-2 border">{r.admin_pcode_raw}</td>
                  <td className="p-2 border">{r.admin_name_raw}</td>
                  <td className="p-2 border">{r.value_raw}</td>
                  <td className="p-2 border">
                    {r.is_percentage ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {categoricalRows.length > 0 && (
        <>
          <h2 className="text-xl font-semibold">Categorical Raw Rows</h2>
          <table className="w-full text-xs border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Admin PCode Raw</th>
                <th className="p-2 border">Admin Name Raw</th>
                <th className="p-2 border">Shape</th>
              </tr>
            </thead>
            <tbody>
              {categoricalRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-2 border">{r.admin_pcode_raw}</td>
                  <td className="p-2 border">{r.admin_name_raw}</td>
                  <td className="p-2 border">{r.shape}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {numericRows.length === 0 && categoricalRows.length === 0 && (
        <p>No rows found for this dataset.</p>
      )}
    </div>
  );
}
