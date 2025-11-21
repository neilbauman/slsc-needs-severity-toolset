'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CategoryRow {
  category: string;
  score: number | '';
  totalCount?: number; // Total count across all locations
  sampleLocations?: number; // Number of locations with this category
}

interface LocationPreview {
  admin_pcode: string;
  totalHouses: number;
  scoreDistribution: {
    score1: number;
    score2: number;
    score3: number;
    score4: number;
    score5: number;
  };
  percentages: {
    score1: number;
    score2: number;
    score3: number;
    score4: number;
    score5: number;
  };
  calculatedScore?: number; // Based on selected method
}

interface CategoricalScoringModalProps {
  dataset: any;
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function CategoricalScoringModal({
  dataset,
  instance,
  onClose,
  onSaved,
}: CategoricalScoringModalProps) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [method, setMethod] = useState<
    'twenty_percent' | 'custom_percent' | 'median' | 'mode' | 'weighted_mean'
  >('twenty_percent');
  const [threshold, setThreshold] = useState<number>(0.2);
  const [loading, setLoading] = useState(false);
  const [previewLocations, setPreviewLocations] = useState<LocationPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);


  // Load distinct categories and their numeric values for this dataset
  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('dataset_values_categorical')
        .select('category, value, admin_pcode')
        .eq('dataset_id', dataset.id);

      if (error) {
        console.error('Error loading categories:', error);
        setLoading(false);
        return;
      }

      // Get distinct categories
      const distinct = Array.from(
        new Set(
          (data || [])
            .map((r) => (r.category ? r.category.trim() : null))
            .filter((v) => !!v)
        )
      ).sort();

      // Calculate totals for each category
      const categoryStats = distinct.map((cat) => {
        const categoryData = (data || []).filter(
          (r) => r.category && r.category.trim() === cat
        );
        const totalCount = categoryData.reduce(
          (sum, r) => sum + (Number(r.value) || 0),
          0
        );
        const locationCount = new Set(
          categoryData.map((r) => r.admin_pcode)
        ).size;

        return {
          category: cat,
          score: '' as number | '',
          totalCount,
          sampleLocations: locationCount,
        };
      });

      setRows(categoryStats);
      setLoading(false);

      // After categories are loaded, try to load saved config
      if (instance?.id && dataset?.id) {
        const { data: configData } = await supabase
          .from("instance_dataset_config")
          .select("score_config")
          .eq("instance_id", instance.id)
          .eq("dataset_id", dataset.id)
          .maybeSingle();

        if (configData?.score_config) {
          const cfg = configData.score_config;
          if (cfg.method) setMethod(cfg.method);
          if (cfg.threshold !== undefined) setThreshold(cfg.threshold);
          if (cfg.categoryScores?.length) {
            const savedScores = new Map<string, number>(
              cfg.categoryScores.map((cs: any) => [cs.category, Number(cs.score)])
            );
            setRows((prev) =>
              prev.map((row) => ({
                ...row,
                score: (savedScores.get(row.category) as number | undefined) || '',
              }))
            );
          }
          if (Object.keys(cfg).length > 0) {
            setMessage("✅ Loaded existing scoring configuration");
            setTimeout(() => setMessage(""), 3000);
          }
        }
      }
    };

    if (dataset?.id) loadCategories();
  }, [dataset, instance?.id]);

  // Calculate preview when scores or method changes
  useEffect(() => {
    if (rows.some((r) => r.score !== '')) {
      calculatePreview();
    } else {
      setPreviewLocations([]);
    }
  }, [rows, method, threshold, dataset?.id]);

  const handleScoreChange = (index: number, value: string) => {
    const newRows = [...rows];
    const parsed = value === '' ? '' : Math.max(1, Math.min(5, parseInt(value)));
    newRows[index].score = parsed;
    setRows(newRows);
  };

  // Calculate preview of how scoring will work
  const calculatePreview = async () => {
    if (!dataset?.id) return;

    setLoadingPreview(true);
    try {
      // Get sample locations (first 5 locations with data)
      const { data: locationData, error } = await supabase
        .from('dataset_values_categorical')
        .select('admin_pcode, category, value')
        .eq('dataset_id', dataset.id)
        .limit(1000);

      if (error) {
        console.error('Error loading preview data:', error);
        setLoadingPreview(false);
        return;
      }

      // Build category score map
      const categoryScoreMap = new Map<string, number>();
      rows.forEach((row) => {
        if (row.score !== '') {
          categoryScoreMap.set(row.category, Number(row.score));
        }
      });

      if (categoryScoreMap.size === 0) {
        setPreviewLocations([]);
        setLoadingPreview(false);
        return;
      }

      // Group by location
      const locationMap = new Map<string, Map<string, number>>();
      (locationData || []).forEach((row: any) => {
        if (!locationMap.has(row.admin_pcode)) {
          locationMap.set(row.admin_pcode, new Map());
        }
        const locData = locationMap.get(row.admin_pcode)!;
        const currentValue = Number(locData.get(row.category) || 0);
        locData.set(row.category, currentValue + (Number(row.value) || 0));
      });

      // Calculate score distribution for each location
      const previews: LocationPreview[] = [];
      const locations = Array.from(locationMap.keys()).slice(0, 5); // Show first 5 locations

      locations.forEach((adminPcode) => {
        const locData = locationMap.get(adminPcode)!;
        let totalHouses = 0;
        const scoreCounts = { score1: 0, score2: 0, score3: 0, score4: 0, score5: 0 };

        // Calculate counts by score
        locData.forEach((count, category) => {
          const score = categoryScoreMap.get(category);
          if (score && count > 0) {
            totalHouses += count;
            if (score === 1) scoreCounts.score1 += count;
            else if (score === 2) scoreCounts.score2 += count;
            else if (score === 3) scoreCounts.score3 += count;
            else if (score === 4) scoreCounts.score4 += count;
            else if (score === 5) scoreCounts.score5 += count;
          }
        });

        if (totalHouses === 0) return;

        // Calculate percentages
        const percentages = {
          score1: (scoreCounts.score1 / totalHouses) * 100,
          score2: (scoreCounts.score2 / totalHouses) * 100,
          score3: (scoreCounts.score3 / totalHouses) * 100,
          score4: (scoreCounts.score4 / totalHouses) * 100,
          score5: (scoreCounts.score5 / totalHouses) * 100,
        };

        // Calculate overall score based on method
        let calculatedScore: number | undefined;
        if (method === 'twenty_percent' || method === 'custom_percent') {
          // Find worst score threshold where at least threshold% of population live
          const thresh = method === 'twenty_percent' ? 0.2 : threshold;
          if (percentages.score5 >= thresh * 100) calculatedScore = 5;
          else if (percentages.score4 >= thresh * 100) calculatedScore = 4;
          else if (percentages.score3 >= thresh * 100) calculatedScore = 3;
          else if (percentages.score2 >= thresh * 100) calculatedScore = 2;
          else if (percentages.score1 >= thresh * 100) calculatedScore = 1;
          else calculatedScore = 1; // Default to worst if no threshold met
        } else if (method === 'median') {
          // Find median score (score where cumulative percentage >= 50%)
          let cumulative = 0;
          if (cumulative + percentages.score1 >= 50) calculatedScore = 1;
          else if ((cumulative += percentages.score1) + percentages.score2 >= 50)
            calculatedScore = 2;
          else if ((cumulative += percentages.score2) + percentages.score3 >= 50)
            calculatedScore = 3;
          else if ((cumulative += percentages.score3) + percentages.score4 >= 50)
            calculatedScore = 4;
          else calculatedScore = 5;
        } else if (method === 'mode') {
          // Most prevalent score
          const maxPercent = Math.max(
            percentages.score1,
            percentages.score2,
            percentages.score3,
            percentages.score4,
            percentages.score5
          );
          if (maxPercent === percentages.score5) calculatedScore = 5;
          else if (maxPercent === percentages.score4) calculatedScore = 4;
          else if (maxPercent === percentages.score3) calculatedScore = 3;
          else if (maxPercent === percentages.score2) calculatedScore = 2;
          else calculatedScore = 1;
        } else if (method === 'weighted_mean') {
          // Weighted mean
          const weightedSum =
            scoreCounts.score1 * 1 +
            scoreCounts.score2 * 2 +
            scoreCounts.score3 * 3 +
            scoreCounts.score4 * 4 +
            scoreCounts.score5 * 5;
          calculatedScore = Math.round((weightedSum / totalHouses) * 10) / 10;
        }

        previews.push({
          admin_pcode: adminPcode,
          totalHouses,
          scoreDistribution: scoreCounts,
          percentages,
          calculatedScore,
        });
      });

      setPreviewLocations(previews);
    } catch (err) {
      console.error('Error calculating preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Save config without applying scoring
  const handleSaveConfig = async () => {
    if (!instance?.id || !dataset?.id) return;

    setSaving(true);
    const categoryScores = rows
      .filter((r) => r.score !== '')
      .map((r) => ({
        category: r.category,
        score: Number(r.score),
      }));

    const config = {
      method,
      threshold,
      categoryScores,
    };

    const { error } = await supabase
      .from("instance_dataset_config")
      .upsert(
        {
          instance_id: instance.id,
          dataset_id: dataset.id,
          scoring_method: 'categorical',
          score_config: config,
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
    }
    setSaving(false);
  };

  const handleApplyScoring = async () => {
    if (!instance?.id || !dataset?.id) {
      alert('Missing instance or dataset ID.');
      return;
    }

    // Validate that all categories have scores
    const unscored = rows.filter((r) => r.score === '');
    if (unscored.length > 0) {
      alert(`Please assign scores to all categories. Missing scores for: ${unscored.map((r) => r.category).join(', ')}`);
      return;
    }

    setLoading(true);
    setMessage("Applying scoring...");

    // Filter valid categories
    const categoryScores = rows
      .filter((r) => r.score !== '')
      .map((r) => ({
        category: r.category,
        score: Number(r.score),
      }));

    // Determine if we should limit to affected areas
    const limitToAffected = instance?.admin_scope && Array.isArray(instance.admin_scope) && instance.admin_scope.length > 0;

    const { data, error } = await supabase.rpc('score_building_typology', {
      in_category_scores: categoryScores,
      in_dataset_id: dataset.id,
      in_instance_id: instance.id,
      in_method: method,
      in_threshold: threshold,
      in_limit_to_affected: limitToAffected,
    });

    if (error) {
      console.error('Error applying scoring:', error);
      setMessage(`❌ Error applying scoring: ${error.message}`);
      setLoading(false);
      return;
    }

    console.log('Scoring applied successfully:', data);
    setMessage("✅ Scoring complete! Scores calculated for all locations.");

    // Save config after successful scoring
    await handleSaveConfig();

    // Close and refresh parent modal
    if (onSaved) await onSaved();
    setTimeout(() => {
      onClose();
    }, 1500);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-1">
          {dataset?.name || 'Categorical Dataset'}
        </h2>
        <p className="text-gray-600 mb-4">
          Assign a score (1–5) to each building typology category. The system will calculate the percentage of houses in each location that score 1–5, then determine the overall location score.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Aggregation Method
          </label>
          <select
            value={method}
            onChange={(e) =>
              setMethod(
                e.target.value as
                  | 'twenty_percent'
                  | 'custom_percent'
                  | 'median'
                  | 'mode'
                  | 'weighted_mean'
              )
            }
            className="border border-gray-300 rounded px-3 py-2 w-full"
          >
            <option value="twenty_percent">20% Rule (worst score where ≥20% live)</option>
            <option value="custom_percent">Custom % Rule (worst score where ≥X% live)</option>
            <option value="median">Median (middle score by cumulative percentage)</option>
            <option value="mode">Most Prevalent (most common score)</option>
            <option value="weighted_mean">Weighted Mean (average weighted by counts)</option>
          </select>
          <p className="text-xs text-gray-600 mt-1">
            {method === 'twenty_percent' && 'Finds the worst (highest) score threshold where at least 20% of houses are living. Example: If 25% live in score 4 areas, location gets score 4.'}
            {method === 'custom_percent' && `Finds the worst (highest) score threshold where at least ${(threshold * 100).toFixed(0)}% of houses are living.`}
            {method === 'median' && 'Finds the median score where 50% of houses are at or below this score.'}
            {method === 'mode' && 'Uses the score that represents the highest percentage of houses.'}
            {method === 'weighted_mean' && 'Calculates average score weighted by the number of houses in each category.'}
          </p>
        </div>

        {method === 'custom_percent' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Custom Threshold (% as decimal, e.g., 0.15 for 15%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="border border-gray-300 rounded px-3 py-2 w-full"
            />
            <p className="text-xs text-gray-600 mt-1">
              Finds the worst (highest) score threshold where at least {(threshold * 100).toFixed(0)}% of houses are living.
            </p>
          </div>
        )}

        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Category Scoring</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left p-2 font-medium">Category</th>
                <th className="text-left p-2 font-medium text-xs">Total Count</th>
                <th className="text-left p-2 font-medium text-xs">Locations</th>
                <th className="text-left p-2 font-medium w-32">Score (1–5)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-2 text-gray-800">{row.category}</td>
                  <td className="p-2 text-xs text-gray-600">
                    {row.totalCount !== undefined ? row.totalCount.toLocaleString() : '—'}
                  </td>
                  <td className="p-2 text-xs text-gray-600">
                    {row.sampleLocations !== undefined ? row.sampleLocations : '—'}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={row.score}
                      onChange={(e) => handleScoreChange(i, e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-20"
                      placeholder="1-5"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-600 mt-2">
            <strong>Total Count:</strong> Sum of all numeric values (house counts) for this category across all locations.
            <br />
            <strong>Locations:</strong> Number of administrative areas that have data for this category.
          </p>
        </div>

        {/* Preview Section */}
        {previewLocations.length > 0 && (
          <div className="mb-4 p-3 border rounded bg-blue-50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-blue-800">Preview: Score Calculation</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
            </div>
            {showPreview && (
              <div className="text-xs space-y-3">
                {previewLocations.map((loc, idx) => (
                  <div key={idx} className="border rounded p-2 bg-white">
                    <div className="font-medium mb-1">Location: {loc.admin_pcode}</div>
                    <div className="grid grid-cols-6 gap-2 text-xs">
                      <div>
                        <div className="text-gray-600">Total Houses</div>
                        <div className="font-semibold">{loc.totalHouses.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Score 1</div>
                        <div className="font-semibold">{loc.percentages.score1.toFixed(1)}%</div>
                        <div className="text-gray-500">({loc.scoreDistribution.score1})</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Score 2</div>
                        <div className="font-semibold">{loc.percentages.score2.toFixed(1)}%</div>
                        <div className="text-gray-500">({loc.scoreDistribution.score2})</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Score 3</div>
                        <div className="font-semibold">{loc.percentages.score3.toFixed(1)}%</div>
                        <div className="text-gray-500">({loc.scoreDistribution.score3})</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Score 4</div>
                        <div className="font-semibold">{loc.percentages.score4.toFixed(1)}%</div>
                        <div className="text-gray-500">({loc.scoreDistribution.score4})</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Score 5</div>
                        <div className="font-semibold">{loc.percentages.score5.toFixed(1)}%</div>
                        <div className="text-gray-500">({loc.scoreDistribution.score5})</div>
                      </div>
                    </div>
                    {loc.calculatedScore !== undefined && (
                      <div className="mt-2 pt-2 border-t">
                        <span className="text-gray-600">Calculated Score: </span>
                        <span className="font-bold text-blue-700">{loc.calculatedScore}</span>
                        <span className="text-gray-500 ml-2">
                          ({method === 'twenty_percent' ? '20% rule' : method === 'custom_percent' ? `${(threshold * 100).toFixed(0)}% rule` : method})
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-gray-600 italic text-xs mt-2">
                  Showing first 5 locations as preview. All locations will be scored when you apply.
                </p>
              </div>
            )}
          </div>
        )}

        {message && (
          <div
            className={`mb-4 p-2 rounded text-sm ${
              message.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading || saving}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Close
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={loading || saving || rows.some((r) => r.score === '')}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            title={rows.some((r) => r.score === '') ? "Please assign scores to all categories first" : ""}
          >
            {saving ? 'Saving…' : 'Save Config'}
          </button>
          <button
            onClick={handleApplyScoring}
            disabled={loading || saving || rows.some((r) => r.score === '')}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            title={rows.some((r) => r.score === '') ? "Please assign scores to all categories first" : ""}
          >
            {loading ? 'Applying…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
