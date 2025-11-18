"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface NumericScoringModalProps {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function NumericScoringModal({
  dataset,
  instance,
  onClose,
  onSaved,
}: NumericScoringModalProps) {
  const [method, setMethod] = useState<"Normalization" | "Thresholds">("Normalization");
  const [scaleMax, setScaleMax] = useState<number>(5);
  const [inverse, setInverse] = useState<boolean>(false);
  const [useNational, setUseNational] = useState<boolean>(false);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [message, setMessage] = useState<string>("");

  // ✅ Load existing configuration
  useEffect(() => {
    const loadConfig = async () => {
      const { data, error } = await supabase
        .from("instance_dataset_config")
        .select("score_config")
        .eq("instance_id", instance.id)
        .eq("dataset_id", dataset.id)
        .single();

      if (error) {
        console.warn("No existing config found:", error.message);
        return;
      }

      if (data?.score_config) {
        const cfg = data.score_config;
        if (cfg.method) setMethod(cfg.method);
        if (cfg.scaleMax) setScaleMax(cfg.scaleMax);
        if (cfg.inverse !== undefined) setInverse(cfg.inverse);
        if (cfg.useNational !== undefined) setUseNational(cfg.useNational);
        if (Array.isArray(cfg.thresholds)) setThresholds(cfg.thresholds);
      }
    };
    loadConfig();
  }, [instance.id, dataset.id]);

  // ✅ Save configuration
  const saveConfig = async () => {
    setSaving(true);
    setMessage("");

    const config = {
      method,
      scaleMax,
      inverse,
      useNational,
      thresholds,
    };

    const { error } = await supabase
      .from("instance_dataset_config")
      .update({ score_config: config })
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id);

    if (error) {
      console.error("Error saving config:", error);
      setMessage(`❌ Error saving config: ${error.message}`);
    } else {
      setMessage("✅ Configuration saved successfully!");
      if (onSaved) await onSaved();
    }

    setSaving(false);
  };

  // ✅ Preview results before applying
  const previewScoring = async () => {
    setMessage("Generating preview...");
    const rpc =
      method === "Normalization"
        ? "score_numeric_normalized"
        : "score_numeric_thresholds";

    const params: any =
      method === "Normalization"
        ? {
            in_instance_id: instance.id,
            in_dataset_id: dataset.id,
            in_scale_max: scaleMax,
            in_inverse: inverse,
            in_use_national: useNational,
          }
        : {
            in_instance_id: instance.id,
            in_dataset_id: dataset.id,
            in_rules: thresholds,
            in_use_national: useNational,
          };

    const { error } = await supabase.rpc(rpc, params);
    if (error) {
      console.error("Preview error:", error);
      setMessage(`❌ Error: ${error.message}`);
      return;
    }

    // Query summary stats
    const { data, error: statsErr } = await supabase
      .from("scored_instance_values_adm3")
      .select("count:count(*), min:min(score), max:max(score), avg:avg(score)")
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id)
      .single();

    if (statsErr) {
      setMessage(`❌ Error loading preview stats: ${statsErr.message}`);
      return;
    }

    setPreview(data);
    setMessage("✅ Preview generated successfully!");
  };

  // ✅ Apply scoring (materialize)
  const applyScoring = async () => {
    setSaving(true);
    setMessage("Applying scoring...");

    const rpc =
      method === "Normalization"
        ? "score_numeric_normalized"
        : "score_numeric_thresholds";

    const params: any =
      method === "Normalization"
        ? {
            in_instance_id: instance.id,
            in_dataset_id: dataset.id,
            in_scale_max: scaleMax,
            in_inverse: inverse,
            in_use_national: useNational,
          }
        : {
            in_instance_id: instance.id,
            in_dataset_id: dataset.id,
            in_rules: thresholds,
            in_use_national: useNational,
          };

    const { error } = await supabase.rpc(rpc, params);

    if (error) {
      console.error("Scoring error:", error);
      setMessage(`❌ Scoring failed: ${error.message}`);
    } else {
      setMessage("✅ Scoring applied successfully!");
      if (onSaved) await onSaved();
    }

    setSaving(false);
  };

  // ✅ Add and manage threshold ranges
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
      <div className="bg-white rounded-lg shadow-lg w-[700px] max-h-[90vh] overflow-y-auto p-6 text-sm">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">
          Configure Scoring – {dataset.name}
        </h2>
        <p className="text-gray-500 mb-4">
          Adjust scoring settings for this dataset within the instance.
        </p>

        {/* Method */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1">Scoring Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="border border-gray-300 rounded px-2 py-1 w-full"
          >
            <option value="Normalization">Normalization</option>
            <option value="Thresholds">Thresholds</option>
          </select>
        </div>

        {method === "Normalization" && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Scale (max score)
                </label>
                <select
                  value={scaleMax}
                  onChange={(e) => setScaleMax(Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                >
                  {[3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      1–{v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center mt-5">
                <input
                  type="checkbox"
                  checked={inverse}
                  onChange={(e) => setInverse(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Higher values = worse (inverse)</span>
              </div>
            </div>

            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={useNational}
                onChange={(e) => setUseNational(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">
                Normalize based on <b>national</b> dataset
              </span>
            </div>
          </>
        )}

        {method === "Thresholds" && (
          <>
            <div className="mb-2 flex justify-between items-center">
              <label className="font-medium text-xs text-gray-700">
                Define Threshold Ranges
              </label>
              <button
                onClick={addRange}
                className="text-xs px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100"
              >
                + Add Range
              </button>
            </div>
            <table className="w-full text-xs border border-gray-200 mb-4">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="p-2 text-left">Min</th>
                  <th className="p-2 text-left">Max</th>
                  <th className="p-2 text-left">Score</th>
                  <th className="p-2 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <input
                        type="number"
                        value={t.min}
                        onChange={(e) => updateRange(i, "min", e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={t.max}
                        onChange={(e) => updateRange(i, "max", e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={t.score}
                        onChange={(e) => updateRange(i, "score", e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                      />
                    </td>
                    <td className="p-2 text-center">
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
          </>
        )}

        {/* Preview Section */}
        {preview && (
          <div className="bg-gray-50 border rounded p-3 text-xs mt-3">
            <div className="font-semibold mb-1">Preview Summary:</div>
            <p>Count: {preview.count}</p>
            <p>
              Score Range: {Number(preview.min).toFixed(2)} –{" "}
              {Number(preview.max).toFixed(2)}
            </p>
            <p>Average: {Number(preview.avg).toFixed(2)}</p>
          </div>
        )}

        {message && (
          <div
            className={`mt-3 text-sm ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-3 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save Config
          </button>
          <button
            onClick={previewScoring}
            className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          >
            Preview
          </button>
          <button
            onClick={applyScoring}
            disabled={saving}
            className="px-3 py-1 border rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Apply Scoring
          </button>
        </div>
      </div>
    </div>
  );
}
