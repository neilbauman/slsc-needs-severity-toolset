"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/supabaseClient";

interface RawDatasetInfo {
  dataset_id: string;
  name: string | null;
  numeric_count: number;
  categorical_count: number;
}

export default function RawDatasetListPage() {
  const [rows, setRows] = useState<RawDatasetInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // 1) Count numeric raw rows grouped by dataset_id
      const { data: numeric, error: numErr } = await supabase
        .from("dataset_values_numeric_raw")
        .select("dataset_id, count(*)", { count: "exact" })
        .group("dataset_id");

      if (numErr) console.error(numErr);

      // 2) Count categorical raw rows grouped by dataset_id
      const { data: categorical, error: catErr } = await supabase
        .from("dataset_values_categorical_raw")
        .select("dataset_id, count(*)", { count: "exact" })
        .group("dataset_id");

      if (catErr) console.error(catErr);

      // Merge results
      const map = new Map<string, RawDatasetInfo>();

      numeric?.forEach((r) => {
        map.set(r.dataset_id, {
          dataset_id: r.dataset_id,
          name: null,
          numeric_count: r.count,
          categorical_count: 0,
        });
      });

      categorical?.forEach((r) => {
        if (!map.has(r.dataset_id)) {
          map.set(r.dataset_id, {
            dataset_id: r.dataset_id,
            name: null,
            numeric_count: 0,
            categorical_count: r.count,
          });
        } else {
          map.get(r.dataset_id)!.categorical_count = r.count;
        }
      });

      // 3) Fetch dataset names
      const ids = Array.from(map.keys());
      if (ids.length > 0) {
        const { data: ds, error } = await supabase
          .from("datasets")
          .select("id, name")
          .in("id", ids);

        if (!error && ds) {
          ds.forEach((d) => {
            if (map.has(d.id)) {
              map.get(d.id)!.name = d.name;
            }
          });
        }
      }

      setRows(Array.from(map.values()));
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <p className="p-4">Loading…</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Raw Dataset Staging Area</h1>

      {rows.length === 0 ? (
        <p>No raw datasets found.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Dataset</th>
              <th className="p-2 border">Numeric Rows</th>
              <th className="p-2 border">Categorical Rows</th>
              <th className="p-2 border"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dataset_id}>
                <td className="p-2 border">{r.name || r.dataset_id}</td>
                <td className="p-2 border">{r.numeric_count}</td>
                <td className="p-2 border">{r.categorical_count}</td>
                <td className="p-2 border text-blue-600">
                  <Link href={`/datasets/raw/${r.dataset_id}`}>
                    View / Clean →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
