'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface InstanceCategoryConfigModalProps {
  instance: any;
  onClose: () => void;
}

export default function InstanceCategoryConfigModal({
  instance,
  onClose,
}: InstanceCategoryConfigModalProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCategoryData();
  }, [instance]);

  const loadCategoryData = async () => {
    setLoading(true);
    try {
      // Get all dataset categories
      const { data: dsData } = await supabase
        .from('datasets')
        .select('category')
        .not('category', 'is', null);

      const uniqueCats = Array.from(new Set((dsData || []).map((d) => d.category)));

      // Get any existing configuration
      const { data: cfgData } = await supabase
        .from('instance_category_config')
        .select('*')
        .eq('instance_id', instance.id);

      const cfgMap: Record<string, any> = {};
      (cfgData || []).forEach((c) => {
        cfgMap[c.category] = c;
      });

      setCategories(uniqueCats);
      setConfig(cfgMap);
    } catch (err) {
      console.error('Error loading category configs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (category: string, field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(config).map(([category, c]) => ({
        instance_id: instance.id,
        category,
        aggregation_method: c.aggregation_method || 'mean',
        weight: parseFloat(c.weight || 1),
      }));

      await supabase.from('instance_category_config').delete().eq('instance_id', instance.id);
      if (updates.length > 0)
        await supabase.from('instance_category_config').insert(updates);

      onClose();
    } catch (err) {
      console.error('Error saving category configs', err);
      alert('Error saving category configurations.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b p-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Configure Category Weighting
            </h2>
            <p className="text-xs text-gray-500">
              Instance: {instance.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-4 text-[12px]">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-gray-500 text-sm">No categories found.</p>
          ) : (
            <table className="min-w-full border text-xs">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Aggregation Method</th>
                  <th className="px-3 py-2 text-left">Weight</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const c = config[cat] || {};
                  return (
                    <tr
                      key={cat}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {cat}
                      </td>

                      <td className="px-3 py-2">
                        <select
                          value={c.aggregation_method || 'mean'}
                          onChange={(e) =>
                            handleChange(cat, 'aggregation_method', e.target.value)
                          }
                          className="border rounded-md p-1 text-xs w-full"
                        >
                          <option value="mean">Mean</option>
                          <option value="weighted_mean">Weighted Mean</option>
                          <option value="median">Median</option>
                          <option value="max">Maximum</option>
                          <option value="min">Minimum</option>
                        </select>
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.1"
                          value={c.weight || 1}
                          onChange={(e) =>
                            handleChange(cat, 'weight', e.target.value)
                          }
                          className="border rounded-md p-1 text-xs w-full"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-gray-200 px-3 py-1.5 rounded-md text-sm hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-3 py-1.5 rounded-md text-sm text-white ${
              saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
