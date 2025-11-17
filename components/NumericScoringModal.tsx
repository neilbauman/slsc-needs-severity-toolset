"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function NumericScoringModal({ dataset, instance, onClose, onSaved }: Props) {
  const [method, setMethod] = useState<"Thresholds" | "Normalization">("Thresholds");
  const [ranges, setRanges] = useState<{ min: number | null; max: number | null; score: number | null }[]>([
    { min: 0, max: null, score: null },
  ]);
  const [scale, setScale] = useState(5);
  const [inverse, setInverse] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const addRange = () => setRanges([...ranges, { min: null, max: null, score: null }]);
  const removeRange = (i: number) => setRanges(ranges.filter((_, idx) => idx !== i));

  const updateRange = (i: number, field: keyof (typeof ranges)[0], value: any) => {
    const next = [...ranges];
    next[i][field] = value === "" ? null : Number(value);
    setRanges(next);
  };

  const saveConfig = async () => {
    setMessage("Saving configuration...");
    const { error } = await supabase
      .from("instance_dataset_config")
      .upsert({
        instance_id: instance.id,
        dataset_id: dataset.id,
        score_method: method.toLowerCase(),
        score_config:
          method === "Thresholds"
            ? { ranges }
            : { scale, inverse },
      });

    if (error) setMessage("❌ Error saving config: " + error.message);
    else setMessage("✅ Config saved!");
  };

  const applyScoring = async () => {
    setLoading(true);
    setMessage("Running scoring...");

    try {
      if (method === "Thresholds") {
        const { error } = await supabase.rpc("score_numeric_thresholds", {
          in_instance_id: instance.id,
          in_dataset_id: dataset.id,
          in_rules: JSON.stringify(ranges),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("score_numeric_normalized", {
          in_instance_id: instance.id,
          in_dataset_id: dataset.id,
          in_scale_max: scale,
          in_inverse: inverse,
        });
        if (error) throw error;
      }

      setMessage("✅ Scoring complete!");
      if (onSaved) onSaved();
    } catch (err: any) {
      setMessage("Error running scoring: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[700px] p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-2">{dataset.name}</h2>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Scoring Method:</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="border rounded p-2 w-full"
          >
            <option>Thresholds</option>
            <option>Normalization</option>
          </select>
        </div>

        {method === "Thresholds" && (
          <div className="space-y-3">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">Min</th>
                  <th className="p-2">Max</th>
                  <th className="p-2">Score</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {ranges.map((r, i) => (
                  <tr key={i}>
                    <td className="p-1">
                      <input
                        type="number"
                        value={r.min ?? ""}
                        onChange={(e) => updateRange(i, "min", e.target.value)}
                        className="w-full border rounded p-1"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={r.max ?? ""}
                        onChange={(e) => updateRange(i, "max", e.target.value)}
                        className="w-full border rounded p-1"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={r.score ?? ""}
                        onChange={(e) => updateRange(i, "score", e.target.value)}
                        className="w-full border rounded p-1"
                      />
                    </td>
                    <td className="text-center">
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
            <button
              onClick={addRange}
              className="text-blue-600 text-sm mt-1 hover:underline"
            >
              + Add Range
            </button>
          </div>
        )}

        {method === "Normalization" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Scale (max score):</label>
              <select
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="border rounded p-2 w-full"
              >
                <option value={3}>1–3</option>
                <option value={5}>1–5</option>
                <option value={10}>1–10</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={inverse}
                onChange={(e) => setInverse(e.target.checked)}
              />
              <label>Higher values mean more vulnerability</label>
            </div>
          </div>
        )}

        {message && <div className="text-sm text-gray-700 mt-2">{message}</div>}

        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={saveConfig}
            className="px-4 py-2 border rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Config
          </button>
          <button
            onClick={applyScoring}
            disabled={loading}
            className="px-4 py-2 border rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Scoring..." : "Apply Scoring"}
          </button>
        </div>
      </div>
    </div>
  );
}
