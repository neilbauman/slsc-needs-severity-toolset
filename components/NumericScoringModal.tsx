"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NumericScoringModal({ dataset, instance, onClose, onSaved }: any) {
  const [method, setMethod] = useState("Normalization");
  const [scaleMax, setScaleMax] = useState(5);
  const [inverse, setInverse] = useState(false);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ✅ Load existing saved config (score_config JSON)
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

      if (data?.score_config) {
        const cfg = data.score_config;
        if (cfg.method) setMethod(cfg.method);
        if (cfg.scaleMax) setScaleMax(cfg.scaleMax);
        if (cfg.inverse !== undefined) setInverse(cfg.inverse);
        if (cfg.thresholds?.length) setThresholds(cfg.thresholds);
      }
    };
    loadConfig();
  }, [instance.id, dataset.id]);

  // ✅ Save config JSON into instance_dataset_config.score_config
  const saveConfig = async () => {
    setSaving(true);
    setMessage("");

    const config = {
      method,
      scaleMax,
      inverse,
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
      setMessage("✅ Config saved!");
      if (onSaved) onSaved();
    }
    setSaving(false);
  };

  // ✅ Apply scoring via RPC
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
    } else if (method === "Thresholds") {
      rpcResponse = await supabase.rpc("score_numeric_thresholds", {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_rules: thresholds,
      });
    }

    if (rpcResponse.error) {
      console.error("Error running scoring:", rpcResponse.error);
      setMessage(`❌ Error running scoring: ${rpcResponse.error.message}`);
    } else {
      setMessage("✅ Scoring complete!");
      if (onSaved) onSaved();
    }

    setSaving(false);
  };

  const addRange = () => {
    setThresholds([...thresholds, { min: 0, max: 0, score: 1 }]);
  };

  const updateRange = (idx: number, key: string, value: any) => {
    const updated = [...thresholds];
    updated[idx][key] = value;
    setThresholds(updated);
  };

  const removeRange = (idx: number) => {
    setThresholds(thresholds.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] p-6 relative">
        <h2 className="text-xl font-semibold mb-4">
          {dataset.name}
        </h2>

        <div className="mb-4">
          <label className="block font-medium mb-1">Scoring Method:</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border rounded p-2 w-full"
          >
            <option value="Normalization">Normalization</option>
            <option value="Thresholds">Thresholds</option>
          </select>
        </div>

        {method === "Normalization" && (
          <>
            <div className="mb-3">
              <label className="block font-medium mb-1">Scale (max score):</label>
              <select
                value={scaleMax}
                onChange={(e) => setScaleMax(Number(e.target.value))}
                className="border rounded p-2 w-full"
              >
                {[3, 4, 5, 10].map((v) => (
                  <option key={v} value={v}>
                    1–{v}
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex items-center mt-2">
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
          <>
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label className="font-medium">Threshold Ranges</label>
                <button
                  onClick={addRange}
                  className="px-2 py-1 text-sm border rounded hover:bg-gray-100"
                >
                  + Add Range
                </button>
              </div>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Min</th>
                    <th className="p-2 text-left">Max</th>
                    <th className="p-2 text-left">Score</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((t, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.min}
                          onChange={(e) => updateRange(i, "min", Number(e.target.value))}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.max}
                          onChange={(e) => updateRange(i, "max", Number(e.target.value))}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.score}
                          onChange={(e) => updateRange(i, "score", Number(e.target.value))}
                          className="w-full border rounded p-1"
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
            </div>
          </>
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
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Save Config
          </button>
          <button
            onClick={applyScoring}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Apply Scoring
          </button>
        </div>
      </div>
    </div>
  );
}
