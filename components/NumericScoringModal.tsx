"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface NumericScoringModalProps {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function NumericScoringModal({
  dataset,
  instance,
  onClose,
  onSaved,
}: NumericScoringModalProps) {
  const [method, setMethod] = useState<"Normalization" | "Thresholds">("Normalization");
  const [scaleMax, setScaleMax] = useState(5);
  const [inverse, setInverse] = useState(false);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDatasetStats();
  }, [dataset.id, instance.id]);

  // ✅ Load dataset stats limited to affected ADM3s
  const loadDatasetStats = async () => {
    const { data, error } = await supabase.rpc("get_dataset_stats_limited", {
      in_dataset_id: dataset.id,
      in_instance_id: instance.id,
    });
    if (error) {
      console.error("Stats error:", error);
      return;
    }
    setStats(data);
  };

  // ✅ Save config for re-use
  const saveConfig = async () => {
    setSaving(true);
    const config = { method, scaleMax, inverse, thresholds };

    const { error } = await supabase
      .from("instance_dataset_config")
      .update({ score_config: config })
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id);

    setSaving(false);
    if (error) setMessage(`❌ ${error.message}`);
    else {
      setMessage("✅ Config saved.");
      onSaved?.();
    }
  };

  // ✅ Apply Scoring (normalization or thresholds)
  const applyScoring = async () => {
    setSaving(true);
    setMessage("Applying scoring...");

    const rpc =
      method === "Normalization"
        ? "score_numeric_normalized_adm4_to_adm3"
        : "score_numeric_thresholds_adm4_to_adm3";

    const params =
      method === "Normalization"
        ? {
            in_instance_id: instance.id,
            in_dataset_id: dataset.id,
            in_scale_max: scaleMax,
            in_inverse: inverse,
            in_limit_to_affected: true,
          }
        : {
            in_instance_id: instance.id,
            in_dataset_id: dataset.id,
            in_thresholds: thresholds,
            in_limit_to_affected: true,
          };

    const { error } = await supabase.rpc(rpc, params);

    setSaving(false);
    if (error) setMessage(`❌ ${error.message}`);
    else {
      setMessage("✅ Scoring complete.");
      onSaved?.();
    }
  };

  // ✅ Threshold editing helpers
  const addRange = () =>
    setThresholds([...thresholds, { min: 0, max: 0, score: 1 }]);

  const updateRange = (i: number, key: string, val: any) => {
    const updated = [...thresholds];
    updated[i][key] = val;
    setThresholds(updated);
  };

  const removeRange = (i: number) =>
    setThresholds(thresholds.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[650px] p-6 relative text-gray-800">
        <h2 className="text-lg font-semibold mb-3">{dataset.name}</h2>

        {stats && (
          <div className="mb-3 grid grid-cols-4 gap-2 text-sm text-center border p-2 rounded bg-gray-50">
            <div><b>Min</b><br />{stats.min?.toLocaleString()}</div>
            <div><b>Max</b><br />{stats.max?.toLocaleString()}</div>
            <div><b>Avg</b><br />{stats.avg?.toFixed(2)}</div>
            <div><b>Count</b><br />{stats.count}</div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Scoring Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="border rounded p-2 w-full text-sm"
          >
            <option value="Normalization">Normalization</option>
            <option value="Thresholds">Thresholds</option>
          </select>
        </div>

        {method === "Normalization" && (
          <>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Scale (max)</label>
              <select
                value={scaleMax}
                onChange={(e) => setScaleMax(Number(e.target.value))}
                className="border rounded p-2 w-full text-sm"
              >
                {[3, 4, 5].map((v) => (
                  <option key={v} value={v}>{`1–${v}`}</option>
                ))}
              </select>
            </div>

            <label className="inline-flex items-center text-sm">
              <input
                type="checkbox"
                checked={inverse}
                onChange={(e) => setInverse(e.target.checked)}
                className="mr-2"
              />
              Higher values indicate <b>{inverse ? "less" : "more"}</b> vulnerability
            </label>
          </>
        )}

        {method === "Thresholds" && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Threshold Ranges</label>
              <button
                onClick={addRange}
                className="px-2 py-1 border text-sm rounded hover:bg-gray-100"
              >
                + Add
              </button>
            </div>
            <table className="w-full text-sm border border-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-1">Min</th>
                  <th className="p-1">Max</th>
                  <th className="p-1">Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.min}
                        onChange={(e) =>
                          updateRange(i, "min", Number(e.target.value))
                        }
                        className="w-full border rounded p-1"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.max}
                        onChange={(e) =>
                          updateRange(i, "max", Number(e.target.value))
                        }
                        className="w-full border rounded p-1"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.score}
                        onChange={(e) =>
                          updateRange(i, "score", Number(e.target.value))
                        }
                        className="w-full border rounded p-1"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => removeRange(i)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message && (
          <p
            className={`mt-2 text-sm ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}

        <div className="flex justify-end mt-4 gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100 text-sm"
          >
            Close
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Save Config
          </button>
          <button
            onClick={applyScoring}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
          >
            Apply Scoring
          </button>
        </div>
      </div>
    </div>
  );
}
