"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface DatasetScoreSummaryTableProps {
  instanceId: string;
}

export default function DatasetScoreSummaryTable({
  instanceId,
}: DatasetScoreSummaryTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_dataset_score_distribution")
        .select("*")
        .eq("instance_id", instanceId)
        .order("avg_score", { ascending: false });

      if (error) {
        console.error("Error loading dataset scores:", error);
        setError(error.message);
      } else {
        setData(data || []);
      }
      setLoading(false);
    };

    fetchData();
  }, [instanceId]);

  if (loading)
    return (
      <div className="text-center text-gray-500 text-sm py-4">
        Loading dataset scores...
      </div>
    );

  if (error)
    return (
      <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
        ❌ Error loading data: {error}
      </div>
    );

  if (data.length === 0)
    return (
      <div className="text-center text-gray-500 text-sm py-4">
        No scoring results yet for this instance.
      </div>
    );

  return (
    <div className="mt-6 border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="p-3 border-b bg-gray-50 font-semibold text-sm text-gray-700">
        Dataset Scoring Summary
      </div>
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
          <tr>
            <th className="p-2">Dataset</th>
            <th className="p-2 text-right">Areas</th>
            <th className="p-2 text-right">Min</th>
            <th className="p-2 text-right">Max</th>
            <th className="p-2 text-right">Avg</th>
            <th className="p-2 text-right">High (≥3)</th>
            <th className="p-2 text-right">% High</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.dataset_id}
              className="border-t hover:bg-gray-50 transition"
            >
              <td className="p-2 font-medium text-gray-800">
                {row.dataset_name}
              </td>
              <td className="p-2 text-right text-gray-700">
                {row.area_count.toLocaleString()}
              </td>
              <td className="p-2 text-right">{row.min_score?.toFixed(2)}</td>
              <td className="p-2 text-right">{row.max_score?.toFixed(2)}</td>
              <td className="p-2 text-right font-semibold text-blue-700">
                {row.avg_score?.toFixed(2)}
              </td>
              <td className="p-2 text-right">{row.count_high}</td>
              <td
                className={`p-2 text-right font-semibold ${
                  row.pct_high >= 70
                    ? "text-red-600"
                    : row.pct_high >= 40
                    ? "text-orange-500"
                    : "text-green-600"
                }`}
              >
                {row.pct_high?.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
