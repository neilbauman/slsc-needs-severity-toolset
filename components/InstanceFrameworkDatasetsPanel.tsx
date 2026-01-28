'use client';

import { useMemo, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';

type DatasetRow = {
  dataset_id: string;
  dataset_name: string;
  dataset_type: string;
  dataset_category: string;
};

const CATEGORY_ORDER = [
  'SSC Framework - P1',
  'SSC Framework - P2',
  'SSC Framework - P3',
  'Hazard',
  'Underlying Vulnerability',
];

const CATEGORY_LABELS: Record<string, string> = {
  'SSC Framework - P1': 'P1 - The Shelter',
  'SSC Framework - P2': 'P2 - The Living Conditions',
  'SSC Framework - P3': 'P3 - The Settlement',
  'Hazard': 'Haz - Hazards',
  'Underlying Vulnerability': 'UV - Underlying Vulnerabilities',
  'Uncategorized': 'Uncategorized',
};

function getCategoryGroup(category: string): string {
  const c = (category || '').trim();
  if (CATEGORY_ORDER.includes(c)) return c;
  if (c.startsWith('P1') || c.startsWith('P1.')) return 'SSC Framework - P1';
  if (c.startsWith('P2') || c.startsWith('P2.')) return 'SSC Framework - P2';
  if (c.startsWith('P3.2') || c.toLowerCase().includes('hazard')) return 'Hazard';
  if (c.startsWith('P3') || c.startsWith('P3.') || c.toLowerCase().includes('underlying') || c.toLowerCase().includes('vuln')) return 'Underlying Vulnerability';
  return 'Uncategorized';
}

interface Props {
  datasets: DatasetRow[];
  datasetScores: Map<string, number | null>; // dataset_id -> avg_score or null
  onConfigureDatasets: () => void;
  onAdjustScoring: () => void;
  onViewOnMap: (datasetId: string, datasetName: string, category: string) => void;
  disabled?: boolean;
}

export default function InstanceFrameworkDatasetsPanel({
  datasets,
  datasetScores,
  onConfigureDatasets,
  onAdjustScoring,
  onViewOnMap,
  disabled,
}: Props) {
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set([...CATEGORY_ORDER, 'Uncategorized']));

  const grouped = useMemo(() => {
    const acc: Record<string, DatasetRow[]> = {};
    CATEGORY_ORDER.forEach((cat) => {
      acc[cat] = [];
    });
    acc['Uncategorized'] = [];
    datasets.forEach((d) => {
      const group = getCategoryGroup(d.dataset_category || '');
      if (!acc[group]) acc[group] = [];
      acc[group].push(d);
    });
    return acc;
  }, [datasets]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const categoryKeysOrder = [...CATEGORY_ORDER];
  if ((grouped['Uncategorized']?.length ?? 0) > 0) categoryKeysOrder.push('Uncategorized');
  const categoriesToShow = showEmptyCategories
    ? categoryKeysOrder
    : categoryKeysOrder.filter((cat) => (grouped[cat]?.length ?? 0) > 0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-4">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-semibold text-gray-900">Framework Datasets</h4>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium" title="Categories from instance datasets">
            from instance
          </span>
          <span className="text-sm text-gray-500">{datasets.length} datasets</span>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showEmptyCategories}
              onChange={(e) => setShowEmptyCategories(e.target.checked)}
              className="rounded"
            />
            Show empty categories
          </label>
          <button
            type="button"
            onClick={onConfigureDatasets}
            disabled={disabled}
            className="btn btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
          >
            Configure Datasets
          </button>
          <button
            type="button"
            onClick={onAdjustScoring}
            disabled={disabled}
            className="btn btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
          >
            Adjust Scoring
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {categoriesToShow.map((catKey) => {
          const rows = grouped[catKey] || [];
          const label = CATEGORY_LABELS[catKey] || catKey;
          const isExpanded = expandedCategories.has(catKey);
          const isEmpty = rows.length === 0;
          if (isEmpty && !showEmptyCategories) return null;

          return (
            <div key={catKey} className="bg-white">
              <button
                type="button"
                onClick={() => toggleCategory(catKey)}
                className="w-full px-4 py-2.5 flex items-center gap-2 text-left font-medium text-gray-900 hover:bg-gray-50 border-0"
                style={{
                  backgroundColor: isEmpty ? 'rgba(243, 244, 246, 0.8)' : 'rgba(254, 243, 199, 0.4)',
                }}
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-500" />
                ) : (
                  <ChevronRight size={16} className="text-gray-500" />
                )}
                <span>{label}</span>
                {!isEmpty && (
                  <span className="text-xs font-normal text-gray-500">
                    ({rows.length} dataset{rows.length !== 1 ? 's' : ''})
                  </span>
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-3">
                  {isEmpty ? (
                    <p className="text-xs text-gray-500 py-2">No datasets in this category.</p>
                  ) : (
                    <ul className="space-y-2">
                      {rows.map((d) => {
                        const avgScore = datasetScores.get(d.dataset_id);
                        const hasScores = avgScore != null && !Number.isNaN(avgScore);
                        return (
                          <li
                            key={d.dataset_id}
                            className="flex items-center justify-between gap-4 py-2 px-3 rounded border border-gray-100 bg-gray-50/50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {hasScores && (
                                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                                )}
                                <span className="font-medium text-sm text-gray-900">
                                  {d.dataset_name || `Dataset ${d.dataset_id.slice(0, 8)}`}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {d.dataset_type}
                                {hasScores && (
                                  <span className="ml-2 text-green-600">
                                    avg score {typeof avgScore === 'number' ? avgScore.toFixed(2) : avgScore}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => onViewOnMap(d.dataset_id, d.dataset_name, d.dataset_category)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                                title="Show this dataset on the map"
                              >
                                <BarChart3 size={12} />
                                View on map
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
