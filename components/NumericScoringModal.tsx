"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NumericScoringModal({ dataset, instance, onClose, onSaved }: any) {
  const [method, setMethod] = useState<"Normalization" | "Thresholds">("Normalization");
  const [scaleMax, setScaleMax] = useState(5);
  const [inverse, setInverse] = useState(false);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [preview, setPreview] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [useNational, setUseNational] = useState(false); // future option

  // --- Load existing saved config
  useEffect(() => {
    const loadConfig = async () => {
      const { data, error } = await supabase
        .from("instance_dataset_config")
        .select("score_config")
        .eq("instance_id", instance.id)
        .eq("dataset_id", dataset.id)
        .single();

      if (error) return console.warn("No existing score config found:", error.message);

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

  // --- Save configuration
  const saveConfig = async () => {
    setSaving(true);
    setMessage("");

    const config = { method, scaleMax, inverse, thresholds, useNational };

    const { error } = await supabase
      .from("instance_dataset_config")
      .update({
        scoring_method: method.toLowerCase(),
        normalize_max: scaleMax,
        higher_is_worse: inverse,
        score_config: config,
      })
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id);

    if (error) setMessage(`❌ Error saving config: ${error.message}`);
    else setMessage("✅ Config saved!");
    setSaving(false);
  };

  // --- Preview sample stats
  const loadPreview = async () => {
    setMessage("Loading preview...");
    const { data, error } = await supabase
      .rpc("get_numeric_dataset_preview", {
        in_dataset_id: dataset.id,
        in_instance_id: instance.id,
      });
    if (error) {
      console.error(error);
      setMessage("❌ Failed to load preview");
      return;
    }
    setPreview(data);
    setMessage("");
  };

  // --- Apply scoring
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
        in_use_national: useNational,
      });
    } else {
      rpcResponse = await supabase.rpc("score_numeric_thresholds", {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_rules: thresholds,
        in_use_national: useNational,
      });
    }

    if (rpcResponse.error) {
      console.error(rpcResponse.error);
      setMessage(`❌ Error running scoring: ${rpcResponse.error.message}`);
    } else {
      setMessage("✅ Scoring complete!");
      if (onSaved) onSaved();
    }
    setSaving(false);
  };

  const addRange = () => setThresholds([...thresholds, { min: 0, max: 0, score: 1 }]);
  const updateRange = (i: number, key: string, val: any) => {
    const updated = [...thresholds];
    updated[i][key] = val;
    setThresholds(updated);
  };
  const removeRange = (i: number) => setThresholds(thresholds.filter((_, idx) => i !== idx));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[700px] p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">{dataset.name}</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Scoring Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="border rounded p-2 w-full"
            >
              <option value="Normalization">Normalization</option>
              <option value="Thresholds">Thresholds</option>
            </select>
          </div>

          {method === "Normalization" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Scale (max score)
                </label>
                <select
                  value={scaleMax}
                  onChange={(e) => setScaleMax(Number(e.target.value))}
                  className="border rounded p-2 w-full"
                >
                  {[3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      1–{v}
                    </option>
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
                Higher values mean more vulnerability
              </label>
            </>
          )}

          {method === "Thresholds" && (
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium text-sm text-gray-700">Threshold Ranges</span>
                <button
                  onClick={addRange}
                  className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
                >
                  + Add
                </button>
              </div>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2">Min</th>
                    <th className="p-2">Max</th>
                    <th className="p-2">Score</th>
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
          )}
        </div>

        {/* --- Preview Section --- */}
        <div className="mt-4 border-t pt-3 text-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-700">Preview (affected area)</span>
            <button
              onClick={loadPreview}
              className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>
          {preview ? (
            <div className="grid grid-cols-4 gap-2">
              <PreviewCard label="Count" value={preview.count} />
              <PreviewCard label="Min" value={preview.min?.toFixed(2)} />
              <PreviewCard label="Max" value={preview.max?.toFixed(2)} />
              <PreviewCard label="Average" value={preview.avg?.toFixed(2)} />
            </div>
          ) : (
            <p className="text-gray-500">No preview loaded</p>
          )}
        </div>

        {/* --- Footer --- */}
        <div className="flex justify-end mt-5 gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">
            Close
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={applyScoring}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Apply
          </button>
        </div>

        {message && (
          <p className={`mt-3 text-sm ${message.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

const PreviewCard = ({ label, value }: { label: string; value: any }) => (
  <div className="bg-gray-50 border rounded p-2 text-center">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="font-semibold">{value ?? "—"}</p>
  </div>
);
