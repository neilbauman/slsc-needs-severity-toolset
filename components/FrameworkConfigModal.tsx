'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Settings, Save, X, AlertCircle, CheckCircle } from 'lucide-react';

type CategoryKey = 
  | 'SSC Framework - P1'
  | 'SSC Framework - P2'
  | 'SSC Framework - P3'
  | 'Hazard'
  | 'Underlying Vulnerability';

type Method = 'average' | 'weighted_normalized_sum' | 'worst_case' | 'median' | 'custom_weighted';

type CategoryConfig = {
  enabled: boolean;
  method: Method;
  default_weight: number;
  description: string;
};

type FrameworkConfig = {
  id?: string;
  name: string;
  description?: string;
  category_config: Record<CategoryKey, CategoryConfig>;
  ssc_rollup_config: {
    method: Method;
    weights: Record<string, number>;
    description: string;
  };
  overall_rollup_config: {
    method: Method;
    weights: Record<string, number>;
    description: string;
  };
};

interface FrameworkConfigModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_KEYS: CategoryKey[] = [
  'SSC Framework - P1',
  'SSC Framework - P2',
  'SSC Framework - P3',
  'Hazard',
  'Underlying Vulnerability',
];

const METHOD_OPTIONS: { value: Method; label: string; description: string }[] = [
  { value: 'average', label: 'Average', description: 'Simple average of all scores' },
  { value: 'weighted_normalized_sum', label: 'Weighted Normalized Sum', description: 'Weighted sum with normalization' },
  { value: 'worst_case', label: 'Worst Case', description: 'Takes the highest (worst) score' },
  { value: 'median', label: 'Median', description: 'Median value of all scores' },
  { value: 'custom_weighted', label: 'Custom Weighted', description: 'Custom weights per dataset' },
];

