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
  const [method, setMethod] = useState("Normalization");
  const [scaleMax, setScaleMax] = useState(5);
  const [inverse, setInverse] = useState(false);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ✅ Load existing config
  useEffect(() => {
    const loadConfig = async () => {
      const { data, error } = await supabase
        .from("instance_dataset_config")
        .select("score_config")
        .eq("instance_id", instance.id)
        .eq("dataset_id", dataset.id)
        .single();

      if (error) {
        console.warn("No existing score config found:", error.message);
        return;
      }

      const cfg = data?.score_config || {};
      if (cfg.method) setMethod(cfg.method);
      if (cfg.scaleMax) setScaleMax(cfg.scaleMax);
      if (cfg.inverse !== undefined) setInverse(cfg.inverse);
      if (cfg.thresholds?.length) setThresholds(cfg.thresholds);
    };
    loadConfig();
  }, [instance.id, dataset.id]);

  // ✅ Save config
  const saveConfig = async () => {
    setSaving(true);
    const config = { method, scaleMax, inverse, thresholds };

    const { error } = await supabase
      .from("instance_dataset_config")
      .update({ score_config: config })
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id);

    if (error) {
      setMessage(`❌ Error saving config: ${error.message}`);
    } else {
      setMessage("✅ Config saved!");
      if (onSaved) onSaved();
    }
    setSaving(false);
  };

  // ✅ Apply scoring
  const applyScoring = async () => {
    setSaving(true);
    setMessage("Running scoring...");

    let rpcResponse;
    if (method === "Normalization") {
      rpcResponse = await supabase.rpc("score_numeric_normalized", {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_scale_max: scaleMax,
        in_inverse: inverse,
      });
    } else {
      rpcResponse = await supabase.rpc("score_numeric_thresholds", {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_rules: thresholds,
      });
    }

    if (rpcResponse.error) {
      setMessage(`❌ Error running scoring: ${rpcResponse.error.message}`);
    } else {
      setMessage("✅ Scoring complete!");
      if (onSaved) onSaved();
    }

    setSaving(false);
  };

  // ✅ Preview scoring results safely
  const previewScores = async () => {
    type StatRow = {
      count: number | null;
      min: number | null;
      max: number | null;
      avg: number | null;
    };

    const { data, error } = await supabase
      .from("scored_instance_values_adm3")
      .select("count:count(*), min:min(score), max:max(score), avg:avg(score)")
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id)
      .maybeSingle();

    if (error) {
      console.error("Preview error:", error);
      setMessage("❌ Error generating preview.");
      return;
    }

    const safeData = data as unknown as StatRow;
    setPreview({
      count: safeData?.count ?? 0,
      min: safeData?.min ? safeData.min.toFixed(2) : "-",
      max: safeData?.max ? safeData.max.toFixed(2) : "-",
      avg: safeData?.avg ? safeData.avg.toFixed(2) : "-",
    });
  };

  const addRange = () =>
    setThresholds([...thresholds, { min: 0, max: 0, score: 1 }]);

  const updateRange = (idx: number, key: string, value: any) => {
    const updated = [...thresholds];
    updated[idx][key] = value;
    setThresholds(updated);
  };

  const removeRange = (idx: number) =>
    setThresholds(thresholds.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[650px] p-6 relative text-gray-800">
        <h2 className="text-lg font-semibold mb-3">{dataset.name}</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Scoring Method:
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border rounded p-2 w-full text-sm"
          >
            <option value="Normalization">Normalization</option>
            <option value="Thresholds">Thresholds</option>
          </select>
        </div>

        {method === "Normalization" && (
          <>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">
                Scale (max score):
              </label>
              <select
                value={scaleMax}
                onChange={(e) => setScaleMax(Number(e.target.value))}
                className="border rounded p-2 w-full text-sm"
              >
                {[3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    1–{v}
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex items-center mt-2 text-sm">
              <input
                type="checkbox"
                checked={inverse}
                onChange={(e) => setInverse(e.target.checked)}
                className="mr-2"
              />
              Higher values mean more vulnerability
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
                + Add Range
              </button>
            </div>
            <table className="w-full text-sm border border-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-1 text-left">Min</th>
                  <th className="p-1 text-left">Max</th>
                  <th className="p-1 text-left">Score</th>
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

        {/* ✅ Preview */}
        {preview && (
          <div className="mt-3 p-3 border rounded bg-gray-50 text-sm">
            <h4 className="font-medium mb-1">Preview Summary</h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-gray-500 text-xs">Count</div>
                <div className="font-semibold">{preview.count}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Min</div>
                <div className="font-semibold">{preview.min}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Max</div>
                <div className="font-semibold">{preview.max}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Avg</div>
                <div className="font-semibold">{preview.avg}</div>
              </div>
            </div>
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

        {/* Buttons */}
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
          <button
            onClick={previewScores}
            disabled={saving}
            className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}
