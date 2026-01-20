'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Pencil, Trash2, Wand2, Layers, MapPinned, Info, Database, Save, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';
import DatasetCleaningWorkflow from './DatasetCleaningWorkflow';
import UnmatchedRowsViewer from './UnmatchedRowsViewer';

type Dataset = {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  admin_level?: string | null;
  source?: string | null;
  value_type?: string | null;
  category?: string | null;
  metadata?: Record<string, any> | null;
  is_baseline?: boolean | null;
  is_derived?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  dataset: Dataset | null;
  mode?: 'view' | 'edit';
  onClose: () => void;
  onSaved: () => void;
  onDelete: (datasetId: string) => void;
};

const CATEGORY_OPTIONS = [
  { value: 'Core', label: 'Core' },
  { value: 'SSC P1', label: 'SSC P1 – The Shelter' },
  { value: 'SSC P2', label: 'SSC P2 – Living Conditions' },
  { value: 'SSC P3', label: 'SSC P3 – Settlement' },
  { value: 'Hazard', label: 'Hazard' },
  { value: 'Underlying Vulnerability', label: 'Underlying Vulnerability' },
  { value: 'Uncategorized', label: 'Uncategorized' },
];

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const statusConfig: Record<
  string,
  {
    label: string;
    color: string;
    description: string;
  }
> = {
  ready: {
    label: 'Ready for use',
    color: 'bg-green-100 text-green-700',
    description: 'Aligned with admin boundaries and validated.',
  },
  in_progress: {
    label: 'Cleaning in progress',
    color: 'bg-amber-100 text-amber-700',
    description: 'Cleaning or validation steps are underway.',
  },
  needs_review: {
    label: 'Needs review',
    color: 'bg-red-100 text-red-700',
    description: 'Requires alignment or metadata updates before use.',
  },
  archived: {
    label: 'Archived',
    color: 'bg-gray-200 text-gray-600',
    description: 'Kept for reference but not in active use.',
  },
};

const getDatasetStatus = (dataset: Dataset | null) => {
  if (!dataset) return statusConfig.needs_review;
  const meta = dataset.metadata || {};
  const state = meta.readiness || meta.cleaning_status || 'needs_review';
  return statusConfig[state] || statusConfig.needs_review;
};

type DataHealthInfo = {
  matched?: number | null;
  total?: number | null;
  percent?: number | null;
};

const getDataHealthInfo = (dataset: Dataset | null): DataHealthInfo | null => {
  if (!dataset?.metadata?.data_health) return null;
  const health = dataset.metadata.data_health;
  const rawPercent = health.percent;
  let percent: number | null = null;
  if (typeof rawPercent === 'number') {
    percent = rawPercent > 1 ? rawPercent / 100 : rawPercent;
  }
  const matched = typeof health.matched === 'number' ? health.matched : health.aligned;
  const total = typeof health.total === 'number' ? health.total : health.count;
  if ((percent == null || Number.isNaN(percent)) && typeof matched === 'number' && typeof total === 'number' && total > 0) {
    percent = matched / total;
  }
  return {
    matched: typeof matched === 'number' ? matched : null,
    total: typeof total === 'number' ? total : null,
    percent: typeof percent === 'number' ? percent : null,
  };
};

const formatHealthPercent = (info: DataHealthInfo | null) => {
  if (!info || info.percent == null || Number.isNaN(info.percent)) return null;
  return Math.round(info.percent * 100);
};

