"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NumericScoringModal({ dataset, instance, onClose }) {
  const [method, setMethod] = useState<"threshold" | "normalize">("normalize");
  const [thresholds, setThresholds] = useState<
    { min: string; max: string; score: string }[]
  >([{ min: "", max: "", score: "" }]);
  const [normalizeMax, setNormalizeMax] = useState(5);
  const [higherIsWorse, setHigherIsWorse] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const { data, error } = await supabase
        .from("instance_dataset_config")
        .select("*")
        .eq("instance_id", instance.id)
        .eq("dataset_id", dataset.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      if (data) {
        if (data.scoring_method) setMethod(data.scoring_method);
        if (data.thresholds) setThresholds(data.thresholds);
        if (data.normalize_max) setNormalizeMax(data.normalize_max);
        if (data.higher_is_worse !== null)
          setHigherIsWorse(data.higher_is_worse);
      }
    };
    loadConfig();
  }, [dataset.id, instance.id]);

  const addThreshold = () => {
    setThresholds([...thresholds, { min: "", max: "", score: "" }]);
  };

  const removeThreshold = (i: number) => {
    const next = [...thresholds];
    next.splice(i, 1);
    setThresholds(next);
  };

  const saveConfig = async () => {
    setSaving(true);
    const payload = {
      instance_id: instance.id,
      dataset_id: dataset.id,
      scoring_method: method,
      thresholds: method === "threshold" ? thresholds : null,
      normalize_max: method === "normalize" ? normalizeMax : null,
      higher_is_worse: method === "normalize" ? higherIsWorse : null,
    };

    const { error } = await supabase
      .from("instance_dataset_config")
      .upsert(payload, { onConflict: "instance_id,dataset_id" });

    setSaving(false);
    if (error) {
      console.error(error);
      setStatus("Error saving config: " + error.message);
    } else {
      setStatus("✅ Configuration saved");
    }
  };

  const runScoring = async () => {
    setSaving(true);
    setStatus("Scoring in progress...");

    const rpcName =
      method === "threshold"
        ? "score_numeric_threshold"
        : "score_numeric_normalized";

    const { error } = await supabase.rpc(rpcName, {
      instance_id: instance.id,
      dataset_id: dataset.id,
    });

    setSaving(false);
    if (error) setStatus("Error running scoring: " + error.message);
    else setStatus("✅ Scoring complete!");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-[700px] p-6 overflow-y-auto max-h-[90vh]">
        <h3 className="text-lg font-semibold mb-3">{dataset.name}</h3>

        {/* Method selector */}
        <div className="mb-4">
          <label className="font-medium mr-3">Scoring Method:</label>
          <select
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as "threshold" | "normalize")
            }
            className="border rounded px-2 py-1"
          >
            <option value="normalize">Normalization</option>
            <option value="threshold">Thresholds</option>
          </select>
        </div>

        {/* Threshold mode */}
        {method === "threshold" && (
          <div className="mb-6">
            <table className="w-full text-sm border border-gray-200 mb-3">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left w-24">Min</th>
                  <th className="p-2 text-left w-24">Max</th>
                  <th className="p-2 text-left w-20">Score</th>
                  <th className="p-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.min}
                        onChange={(e) => {
                          const next = [...thresholds];
                          next[i].min = e.target.value;
                          setThresholds(next);
                        }}
                        className="w-full border rounded px-1 text-center"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={t.max}
                        onChange={(e) => {
                          const next = [...thresholds];
                          next[i].max = e.target.value;
                          setThresholds(next);
                        }}
                        className="w-full border rounded px-1 text-center"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={t.score}
                        onChange={(e) => {
                          const next = [...thresholds];
                          next[i].score = e.target.value;
                          setThresholds(next);
                        }}
                        className="w-full border rounded px-1 text-center"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => removeThreshold(i)}
                        className="text-red-600 hover:underline"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={addThreshold}
              className="bg-gray-200 text-sm px-3 py-1 rounded hover:bg-gray-300"
            >
              + Add Range
            </button>
          </div>
        )}

        {/* Normalization mode */}
        {method === "normalize" && (
          <div className="mb-6 space-y-3">
            <div>
              <label className="font-medium mr-3">Scale (max score):</label>
              <select
                value={normalizeMax}
                onChange={(e) => setNormalizeMax(Number(e.target.value))}
                className="border rounded px-2 py-1"
              >
                <option value={3}>1–3</option>
                <option value={4}>1–4</option>
                <option value={5}>1–5</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={higherIsWorse}
                onChange={(e) => setHigherIsWorse(e.target.checked)}
                className="mr-2"
              />
              <label>Higher values mean more vulnerability</label>
            </div>
          </div>
        )}

        {/* Status */}
        {status && <p className="text-sm text-gray-700 mb-3">{status}</p>}

        {/* Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-400 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            Save Config
          </button>
          <button
            onClick={runScoring}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60"
          >
            Apply Scoring
          </button>
        </div>
      </div>
    </div>
  );
}
