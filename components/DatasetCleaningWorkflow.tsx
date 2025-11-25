'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Loader2, BarChart3, MapPin, CheckSquare, Eye } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import PCodeMatchingConfig from './PCodeMatchingConfig';

type Dataset = {
  id: string;
  name: string;
  type?: string | null;
  admin_level?: string | null;
};

type Props = {
  dataset: Dataset;
  onClose: () => void;
  onCleaned: () => void;
};

type Step = 'assessment' | 'alignment' | 'validation' | 'review';

type HealthMetrics = {
  alignment_rate?: number;
  coverage?: number;
  completeness?: number;
  uniqueness?: number;
  total_rows?: number;
  matched_rows?: number;
  unmatched_rows?: number;
  validation_errors?: number;
};

type AlignmentPreview = {
  raw_pcode?: string | null;
  raw_name?: string | null;
  matched_pcode?: string | null;
  matched_name?: string | null;
  match_strategy?: string | null;
  confidence?: number | null;
  value?: any;
};

export default function DatasetCleaningWorkflow({ dataset, onClose, onCleaned }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('assessment');
  const [loading, setLoading] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [alignmentPreview, setAlignmentPreview] = useState<AlignmentPreview[]>([]);
  const [matchingConfig, setMatchingConfig] = useState({
    exact_match: true,
    fuzzy_pcode: true,
    name_match: true,
    fuzzy_name: true,
    parent_code: true,
    prefix_match: true,
    fuzzy_threshold: 0.8,
  });
  const [validationResults, setValidationResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const steps: { id: Step; label: string; icon: any }[] = [
    { id: 'assessment', label: 'Health Assessment', icon: BarChart3 },
    { id: 'alignment', label: 'PCode Alignment', icon: MapPin },
    { id: 'validation', label: 'Value Validation', icon: CheckSquare },
    { id: 'review', label: 'Review & Apply', icon: Eye },
  ];

  useEffect(() => {
    if (currentStep === 'assessment') {
      loadHealthMetrics();
    } else if (currentStep === 'alignment') {
      loadAlignmentPreview();
    } else if (currentStep === 'validation') {
      loadValidationResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const loadHealthMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('compute_data_health', {
        dataset_id: dataset.id,
      });
      if (rpcError) throw rpcError;
      setHealthMetrics(data || null);
    } catch (err: any) {
      console.error('Failed to load health metrics:', err);
      setError(err.message || 'Failed to compute health metrics');
    } finally {
      setLoading(false);
    }
  };

  const loadAlignmentPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('preview_pcode_alignment', {
        dataset_id: dataset.id,
        matching_config: matchingConfig,
      });
      if (rpcError) throw rpcError;
      setAlignmentPreview(data || []);
    } catch (err: any) {
      console.error('Failed to load alignment preview:', err);
      setError(err.message || 'Failed to preview alignment');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load preview when config changes (debounced)
  useEffect(() => {
    if (currentStep === 'alignment') {
      const timer = setTimeout(async () => {
        setLoading(true);
        setError(null);
        try {
          const { data, error: rpcError } = await supabase.rpc('preview_pcode_alignment', {
            dataset_id: dataset.id,
            matching_config: matchingConfig,
          });
          if (rpcError) throw rpcError;
          setAlignmentPreview(data || []);
        } catch (err: any) {
          console.error('Failed to load alignment preview:', err);
          setError(err.message || 'Failed to preview alignment');
        } finally {
          setLoading(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingConfig, currentStep, dataset.id]);

  const loadValidationResults = async () => {
    setLoading(true);
    setError(null);
    try {
      // This will be implemented with the enhanced cleaning RPCs
      setValidationResults({ status: 'pending' });
    } catch (err: any) {
      console.error('Failed to load validation results:', err);
      setError(err.message || 'Failed to validate values');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    const stepIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].id);
    }
  };

  const handleBack = () => {
    const stepIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id);
    }
  };

  const handleApplyCleaning = async () => {
    setLoading(true);
    setError(null);
    try {
      const rpcName = dataset.type === 'numeric' ? 'clean_numeric_dataset_v3' : 'clean_categorical_dataset_v3';
      const { data, error: rpcError } = await supabase.rpc(rpcName, {
        dataset_id: dataset.id,
        matching_config: matchingConfig,
      });
      if (rpcError) throw rpcError;
      await onCleaned();
      onClose();
    } catch (err: any) {
      console.error('Failed to apply cleaning:', err);
      setError(err.message || 'Failed to apply cleaning');
    } finally {
      setLoading(false);
    }
  };

  const getStepIndex = () => steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Dataset Cleaning Workflow</h2>
            <p className="text-sm text-gray-500">{dataset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = getStepIndex() > index;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center flex-1">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                        isActive
                          ? 'border-amber-500 bg-amber-50 text-amber-600'
                          : isCompleted
                            ? 'border-green-500 bg-green-50 text-green-600'
                            : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isCompleted ? <CheckCircle size={18} /> : <Icon size={18} />}
                    </div>
                    <div className="ml-3 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          isActive ? 'text-amber-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-amber-500" size={32} />
            </div>
          )}

          {!loading && currentStep === 'assessment' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Data Health Assessment</h3>
              {healthMetrics ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Alignment Rate</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {healthMetrics.alignment_rate != null
                        ? `${Math.round(healthMetrics.alignment_rate * 100)}%`
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {healthMetrics.matched_rows ?? 0} of {healthMetrics.total_rows ?? 0} rows matched
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Coverage</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {healthMetrics.coverage != null ? `${Math.round(healthMetrics.coverage * 100)}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Reference areas covered</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Completeness</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {healthMetrics.completeness != null
                        ? `${Math.round(healthMetrics.completeness * 100)}%`
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Rows with valid values</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Uniqueness</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {healthMetrics.uniqueness != null ? `${Math.round(healthMetrics.uniqueness * 100)}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Unique rows</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Click "Compute Health Metrics" to analyze the dataset.</p>
              )}
            </div>
          )}

          {!loading && currentStep === 'alignment' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">PCode Alignment</h3>
              <p className="text-sm text-gray-600">
                Configure matching strategies and preview how raw PCodes and names will be matched to admin boundaries.
              </p>
              <PCodeMatchingConfig
                config={matchingConfig}
                onChange={(newConfig) => {
                  setMatchingConfig(newConfig);
                }}
              />
              <button
                onClick={loadAlignmentPreview}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                Refresh Preview
              </button>
              {alignmentPreview.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Raw PCode</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Raw Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Matched PCode</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Matched Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Strategy</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {alignmentPreview.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs text-gray-900">{row.raw_pcode || '—'}</td>
                          <td className="px-4 py-2 text-gray-700">{row.raw_name || '—'}</td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-900">
                            {row.matched_pcode || '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-700">{row.matched_name || '—'}</td>
                          <td className="px-4 py-2 text-gray-600">{row.match_strategy || '—'}</td>
                          <td className="px-4 py-2 text-gray-600">
                            {row.confidence != null ? `${Math.round(row.confidence * 100)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No alignment preview available. Check matching configuration.</p>
              )}
            </div>
          )}

          {!loading && currentStep === 'validation' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Value Validation</h3>
              <p className="text-sm text-gray-600">
                Validate and normalize values according to dataset type and rules.
              </p>
              {validationResults ? (
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-sm text-gray-600">Validation results will be shown here.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Validation will run after alignment is confirmed.</p>
              )}
            </div>
          )}

          {!loading && currentStep === 'review' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Review & Apply</h3>
              <p className="text-sm text-gray-600">
                Review the cleaning configuration and apply changes to the dataset.
              </p>
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Matching Configuration</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={matchingConfig.exact_match}
                        readOnly
                        className="rounded"
                      />
                      <span className="text-gray-600">Exact Match</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={matchingConfig.fuzzy_pcode}
                        readOnly
                        className="rounded"
                      />
                      <span className="text-gray-600">Fuzzy PCode</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={matchingConfig.name_match}
                        readOnly
                        className="rounded"
                      />
                      <span className="text-gray-600">Name Match</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={matchingConfig.fuzzy_name}
                        readOnly
                        className="rounded"
                      />
                      <span className="text-gray-600">Fuzzy Name</span>
                    </div>
                  </div>
                </div>
                {healthMetrics && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Expected Results</p>
                    <p className="text-sm text-gray-600">
                      {healthMetrics.matched_rows ?? 0} rows will be aligned and cleaned.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleBack}
            disabled={getStepIndex() === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <div className="flex gap-2">
            {currentStep === 'review' ? (
              <button
                onClick={handleApplyCleaning}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                Apply Cleaning
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={loading || getStepIndex() === steps.length - 1}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