export default function FrameworkConfigModal({ open, onClose }: FrameworkConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [config, setConfig] = useState<FrameworkConfig | null>(null);

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.rpc('get_framework_config');
      
      if (fetchError) throw fetchError;
      
      if (data && data.length > 0) {
        setConfig({
          id: data[0].id,
          name: data[0].name || 'Default Framework Configuration',
          description: data[0].description || '',
          category_config: data[0].category_config || {},
          ssc_rollup_config: data[0].ssc_rollup_config || {
            method: 'worst_case',
            weights: { 'SSC Framework - P1': 0.333, 'SSC Framework - P2': 0.333, 'SSC Framework - P3': 0.334 },
            description: 'How to aggregate P1, P2, P3 into SSC Framework score',
          },
          overall_rollup_config: data[0].overall_rollup_config || {
            method: 'average',
            weights: { 'SSC Framework': 0.6, 'Hazard': 0.2, 'Underlying Vulnerability': 0.2 },
            description: 'How to aggregate categories into final overall score',
          },
        });
      } else {
        // Create default config
        setConfig({
          name: 'Default Framework Configuration',
          description: '',
          category_config: {
            'SSC Framework - P1': {
              enabled: true,
              method: 'weighted_normalized_sum',
              default_weight: 1.0,
              description: 'The Shelter - Structural safety & direct exposure of homes',
            },
            'SSC Framework - P2': {
              enabled: true,
              method: 'weighted_normalized_sum',
              default_weight: 1.0,
              description: 'The Living Conditions - Physical & socioeconomic fragility factors',
            },
            'SSC Framework - P3': {
              enabled: true,
              method: 'weighted_normalized_sum',
              default_weight: 1.0,
              description: 'The Settlement - Readiness of services, governance & access',
            },
            'Hazard': {
              enabled: true,
              method: 'weighted_normalized_sum',
              default_weight: 1.0,
              description: 'Recent hazard footprints & alerts',
            },
            'Underlying Vulnerability': {
              enabled: true,
              method: 'weighted_normalized_sum',
              default_weight: 1.0,
              description: 'Chronic structural drivers',
            },
          },
          ssc_rollup_config: {
            method: 'worst_case',
            weights: { 'SSC Framework - P1': 0.333, 'SSC Framework - P2': 0.333, 'SSC Framework - P3': 0.334 },
            description: 'How to aggregate P1, P2, P3 into SSC Framework score',
          },
          overall_rollup_config: {
            method: 'average',
            weights: { 'SSC Framework': 0.6, 'Hazard': 0.2, 'Underlying Vulnerability': 0.2 },
            description: 'How to aggregate categories into final overall score',
          },
        });
      }
    } catch (err: any) {
      console.error('Error loading framework config:', err);
      setError(err.message || 'Failed to load framework configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Deactivate all existing configs
      await supabase
        .from('framework_config')
        .update({ is_active: false })
        .eq('is_active', true);
      
      // Insert or update the active config
      const { error: saveError } = await supabase
        .from('framework_config')
        .upsert({
          id: config.id,
          name: config.name,
          description: config.description,
          category_config: config.category_config,
          ssc_rollup_config: config.ssc_rollup_config,
          overall_rollup_config: config.overall_rollup_config,
          is_active: true,
        }, {
          onConflict: 'id',
        });
      
      if (saveError) throw saveError;
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving framework config:', err);
      setError(err.message || 'Failed to save framework configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateCategoryConfig = (key: CategoryKey, field: keyof CategoryConfig, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      category_config: {
        ...config.category_config,
        [key]: {
          ...config.category_config[key],
          [field]: value,
        },
      },
    });
  };

  const updateSscRollupWeight = (pillar: string, weight: number) => {
    if (!config) return;
    setConfig({
      ...config,
      ssc_rollup_config: {
        ...config.ssc_rollup_config,
        weights: {
          ...config.ssc_rollup_config.weights,
          [pillar]: weight,
        },
      },
    });
  };

  const updateOverallRollupWeight = (category: string, weight: number) => {
    if (!config) return;
    setConfig({
      ...config,
      overall_rollup_config: {
        ...config.overall_rollup_config,
        weights: {
          ...config.overall_rollup_config.weights,
          [category]: weight,
        },
      },
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">SSC Framework Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading configuration...</p>
            </div>
          ) : config ? (
            <>
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Configuration Name
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={config.description || ''}
                    onChange={(e) => setConfig({ ...config, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Category Configurations */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Category Configurations</h3>
                {CATEGORY_KEYS.map((key) => {
                  const catConfig = config.category_config[key];
                  if (!catConfig) return null;
                  
                  return (
                    <div key={key} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{key}</h4>
                          <p className="text-sm text-gray-600">{catConfig.description}</p>
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={catConfig.enabled}
                            onChange={(e) => updateCategoryConfig(key, 'enabled', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Enabled</span>
                        </label>
                      </div>
                      
                      {catConfig.enabled && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Aggregation Method
                            </label>
                            <select
                              value={catConfig.method}
                              onChange={(e) => updateCategoryConfig(key, 'method', e.target.value as Method)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {METHOD_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              {METHOD_OPTIONS.find(m => m.value === catConfig.method)?.description}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Default Weight
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={catConfig.default_weight}
                              onChange={(e) => updateCategoryConfig(key, 'default_weight', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* SSC Rollup Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">SSC Framework Rollup</h3>
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-600">{config.ssc_rollup_config.description}</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Aggregation Method
                    </label>
                    <select
                      value={config.ssc_rollup_config.method}
                      onChange={(e) => setConfig({
                        ...config,
                        ssc_rollup_config: { ...config.ssc_rollup_config, method: e.target.value as Method },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {METHOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {config.ssc_rollup_config.method === 'custom_weighted' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Pillar Weights</label>
                      {['SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3'].map((pillar) => (
                        <div key={pillar} className="flex items-center gap-2">
                          <span className="text-sm text-gray-700 w-32">{pillar}:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={config.ssc_rollup_config.weights[pillar] || 0}
                            onChange={(e) => updateSscRollupWeight(pillar, parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Overall Rollup Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Overall Score Rollup</h3>
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-600">{config.overall_rollup_config.description}</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Aggregation Method
                    </label>
                    <select
                      value={config.overall_rollup_config.method}
                      onChange={(e) => setConfig({
                        ...config,
                        overall_rollup_config: { ...config.overall_rollup_config, method: e.target.value as Method },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {METHOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {config.overall_rollup_config.method === 'custom_weighted' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Category Weights</label>
                      {['SSC Framework', 'Hazard', 'Underlying Vulnerability'].map((category) => (
                        <div key={category} className="flex items-center gap-2">
                          <span className="text-sm text-gray-700 w-48">{category}:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={config.overall_rollup_config.weights[category] || 0}
                            onChange={(e) => updateOverallRollupWeight(category, parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle className="text-red-600" size={20} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle className="text-green-600" size={20} />
                  <p className="text-sm text-green-700">Configuration saved successfully!</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-600">
              Failed to load configuration
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
