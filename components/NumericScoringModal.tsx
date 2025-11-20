"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface NumericScoringModalProps {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved?: () => void;
}

// Instance target admin level (currently ADM3)
const INSTANCE_TARGET_LEVEL = "ADM3";

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
  const [scope, setScope] = useState("affected"); // "affected" or "country"
  const [preview, setPreview] = useState<any>(null);
  const [dataPreview, setDataPreview] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingDataPreview, setLoadingDataPreview] = useState(false);

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
      if (cfg.scope) setScope(cfg.scope);
    };
    loadConfig();
  }, [instance.id, dataset.id]);

  // ✅ Save config
  const saveConfig = async () => {
    setSaving(true);
    const config = { method, scaleMax, inverse, thresholds, scope };

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

  // ✅ Apply scoring (calls unified RPC)
  const applyScoring = async () => {
    setSaving(true);
    setMessage("Running scoring...");

    const limitToAffected = scope === "affected";

    const { error } = await supabase.rpc("score_numeric_auto", {
      in_instance_id: instance.id,
      in_dataset_id: dataset.id,
      in_method: method,
      in_thresholds: thresholds,
      in_scale_max: scaleMax,
      in_inverse: inverse,
      in_limit_to_affected: limitToAffected,
    });

    if (error) {
      setMessage(`❌ Error running scoring: ${error.message}`);
      console.error(error);
    } else {
      setMessage("✅ Scoring complete!");
      await previewScores(); // auto-refresh preview
      if (onSaved) onSaved();
    }

    setSaving(false);
  };

  // ✅ Preview stats (after scoring)
  const previewScores = async () => {
    setMessage("Loading preview...");
    const { data, error } = await supabase
      .from("instance_dataset_scores")
      .select("score")
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id);

    if (error || !data?.length) {
      setMessage("❌ Error generating preview or no data found.");
      return;
    }

    const scores = data.map((d: any) => d.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg =
      scores.reduce((sum: number, val: number) => sum + val, 0) / scores.length;

    setPreview({
      count: scores.length,
      min: min.toFixed(2),
      max: max.toFixed(2),
      avg: avg.toFixed(2),
    });

    setMessage("✅ Preview updated.");
  };

  // ✅ Load data preview (before scoring) to see distribution
  const loadDataPreview = async () => {
    setLoadingDataPreview(true);
    try {
      const { data, error } = await supabase
        .from("dataset_values_numeric")
        .select("value")
        .eq("dataset_id", dataset.id)
        .limit(1000); // Sample for preview

      if (error || !data?.length) {
        setDataPreview(null);
        return;
      }

      const values = data.map((d: any) => Number(d.value)).filter((v) => !isNaN(v));
      if (values.length === 0) {
        setDataPreview(null);
        return;
      }

      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const median = sorted[Math.floor(sorted.length / 2)];
      const p25 = sorted[Math.floor(sorted.length * 0.25)];
      const p75 = sorted[Math.floor(sorted.length * 0.75)];
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

      setDataPreview({
        count: values.length,
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2),
        median: median.toFixed(2),
        p25: p25.toFixed(2),
        p75: p75.toFixed(2),
      });
    } catch (err) {
      console.error("Error loading data preview:", err);
      setDataPreview(null);
    } finally {
      setLoadingDataPreview(false);
    }
  };

  // Load data preview on mount
  useEffect(() => {
    loadDataPreview();
  }, [dataset.id]);

  const addRange = () =>
    setThresholds([...thresholds, { min: 0, max: 0, score: 1 }]);

  const updateRange = (idx: number, key: string, value: any) => {
    const updated = [...thresholds];
    updated[idx][key] = value;
    setThresholds(updated);
  };

  const removeRange = (idx: number) =>
    setThresholds(thresholds.filter((_, i) => i !== idx));

  // Check if admin level transformation is needed
  const needsTransformation = dataset.admin_level !== INSTANCE_TARGET_LEVEL;
  const transformationType =
    dataset.admin_level > INSTANCE_TARGET_LEVEL ? "rollup" : "disaggregation";

  // Validate thresholds
  const validateThresholds = () => {
    if (thresholds.length === 0) return true;
    const sorted = [...thresholds].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].min >= sorted[i].max) {
        return false; // Invalid range
      }
      if (i > 0 && sorted[i].min < sorted[i - 1].max) {
        return false; // Overlapping ranges
      }
    }
    return true;
  };

  const thresholdsValid = validateThresholds();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[90vh] overflow-y-auto p-6 relative text-gray-800">
        {/* Header */}
        <div className="mb-4 border-b pb-3">
          <h2 className="text-lg font-semibold mb-1">{dataset.name}</h2>
          {dataset.category && (
            <p className="text-sm text-gray-600">Category: {dataset.category}</p>
          )}
        </div>

        {/* Admin Level Warning */}
        {needsTransformation && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start">
              <span className="text-amber-600 mr-2">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  Admin Level Transformation Required
                </p>
                <p className="text-xs text-amber-700">
                  Dataset is at <strong>{dataset.admin_level}</strong> level, but this instance
                  works at <strong>{INSTANCE_TARGET_LEVEL}</strong> level. Data will be{" "}
                  <strong>{transformationType === "rollup" ? "rolled up" : "disaggregated"}</strong>{" "}
                  to {INSTANCE_TARGET_LEVEL} before scoring.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scoring Level Indicator */}
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
          <span className="font-medium text-blue-800">Scoring will be performed at: </span>
          <span className="text-blue-700">{INSTANCE_TARGET_LEVEL} level</span>
        </div>

        {/* Method Selection */}
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

        {/* Scope Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Normalization Scope:</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="border rounded p-2 w-full text-sm mb-1"
          >
            <option value="affected">Affected Area Only</option>
            <option value="country">Entire Country</option>
          </select>
          <p className="text-xs text-gray-600 mt-1">
            {method === "Normalization" ? (
              <>
                <strong>Affected Area:</strong> Normalization uses min/max from only the affected
                area (may have smaller range). <strong>Entire Country:</strong> Uses national
                min/max (wider range, more context).
              </>
            ) : (
              "Threshold ranges apply the same regardless of scope selection."
            )}
          </p>
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

            <div className="mb-3 p-2 bg-gray-50 border rounded">
              <label className="inline-flex items-center text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={inverse}
                  onChange={(e) => setInverse(e.target.checked)}
                  className="mr-2"
                />
                <span className="font-medium">Higher values = Higher scores (more severe)</span>
              </label>
              <p className="text-xs text-gray-600 mt-1 ml-6">
                {inverse
                  ? "✓ Checked: Higher values will score higher (e.g., poverty rate 20% scores higher than 10%)"
                  : "Unchecked: Lower values will score higher (inverse relationship)"}
              </p>
            </div>
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
            {!thresholdsValid && thresholds.length > 0 && (
              <p className="text-xs text-red-600 mb-2 bg-red-50 p-2 rounded">
                ⚠️ Invalid thresholds: Ranges must not overlap and min must be less than max.
              </p>
            )}
            {thresholds.length === 0 ? (
              <p className="text-sm text-gray-500 italic p-2 bg-gray-50 rounded">
                No thresholds defined. Click "+ Add Range" to create threshold ranges (e.g., 0-300
                → score 3, 300-1500 → score 2, 1500+ → score 1).
              </p>
            ) : (
              <table className="w-full text-sm border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Min Value</th>
                    <th className="p-2 text-left">Max Value</th>
                    <th className="p-2 text-left">Score (1-{scaleMax})</th>
                    <th className="p-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((t, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={t.min}
                          onChange={(e) =>
                            updateRange(i, "min", Number(e.target.value))
                          }
                          className="w-full border rounded p-1 text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={t.max}
                          onChange={(e) =>
                            updateRange(i, "max", Number(e.target.value))
                          }
                          className="w-full border rounded p-1 text-sm"
                          placeholder="∞"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          max={scaleMax}
                          value={t.score}
                          onChange={(e) =>
                            updateRange(i, "score", Number(e.target.value))
                          }
                          className="w-full border rounded p-1 text-sm"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removeRange(i)}
                          className="text-red-500 hover:text-red-700 text-lg"
                          title="Remove range"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Data Preview (before scoring) */}
        {dataPreview && (
          <div className="mb-4 p-3 border rounded bg-blue-50 text-sm">
            <h4 className="font-medium mb-2 text-blue-800">Dataset Value Distribution</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-blue-600">Count</div>
                <div className="font-semibold">{dataPreview.count}</div>
              </div>
              <div>
                <div className="text-blue-600">Min</div>
                <div className="font-semibold">{dataPreview.min}</div>
              </div>
              <div>
                <div className="text-blue-600">Max</div>
                <div className="font-semibold">{dataPreview.max}</div>
              </div>
              <div>
                <div className="text-blue-600">Average</div>
                <div className="font-semibold">{dataPreview.avg}</div>
              </div>
              <div>
                <div className="text-blue-600">Median</div>
                <div className="font-semibold">{dataPreview.median}</div>
              </div>
              <div>
                <div className="text-blue-600">Range</div>
                <div className="font-semibold">
                  {dataPreview.p25} - {dataPreview.p75}
                </div>
              </div>
            </div>
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
            disabled={saving || (method === "Thresholds" && (!thresholdsValid || thresholds.length === 0))}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            title={method === "Thresholds" && (!thresholdsValid || thresholds.length === 0) ? "Please add valid threshold ranges" : ""}
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
