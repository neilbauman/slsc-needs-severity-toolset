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
  const [limitToAffected, setLimitToAffected] = useState(true);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ✅ Load existing config from DB
  useEffect(() => {
    const loadConfig = async () => {
      const { data, error } = await supabase
        .from("instance_dataset_config")
        .select("score_config")
        .eq("instance_id", instance.id)
        .eq("dataset_id", dataset.id)
        .maybeSingle();

      if (error) {
        console.warn("No existing score config found:", error.message);
        return;
      }

      const cfg = data?.score_config || {};
      if (cfg.method) setMethod(cfg.method);
      if (cfg.scaleMax) setScaleMax(cfg.scaleMax);
      if (cfg.inverse !== undefined) setInverse(cfg.inverse);
      if (cfg.limitToAffected !== undefined) setLimitToAffected(cfg.limitToAffected);
      if (cfg.thresholds?.length) setThresholds(cfg.thresholds);
    };

    loadConfig();
  }, [instance.id, dataset.id]);

  // ✅ Save current configuration
  const saveConfig = async () => {
    setSaving(true);
    const config = { method, scaleMax, inverse, thresholds, limitToAffected };

    const { error } = await supabase
      .from("instance_dataset_config")
      .update({ score_config: config })
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id);

    if (error) setMessage(`❌ ${error.message}`);
    else {
      setMessage("✅ Config saved!");
      onSaved?.();
    }

    setSaving(false);
  };

  // ✅ Apply scoring (Normalization or Thresholds)
  const applyScoring = async () => {
    setSaving(true);
    setMessage("Running scoring...");

    const rpcName =
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
            in_limit_to_affected: limitToAffected,
          }
        : {
            in_instance_id: instance.id,
            in_dataset_id: dataset.id,
            in_thresholds: thresholds,
            in_limit_to_affected: limitToAffected,
          };

    const { error } = await supabase.rpc(rpcName, params);

    if (error) setMessage(`❌ Error: ${error.message}`);
    else {
      setMessage("✅ Scoring complete!");
      onSaved?.();
    }

    setSaving(false);
  };

  // ✅ Preview results (summary)
  const previewScores = async () => {
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

    if (!data) {
      setMessage("No scores available to preview.");
      return;
    }

    setPreview({
      count: data.count ?? 0,
      min: data.min?.toFixed(2) ?? "-",
      max: data.max?.toFixed(2) ?? "-",
      avg: data.avg?.toFixed(2) ?? "-",
    });
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
      <div className="bg-white rounded-lg shadow-xl w-[650px] p-6 text-gray-800">
        <h2 className="text-lg font-semibold mb-4">
          Scoring: {dataset.name}
        </h2>

        {/* Scoring Method */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Scoring Method
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

        {/* Normalization Options */}
        {method === "Normalization" && (
          <>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">
                Scale (max score)
              </label>
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

            <label className="inline-flex items-center text-sm mb-3">
              <input
                type="checkbox"
                checked={inverse}
                onChange={(e) => setInverse(e.target.checked)}
                className="mr-2"
              />
              Higher values indicate{" "}
              <b>{inverse ? "less" : "more"}</b> vulnerability
            </label>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">
                Normalization Scope
              </label>
              <select
                value={limitToAffected ? "affected" : "national"}
                onChange={(e) =>
                  setLimitToAffected(e.target.value === "affected")
                }
                className="border rounded p-2 w-full text-sm"
              >
                <option value="affected">Affected Area Only</option>
                <option value="national">Entire Country</option>
              </select>
            </div>
          </>
        )}

        {/* Thresholds Options */}
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

        {/* Preview summary */}
        {preview && (
          <div className="mt-4 p-3 border rounded bg-gray-50 text-sm">
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

        {/* Footer buttons */}
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