export default function DatasetDetailDrawer({ dataset, mode = 'view', onClose, onSaved, onDelete }: Props) {
  const [editing, setEditing] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [showCleaningWorkflow, setShowCleaningWorkflow] = useState(false);
  const [showUnmatchedViewer, setShowUnmatchedViewer] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [formValues, setFormValues] = useState({
    name: '',
    description: '',
    type: 'numeric',
    admin_level: '',
    value_type: 'absolute',
    category: 'Uncategorized',
  });

  useEffect(() => {
    if (!dataset) return;
    
    // Determine category from metadata.pillar, metadata.category, or dataset.category
    const meta = dataset.metadata || {};
    const categoryFromMeta = meta.pillar || meta.category || dataset.category || 'Uncategorized';
    
    // Map pillar values back to category options
    const pillarToCategory: Record<string, string> = {
      'Core': 'Core',
      'SSC Framework - P1': 'SSC P1',
      'SSC Framework - P2': 'SSC P2',
      'SSC Framework - P3': 'SSC P3',
      'Hazard': 'Hazard',
      'Underlying Vulnerability': 'Underlying Vulnerability',
      'Other': 'Uncategorized',
    };
    
    const mappedCategory = pillarToCategory[categoryFromMeta] || categoryFromMeta || 'Uncategorized';
    
    setFormValues({
      name: dataset.name || '',
      description: dataset.description || '',
      type: dataset.type || 'numeric',
      admin_level: dataset.admin_level || '',
      value_type: dataset.value_type || 'absolute',
      category: mappedCategory,
    });
    setEditing(mode === 'edit');
  }, [dataset, mode]);

  useEffect(() => {
    if (!dataset) return;
    const fetchSampleData = async () => {
      setLoadingData(true);
      try {
        if (dataset.type === 'categorical') {
          const { data } = await supabase
            .from('dataset_values_categorical')
            .select('admin_pcode, category, value')
            .eq('dataset_id', dataset.id)
            .limit(10)
            .order('admin_pcode', { ascending: true });
          setSampleData(data || []);
        } else {
          const { data } = await supabase
            .from('dataset_values_numeric')
            .select('admin_pcode, value')
            .eq('dataset_id', dataset.id)
            .limit(10)
            .order('admin_pcode', { ascending: true });
          setSampleData(data || []);
        }
      } catch (err) {
        console.error('Failed to load sample data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchSampleData();
    loadHealthMetrics();
  }, [dataset]);

  const loadHealthMetrics = async () => {
    if (!dataset) return;
    setLoadingHealth(true);
    try {
      const { data, error } = await supabase.rpc('compute_data_health', {
        dataset_id: dataset.id,
      });
      if (error) {
        // Provide helpful error message if function doesn't exist
        if (error.message?.includes('could not find the function') || (error.message?.includes('function') && error.message?.includes('does not exist'))) {
          console.warn('Database function not found. Please deploy supabase/compute_data_health.sql to your Supabase database. See supabase/DEPLOY_CLEANING_FUNCTIONS.md for instructions.');
        }
        throw error;
      }
      setHealthMetrics(data);
    } catch (err) {
      console.error('Failed to load health metrics:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  if (!dataset) return null;
  const status = getDatasetStatus(dataset);
  const dataHealth = useMemo(() => getDataHealthInfo(dataset), [dataset]);
  const healthPercent = formatHealthPercent(dataHealth);

  const infoRows = [
    { label: 'Type', value: dataset.type || '—' },
    { label: 'Admin level', value: dataset.admin_level || '—' },
    { label: 'Source', value: dataset.source || '—' },
    { label: 'Created', value: formatDate(dataset.created_at) },
    { label: 'Updated', value: formatDate(dataset.updated_at) },
  ];

  const handleFieldChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate admin_level (required, non-empty)
      if (!formValues.admin_level || formValues.admin_level.trim() === '') {
        alert('Admin level is required and cannot be empty.');
        setSaving(false);
        return;
      }
      
      // Map category to metadata.pillar for proper categorization
      const categoryToPillar: Record<string, string> = {
        'Core': 'Core',
        'SSC P1': 'SSC Framework - P1',
        'SSC P2': 'SSC Framework - P2',
        'SSC P3': 'SSC Framework - P3',
        'Hazard': 'Hazard',
        'Underlying Vulnerability': 'Underlying Vulnerability',
        'Uncategorized': 'Other',
      };
      
      const pillarValue = categoryToPillar[formValues.category] || formValues.category;
      
      // Update metadata with category and value_type (these are stored in metadata, not as columns)
      const metadata = {
        ...(dataset.metadata || {}),
        pillar: pillarValue,
        category: formValues.category,
        value_type: formValues.value_type,
      };
      
      // Only update columns that actually exist in the database
      const updateData: any = {
        name: formValues.name,
        description: formValues.description || null,
        type: formValues.type,
        admin_level: formValues.admin_level.trim(),
        metadata: metadata,
      };
      
      // Only include updated_at if the column exists (will be set by trigger if present)
      // The trigger will automatically set updated_at, but we can also set it explicitly
      // if the column exists
      
      const { error } = await supabase
        .from('datasets')
        .update(updateData)
        .eq('id', dataset.id);
        
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      onSaved();
      setEditing(false);
    } catch (err: any) {
      console.error('Failed to save dataset:', err);
      const errorMessage = err?.message || 'Failed to save dataset changes.';
      alert(`Failed to save dataset changes: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this dataset? This action cannot be undone.')) return;
    await onDelete(dataset.id);
    onClose();
  };

  const metadataEntries = Object.entries(dataset.metadata || {}).filter(
    ([key]) => !['cleaning_state', 'readiness'].includes(key),
  );

  const editingFields = (
    <div className="space-y-3">
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500">Name</label>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={formValues.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500">Description</label>
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          rows={3}
          value={formValues.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500">Type</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={formValues.type}
            onChange={(e) => handleFieldChange('type', e.target.value)}
          >
            <option value="numeric">Numeric</option>
            <option value="categorical">Categorical</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500">Value type</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={formValues.value_type}
            onChange={(e) => handleFieldChange('value_type', e.target.value)}
          >
            <option value="absolute">Absolute</option>
            <option value="relative">Relative</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500">Admin level</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={formValues.admin_level}
            onChange={(e) => handleFieldChange('admin_level', e.target.value)}
          >
            <option value="">—</option>
            <option value="ADM1">ADM1</option>
            <option value="ADM2">ADM2</option>
            <option value="ADM3">ADM3</option>
            <option value="ADM4">ADM4</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500">Category</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={formValues.category}
            onChange={(e) => handleFieldChange('category', e.target.value)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold">Dataset detail</p>
            <h2 className="text-xl font-semibold text-gray-900">{dataset.name}</h2>
            <p className="text-sm text-gray-500">{dataset.description || 'No description provided.'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>{`Cleaning status: ${status.label}`}</span>
            {healthPercent != null ? (
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${healthPercent >= 85 ? 'bg-green-100 text-green-700' : healthPercent >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                Data health: {healthPercent}%
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600">
                Data health: not computed
              </span>
            )}
            {dataset.is_baseline && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-indigo-100 text-indigo-700">Reference</span>
            )}
            {dataset.is_derived && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-700">Derived</span>
            )}
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p className="flex items-start gap-1">
              <Info size={14} className="mt-0.5 text-gray-400" />
              {status.description}
            </p>
            <p>
              {dataHealth && dataHealth.total
                ? `Aligned ${dataHealth.matched ?? '?'} of ${dataHealth.total} rows to reference pcodes.`
                : 'Run the cleaning workflow to capture data health metrics.'}
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          <section className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Layers size={16} className="text-gray-400" />
                {editing ? 'Edit details' : 'Overview'}
              </h3>
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-600"
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                )}
              </div>
            </div>
            {editing ? (
              editingFields
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {infoRows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">{row.label}</dt>
                    <dd className="font-medium text-gray-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPinned size={16} className="text-gray-400" />
              Metadata & notes
            </h3>
            {metadataEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No additional metadata recorded yet.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                {metadataEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">{key}</dt>
                    <dd className="font-medium text-gray-900 break-words">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Database size={16} className="text-gray-400" />
              Data preview
            </h3>
            {loadingData ? (
              <p className="text-sm text-gray-500">Loading sample data…</p>
            ) : sampleData.length === 0 ? (
              <p className="text-sm text-gray-500">No data values found for this dataset.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Admin PCode</th>
                      {dataset.type === 'categorical' && (
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Category</th>
                      )}
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {sampleData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-[11px] text-gray-900">{row.admin_pcode}</td>
                        {dataset.type === 'categorical' && (
                          <td className="px-3 py-2 text-gray-700">{row.category || '—'}</td>
                        )}
                        <td className="px-3 py-2 text-gray-900 font-medium">
                          {typeof row.value === 'number' ? row.value.toLocaleString() : row.value || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Showing first {sampleData.length} rows.{' '}
              <Link href={`/datasets/raw/${dataset.id}`} className="font-semibold text-amber-600 hover:text-amber-700">
                View full dataset
              </Link>
            </p>
          </section>

          <section className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-gray-400" />
              Data Cleaning
            </h3>
            {healthMetrics && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Alignment</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {healthMetrics.alignment_rate != null
                      ? `${Math.round(healthMetrics.alignment_rate * 100)}%`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Coverage</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {healthMetrics.coverage != null ? `${Math.round(healthMetrics.coverage * 100)}%` : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Completeness</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {healthMetrics.completeness != null
                      ? `${Math.round(healthMetrics.completeness * 100)}%`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Uniqueness</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {healthMetrics.uniqueness != null ? `${Math.round(healthMetrics.uniqueness * 100)}%` : '—'}
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowCleaningWorkflow(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                <Sparkles size={14} />
                Start Cleaning Workflow
              </button>
              <button
                onClick={() => setShowUnmatchedViewer(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
              >
                <AlertTriangle size={14} />
                View Unmatched Rows
              </button>
            </div>
          </section>

          <section className="px-5 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/datasets/raw/${dataset.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
              >
                <Wand2 size={14} />
                Inspect raw values
              </Link>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Delete dataset
              </button>
            </div>
          </section>
        </div>
      </div>

      {showCleaningWorkflow && dataset && (
        <DatasetCleaningWorkflow
          dataset={dataset}
          onClose={() => {
            setShowCleaningWorkflow(false);
            loadHealthMetrics();
            onSaved();
          }}
          onCleaned={() => {
            loadHealthMetrics();
            onSaved();
          }}
        />
      )}

      {showUnmatchedViewer && dataset && (
        <UnmatchedRowsViewer
          dataset={dataset}
          onClose={() => setShowUnmatchedViewer(false)}
          onManualMap={async (rowId, mappedPcode) => {
            // Handle manual mapping - this would need to be implemented
            // For now, just refresh
            loadHealthMetrics();
            onSaved();
          }}
        />
      )}
    </div>
  );
}
