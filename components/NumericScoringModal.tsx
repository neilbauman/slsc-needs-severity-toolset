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
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);
  const [disaggregationMethod, setDisaggregationMethod] = useState<string>("inherit"); // "inherit" or "distribute"
  const [weightDatasetId, setWeightDatasetId] = useState<string | null>(null);
  const [availableDatasets, setAvailableDatasets] = useState<any[]>([]);

  // ✅ Load existing config
  useEffect(() => {
    if (!instance?.id || !dataset?.id) return;

    const loadConfig = async () => {
      // Use maybeSingle() instead of single() to handle no rows gracefully
      const { data, error } = await supabase
        .from("instance_dataset_config")
        .select("score_config")
        .eq("instance_id", instance.id)
        .eq("dataset_id", dataset.id)
        .maybeSingle();

      if (error) {
        // Only log if it's not a "no rows" error
        if (error.code !== "PGRST116") {
          console.warn("Error loading score config:", error.message);
        }
      }

      // Check if scores exist anyway (might have been scored without config saved)
      if (!data || !data.score_config) {
        const { data: scoresData } = await supabase
          .from("instance_dataset_scores")
          .select("id")
          .eq("instance_id", instance.id)
          .eq("dataset_id", dataset.id)
          .limit(1);
        
        if (scoresData && scoresData.length > 0) {
          setMessage("⚠️ This dataset has been scored, but no configuration was saved. Using defaults.");
        }
        return;
      }

      const cfg = data.score_config || {};
      if (cfg.method) setMethod(cfg.method);
      if (cfg.scaleMax) setScaleMax(cfg.scaleMax);
      if (cfg.inverse !== undefined) setInverse(cfg.inverse);
      if (cfg.thresholds?.length) setThresholds(cfg.thresholds);
      if (cfg.scope) {
        setScope(cfg.scope);
        // Check if scores exist and scope might have changed
        const { data: scoresData } = await supabase
          .from("instance_dataset_scores")
          .select("id")
          .eq("instance_id", instance.id)
          .eq("dataset_id", dataset.id)
          .limit(1);
        
        if (scoresData && scoresData.length > 0 && cfg.scope !== scope) {
          setScopeWarning("⚠️ Scores exist but scope setting changed. Re-apply scoring to update.");
        }
      }
      if (cfg.disaggregationMethod) setDisaggregationMethod(cfg.disaggregationMethod);
      if (cfg.weightDatasetId) setWeightDatasetId(cfg.weightDatasetId);
      
      // Show message if config was loaded
      if (Object.keys(cfg).length > 0) {
        setMessage("✅ Loaded existing scoring configuration");
        setTimeout(() => setMessage(""), 3000); // Clear after 3 seconds
      }
    };
    loadConfig();
  }, [instance?.id, dataset?.id]);

  // ✅ Warn if scope changes after scores exist
  useEffect(() => {
    if (!instance?.id || !dataset?.id) return;
    
    const checkScores = async () => {
      const { data: scoresData } = await supabase
        .from("instance_dataset_scores")
        .select("id")
        .eq("instance_id", instance.id)
        .eq("dataset_id", dataset.id)
        .limit(1);
      
      if (scoresData && scoresData.length > 0) {
        // Check if current scope matches saved config
        const { data: configData } = await supabase
          .from("instance_dataset_config")
          .select("score_config")
          .eq("instance_id", instance.id)
          .eq("dataset_id", dataset.id)
          .maybeSingle();
        
        const savedScope = configData?.score_config?.scope;
        if (savedScope && savedScope !== scope) {
          setScopeWarning("⚠️ Scope changed from saved config. Re-apply scoring to update scores with new scope.");
        } else {
          setScopeWarning(null);
        }
      } else {
        setScopeWarning(null);
      }
    };
    
    // Debounce scope changes
    const timer = setTimeout(checkScores, 500);
    return () => clearTimeout(timer);
  }, [scope, instance?.id, dataset?.id]);

  // Load available datasets for weight selection (only numeric datasets at ADM3 or ADM4)
  useEffect(() => {
    if (!instance?.id) return;
    
    const loadDatasets = async () => {
      const { data, error } = await supabase
        .from("instance_datasets")
        .select("dataset_id, datasets!inner(id, name, admin_level, type)")
        .eq("instance_id", instance.id);
      
      if (error) {
        console.warn("Error loading datasets:", error);
        return;
      }
      
      // Filter to numeric datasets at ADM3 or ADM4 (for population weighting)
      const numericDatasets = (data || [])
        .map((d: any) => d.datasets)
        .filter((d: any) => 
          d.type === 'numeric' && 
          (d.admin_level === 'ADM3' || d.admin_level === 'ADM4') &&
          d.id !== dataset?.id // Exclude current dataset
        );
      
      setAvailableDatasets(numericDatasets);
    };
    
    loadDatasets();
  }, [instance?.id, dataset?.id]);

  // ✅ Save config (upsert to handle both insert and update)
  const saveConfig = async () => {
    setSaving(true);
    const config = { 
      method, 
      scaleMax, 
      inverse, 
      thresholds, 
      scope,
      disaggregationMethod: transformationType === "disaggregation" ? disaggregationMethod : undefined,
      weightDatasetId: transformationType === "disaggregation" && disaggregationMethod === "distribute" ? weightDatasetId : undefined,
    };

    // Map method to database format (normalize to lowercase)
    const scoringMethod = method.toLowerCase();

    // Use upsert to handle both new and existing configs
    // Include scoring_method column if the table requires it
    const { error } = await supabase
      .from("instance_dataset_config")
      .upsert(
        {
          instance_id: instance.id,
          dataset_id: dataset.id,
          scoring_method: scoringMethod, // Required column
          score_config: config, // JSONB with full config
        },
        {
          onConflict: "instance_id,dataset_id",
        }
      );

    if (error) {
      setMessage(`❌ Error saving config: ${error.message}`);
      console.error("Save config error:", error);
    } else {
      setMessage("✅ Config saved! (Note: This does not apply scoring - use 'Apply Scoring' button)");
      if (onSaved) onSaved();
    }
    setSaving(false);
  };

  // ✅ Apply scoring (calls unified RPC)
  const applyScoring = async () => {
    setSaving(true);
    setMessage("Deleting old scores...");

    // Delete existing scores for this dataset/instance combination
    // This ensures we replace old scores rather than creating duplicates
    // TODO: In the future, check if affected area has changed, as this may affect
    // normalization ranges and should trigger a recalculation even if config hasn't changed
    const { error: deleteError } = await supabase
      .from("instance_dataset_scores")
      .delete()
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id);

    if (deleteError) {
      console.warn("Warning: Could not delete old scores:", deleteError);
      // Continue anyway - the RPC might handle it
    }

    setMessage("Running scoring...");
    const limitToAffected = scope === "affected";

    // Map method name to what RPC expects
    // The RPC expects: 'minmax' for normalization, 'threshold' (singular) for thresholds
    const rpcMethod = method === "Normalization" 
      ? "minmax" 
      : method === "Thresholds" 
        ? "threshold" 
        : method.toLowerCase();

    console.log("Applying scoring with:", {
      method: rpcMethod,
      scaleMax,
      inverse,
      scope,
      limitToAffected,
      thresholdsCount: thresholds.length,
      instanceId: instance.id,
      datasetId: dataset.id,
    });

    // Try calling with new parameters first (for disaggregation support)
    let rpcData, error;
    if (transformationType === "disaggregation") {
      // Use new function signature with disaggregation parameters
      const result = await supabase.rpc("score_numeric_auto", {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_method: rpcMethod,
        in_thresholds: thresholds.length > 0 ? thresholds : null,
        in_scale_max: scaleMax,
        in_inverse: inverse,
        in_limit_to_affected: limitToAffected,
        in_disaggregation_method: disaggregationMethod || null,
        in_weight_dataset_id: disaggregationMethod === "distribute" ? weightDatasetId : null,
      });
      rpcData = result.data;
      error = result.error;
    } else {
      // For roll-up or no transformation, try new signature first, fall back to old if needed
      const result = await supabase.rpc("score_numeric_auto", {
        in_instance_id: instance.id,
        in_dataset_id: dataset.id,
        in_method: rpcMethod,
        in_thresholds: thresholds.length > 0 ? thresholds : null,
        in_scale_max: scaleMax,
        in_inverse: inverse,
        in_limit_to_affected: limitToAffected,
        in_disaggregation_method: null,
        in_weight_dataset_id: null,
      });
      rpcData = result.data;
      error = result.error;
      
      // If error is about function signature, try old signature (backward compatibility)
      if (error && (error.message?.includes("function") || error.message?.includes("signature"))) {
        console.warn("New function signature not found, trying old signature...");
        const oldResult = await supabase.rpc("score_numeric_auto", {
          in_instance_id: instance.id,
          in_dataset_id: dataset.id,
          in_method: rpcMethod,
          in_thresholds: thresholds.length > 0 ? thresholds : null,
          in_scale_max: scaleMax,
          in_inverse: inverse,
          in_limit_to_affected: limitToAffected,
        });
        rpcData = oldResult.data;
        error = oldResult.error;
        if (!error) {
          setMessage("⚠️ Using old RPC function. Please update the function in Supabase for disaggregation support.");
        }
      }
    }

    if (error) {
      const errorMsg = error.message || "Unknown error";
      setMessage(`❌ Error running scoring: ${errorMsg}`);
      console.error("RPC error details:", {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        parameters: {
          method: rpcMethod,
          scaleMax,
          limitToAffected,
          disaggregationMethod: transformationType === "disaggregation" ? disaggregationMethod : null,
        }
      });
      
      // If it's a function signature error, provide helpful message
      if (error.message?.includes("function") || error.message?.includes("signature") || error.code === "42883") {
        setMessage(
          `❌ Function signature mismatch. The RPC function in Supabase needs to be updated. ` +
          `Please apply the updated score_numeric_auto.sql file to your Supabase database.`
        );
      } else if (error.code === "PGRST301" || error.message?.includes("500")) {
        setMessage(
          `❌ Server error (500): The scoring RPC may have an issue. ` +
          `Check Supabase logs. Parameters sent: method=${rpcMethod}, scaleMax=${scaleMax}, limitToAffected=${limitToAffected}`
        );
      }
    } else {
      console.log("RPC returned successfully:", rpcData);
      setMessage("✅ Scoring complete! Old scores replaced with new ones.");
      await previewScores(); // auto-refresh preview
      if (onSaved) onSaved();
    }

    setSaving(false);
  };

  // ✅ Preview stats (after scoring)
  const previewScores = async () => {
    setMessage("Loading preview...");
    
    // Build query for scores - use count for accurate totals
    let query = supabase
      .from("instance_dataset_scores")
      .select("score, admin_pcode", { count: "exact" })
      .eq("instance_id", instance.id)
      .eq("dataset_id", dataset.id);

    // If scope is "affected", filter by affected ADM3 codes
    let affectedAdm3Codes: string[] = [];
    if (scope === "affected" && instance?.admin_scope && Array.isArray(instance.admin_scope) && instance.admin_scope.length > 0) {
      // Get ADM3 codes from affected ADM2 areas
      const { data: adm3Data, error: adm3Error } = await supabase.rpc("get_affected_adm3", {
        in_scope: instance.admin_scope, // ADM2 codes
      });

      if (!adm3Error && adm3Data && Array.isArray(adm3Data)) {
        affectedAdm3Codes = adm3Data.map((row: any) => row.admin_pcode || row.pcode || row.code).filter(Boolean);
        if (affectedAdm3Codes.length > 0) {
          query = query.in("admin_pcode", affectedAdm3Codes);
        }
      }
    }

    // Fetch all scores (paginate if needed)
    const batchSize = 1000;
    let allScores: any[] = [];
    let hasMore = true;
    let offset = 0;
    
    while (hasMore) {
      const batchQuery = query.range(offset, offset + batchSize - 1);
      const { data: batchData, error: batchError, count } = await batchQuery;
      
      if (batchError) {
        setMessage(`❌ Error generating preview: ${batchError.message}`);
        return;
      }
      
      if (batchData && batchData.length > 0) {
        allScores = [...allScores, ...batchData];
        offset += batchSize;
        
        // If we got fewer rows than batchSize, we're done
        if (batchData.length < batchSize || (count !== null && allScores.length >= count)) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
      
      // Safety limit
      if (allScores.length >= 10000) {
        hasMore = false;
      }
    }

    if (allScores.length === 0) {
      setMessage("❌ No scores found. Apply scoring first. Check browser console for errors.");
      console.error("No scores found after applying scoring. This could indicate:");
      console.error("1. The RPC function may not have been updated in Supabase");
      console.error("2. The scoring operation may have failed silently");
      console.error("3. The dataset may not have data at the expected admin level");
      return;
    }

    const scores = allScores.map((d: any) => Number(d.score)).filter((s) => !isNaN(s));
    if (scores.length === 0) {
      setMessage("❌ No valid scores found.");
      return;
    }

    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((sum: number, val: number) => sum + val, 0) / scores.length;

    // Log diagnostic info for debugging normalization issues
    console.log("Preview scores:", {
      scope,
      count: scores.length,
      min,
      max,
      avg,
      scaleMax,
      method,
      affectedAdm3Count: affectedAdm3Codes.length,
      expectedRange: `1-${scaleMax}`,
    });

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
    if (!dataset?.id || !instance?.id) return;
    
    setLoadingDataPreview(true);
    try {
      // If scope is "affected", get affected ADM3 codes first
      let affectedAdm3Codes: string[] = [];
      if (scope === "affected" && instance?.admin_scope && Array.isArray(instance.admin_scope) && instance.admin_scope.length > 0) {
        // Get ADM3 codes from affected ADM2 areas
        const { data: adm3Data, error: adm3Error } = await supabase.rpc("get_affected_adm3", {
          in_scope: instance.admin_scope, // ADM2 codes
        });

        if (adm3Error) {
          console.error("Error getting affected ADM3 codes:", adm3Error);
        } else if (adm3Data && Array.isArray(adm3Data)) {
          affectedAdm3Codes = adm3Data.map((row: any) => {
            // Handle different possible field names
            return row.admin_pcode || row.pcode || row.code || null;
          }).filter(Boolean);
        }
      }

      // For ADM2 datasets that need disaggregation, show ADM2 values (which will be inherited)
      const datasetLevel = dataset?.admin_level ? String(dataset.admin_level).trim().toUpperCase() : "";
      const needsDisaggregation = datasetLevel === "ADM2";
      
      let allData: any[] = [];
      
      if (needsDisaggregation) {
        // For ADM2 datasets, show ALL ADM2 values in the dataset for preview
        // (not just affected ones, so user can see full distribution)
        // Note: Only affected ADM2s will be scored, but preview shows all for context
        let query = supabase
          .from("dataset_values_numeric")
          .select("value, admin_pcode", { count: "exact" })
          .eq("dataset_id", dataset.id);
        
        // Don't filter by affected area for preview - show all values
        // The actual scoring will filter correctly
        
        const batchSize = 1000;
        let hasMore = true;
        let offset = 0;
        
        while (hasMore) {
          const batchQuery = query.range(offset, offset + batchSize - 1);
          const { data: batchData, error: batchError, count } = await batchQuery;
          
          if (batchError) {
            console.error("Error loading ADM2 data:", batchError);
            setDataPreview(null);
            return;
          }
          
          if (batchData && batchData.length > 0) {
            allData = [...allData, ...batchData];
            offset += batchSize;
            
            if (batchData.length < batchSize || (count !== null && allData.length >= count)) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
          
          if (allData.length >= 10000) {
            hasMore = false;
          }
        }
      } else {
        // Build query - use count for accurate totals
        let query = supabase
          .from("dataset_values_numeric")
          .select("value, admin_pcode", { count: "exact" })
          .eq("dataset_id", dataset.id);

        // Filter by affected area if scope is "affected" and we have codes
        if (scope === "affected" && affectedAdm3Codes.length > 0) {
          query = query.in("admin_pcode", affectedAdm3Codes);
        }
        // For "country" scope, don't filter - get all data

        // Fetch data - for country scope, we need to handle large datasets
        // Supabase default limit is 1000, so we need to paginate
        const batchSize = 1000;
        let hasMore = true;
        let offset = 0;
        
        while (hasMore) {
          const batchQuery = query.range(offset, offset + batchSize - 1);
          const { data: batchData, error: batchError, count } = await batchQuery;
          
          if (batchError) {
            console.error("Error loading data preview:", batchError);
            setDataPreview(null);
            return;
          }
          
          if (batchData && batchData.length > 0) {
            allData = [...allData, ...batchData];
            offset += batchSize;
            
            // If we got fewer rows than batchSize, we're done
            // Or if count is available and we've fetched all rows
            if (batchData.length < batchSize || (count !== null && allData.length >= count)) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
          
          // Safety limit: don't fetch more than 10,000 rows for preview
          if (allData.length >= 10000) {
            hasMore = false;
          }
        }
      }

      if (allData.length === 0) {
        setDataPreview(null);
        return;
      }

      const values = allData.map((d: any) => Number(d.value)).filter((v) => !isNaN(v));
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

      // Use actual count of values we processed
      const totalCount = values.length;

      setDataPreview({
        count: totalCount,
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2),
        median: median.toFixed(2),
        p25: p25.toFixed(2),
        p75: p75.toFixed(2),
        scope: scope === "affected" ? "affected area" : "entire country",
        note: needsDisaggregation 
          ? (scope === "affected" && instance?.admin_scope?.length 
              ? `Showing all ADM2 values in dataset. Only ${instance.admin_scope.length} ADM2(s) in affected area will be scored.`
              : "Showing ADM2 values (will be inherited by ADM3s)")
          : undefined,
      });
    } catch (err) {
      console.error("Error loading data preview:", err);
      setDataPreview(null);
    } finally {
      setLoadingDataPreview(false);
    }
  };

  // Load data preview when dataset, scope, or instance changes
  // Note: We intentionally don't reload when scaleMax changes - that doesn't affect the raw data distribution
  useEffect(() => {
    if (dataset?.id && instance?.id) {
      loadDataPreview();
    }
  }, [dataset?.id, scope, instance?.admin_scope]);

  const addRange = () =>
    setThresholds([...thresholds, { min: 0, max: null, score: 1 }]);

  const updateRange = (idx: number, key: string, value: any) => {
    const updated = [...thresholds];
    updated[idx][key] = value;
    setThresholds(updated);
  };

  const removeRange = (idx: number) =>
    setThresholds(thresholds.filter((_, i) => i !== idx));

  // Check if admin level transformation is needed (case-insensitive comparison)
  // Normalize both to uppercase and trim whitespace
  const datasetLevel = dataset?.admin_level ? String(dataset.admin_level).trim().toUpperCase() : "";
  const targetLevel = INSTANCE_TARGET_LEVEL.trim().toUpperCase();
  const needsTransformation = datasetLevel && targetLevel && datasetLevel !== targetLevel;
  
  // Determine transformation type based on admin level hierarchy
  // ADM1 > ADM2 > ADM3 > ADM4 (higher number = lower level)
  const getLevelNumber = (level: string) => {
    const l = level.toUpperCase().trim();
    if (l === "ADM1") return 1;
    if (l === "ADM2") return 2;
    if (l === "ADM3") return 3;
    if (l === "ADM4") return 4;
    return 0;
  };
  
  const transformationType = needsTransformation
    ? getLevelNumber(datasetLevel) > getLevelNumber(targetLevel) ? "rollup" : "disaggregation"
    : null;

  // Validate thresholds
  const validateThresholds = () => {
    if (thresholds.length === 0) return true;
    const sorted = [...thresholds].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length; i++) {
      const threshold = sorted[i];
      // Allow empty/null max for the last threshold only (represents "no upper limit")
      const isLastThreshold = i === sorted.length - 1;
      const maxIsEmpty = threshold.max == null || threshold.max === '' || (typeof threshold.max === 'number' && isNaN(threshold.max));
      
      // For non-last thresholds, max must be set and greater than min
      if (!isLastThreshold) {
        if (maxIsEmpty || threshold.min >= threshold.max) {
          return false; // Invalid range
        }
      } else {
        // Last threshold: if max is set, it must be greater than min; if empty, that's OK
        if (!maxIsEmpty && threshold.min >= threshold.max) {
          return false; // Invalid range
        }
      }
      
      // Check for overlapping ranges (non-adjacent)
      if (i > 0) {
        const prevMax = sorted[i - 1].max;
        // Previous threshold's max must be less than or equal to current min
        // (allowing equality means ranges can be adjacent: [0-100], [100-200])
        if (prevMax != null && prevMax !== '' && !isNaN(prevMax) && threshold.min < prevMax) {
          return false; // Overlapping ranges
        }
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
        {needsTransformation && transformationType && (
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

        {/* Disaggregation Method Selection (only shown for ADM2 datasets) */}
        {needsTransformation && transformationType === "disaggregation" && (
          <div className="mb-4 p-3 border rounded bg-gray-50">
            <label className="block text-sm font-medium mb-2">
              Disaggregation Method:
            </label>
            <select
              value={disaggregationMethod}
              onChange={(e) => setDisaggregationMethod(e.target.value)}
              className="border rounded p-2 w-full text-sm mb-2"
            >
              <option value="inherit">Inherit (all ADM3s get same value as parent ADM2)</option>
              <option value="distribute">Distribute (weighted by population)</option>
            </select>
            {disaggregationMethod === "distribute" && (
              <div className="mt-2">
                <label className="block text-sm font-medium mb-1">
                  Population Dataset (for weighting):
                </label>
                <select
                  value={weightDatasetId || ""}
                  onChange={(e) => setWeightDatasetId(e.target.value || null)}
                  className="border rounded p-2 w-full text-sm"
                >
                  <option value="">-- Select population dataset --</option>
                  {availableDatasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.admin_level})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  Select a numeric dataset at ADM3 or ADM4 level to use for population-weighted distribution.
                </p>
              </div>
            )}
          </div>
        )}

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
            onChange={(e) => {
              setScope(e.target.value);
              setScopeWarning(null); // Clear warning when user actively changes
            }}
            className="border rounded p-2 w-full text-sm mb-1"
          >
            <option value="affected">Affected Area Only</option>
            <option value="country">Entire Country</option>
          </select>
          {scopeWarning && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              {scopeWarning}
            </div>
          )}
          <p className="text-xs text-gray-600 mt-1">
            {method === "Normalization" ? (
              <>
                <strong>Affected Area:</strong> Normalization uses min/max from only the affected
                area (should span 1-{scaleMax}). <strong>Entire Country:</strong> Uses national
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
                          value={t.max === null || t.max === 0 || t.max === '' ? '' : t.max}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow empty string for "no upper limit" (last threshold)
                            updateRange(i, "max", val === '' ? null : Number(val));
                          }}
                          className="w-full border rounded p-1 text-sm"
                          placeholder={i === thresholds.length - 1 ? "∞ (optional)" : "∞"}
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
            <h4 className="font-medium mb-2 text-blue-800">
              Dataset Value Distribution
              {dataPreview.scope && (
                <span className="text-xs font-normal text-blue-600 ml-2">
                  ({dataPreview.scope})
                </span>
              )}
            </h4>
            {dataPreview.note && (
              <p className="text-xs text-blue-700 mb-2 italic">{dataPreview.note}</p>
            )}
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
            {method === "Normalization" && (
              <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                <strong>Expected range:</strong> 1.00 to {scaleMax}.00
                {parseFloat(preview.min) !== 1 || parseFloat(preview.max) !== scaleMax ? (
                  <span className="text-orange-600 ml-2 block mt-1">
                    ⚠️ Scores don't span full range (1-{scaleMax}) - may indicate normalization issue in RPC
                  </span>
                ) : (
                  <span className="text-green-600 ml-2">✓ Range looks correct</span>
                )}
              </div>
            )}
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
