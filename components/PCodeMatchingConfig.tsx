'use client';

import { useState } from 'react';
import { Settings, Info } from 'lucide-react';

type MatchingConfig = {
  exact_match: boolean;
  fuzzy_pcode: boolean;
  name_match: boolean;
  fuzzy_name: boolean;
  parent_code: boolean;
  prefix_match: boolean;
  fuzzy_threshold: number;
};

type Props = {
  config: MatchingConfig;
  onChange: (config: MatchingConfig) => void;
};

export default function PCodeMatchingConfig({ config, onChange }: Props) {
  const [localConfig, setLocalConfig] = useState<MatchingConfig>(config);

  const handleToggle = (key: keyof MatchingConfig) => {
    if (key === 'fuzzy_threshold') return; // Handle separately
    const newConfig = { ...localConfig, [key]: !localConfig[key] };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handleThresholdChange = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    const newConfig = { ...localConfig, fuzzy_threshold: clamped };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Matching Strategies</h3>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">Exact Match</label>
            <p className="text-xs text-gray-500">Direct PCode match (case-insensitive, trimmed)</p>
          </div>
          <input
            type="checkbox"
            checked={localConfig.exact_match}
            onChange={() => handleToggle('exact_match')}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">Fuzzy PCode</label>
            <p className="text-xs text-gray-500">Similarity matching on PCodes using Levenshtein distance</p>
          </div>
          <input
            type="checkbox"
            checked={localConfig.fuzzy_pcode}
            onChange={() => handleToggle('fuzzy_pcode')}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">Name Match</label>
            <p className="text-xs text-gray-500">Match on admin name (normalized, case-insensitive)</p>
          </div>
          <input
            type="checkbox"
            checked={localConfig.name_match}
            onChange={() => handleToggle('name_match')}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">Fuzzy Name</label>
            <p className="text-xs text-gray-500">Similarity matching on admin names</p>
          </div>
          <input
            type="checkbox"
            checked={localConfig.fuzzy_name}
            onChange={() => handleToggle('fuzzy_name')}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">Parent Code</label>
            <p className="text-xs text-gray-500">Match via parent_pcode relationships</p>
          </div>
          <input
            type="checkbox"
            checked={localConfig.parent_code}
            onChange={() => handleToggle('parent_code')}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">Prefix Match</label>
            <p className="text-xs text-gray-500">PCode prefix matching for hierarchical codes</p>
          </div>
          <input
            type="checkbox"
            checked={localConfig.prefix_match}
            onChange={() => handleToggle('prefix_match')}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Fuzzy Threshold</label>
          <span className="text-sm text-gray-600">{Math.round(localConfig.fuzzy_threshold * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={localConfig.fuzzy_threshold}
          onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Info size={12} />
          <span>Minimum similarity score for fuzzy matches (0.0 = any match, 1.0 = exact match)</span>
        </div>
      </div>
    </div>
  );
}

