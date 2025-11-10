'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ScoringPreviewModalProps {
  instance: any;
  onClose: () => void;
}

export default function ScoringPreviewModal({
  instance,
  onClose,
}: ScoringPreviewModalProps) {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load dataset scoring configurations for this instance
  useEffect(() => {
    if (!instance) return;
    loadConfigs();
  }, [instance]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, simulate scoring configs by joining datasets with instance type
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;

      // placeholder configuration logic
      const configData =
        data?.map((d: any) => ({
          dataset_id: d.id,
          name: d.name,
          category: d.category,
          admin_level: d.admin_level,
          score_method: 'linear', // placeholder
          weight: 1.0,
        })) || [];

      setConfigs(configData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading scoring preview');
    } finally {
      setLoading(false);
    }
  };

  if (!instance) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl relative max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Scoring Preview – {instance.name}
            </h2>
            <p className="text-xs text-gray-500">
              Instance Type: {instance.type || '—'}
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
        <div className="flex-grow overflow-y-auto p-4">
          {loading ? (
            <p className="text-gray-500 text-center py-8 text-sm">
              Loading dataset configurations...
            </p>
          ) : error ? (
            <p className="text-red-600 text-center py-8">{error}</p>
          ) : configs.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">
              No datasets found for scoring.
            </p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left border-b">Dataset</th>
                    <th className="px-3 py-2 text-left border-b">Category</th>
                    <th className="px-3 py-2 text-left border-b">
                      Admin Level
                    </th>
                    <th className="px-3 py-2 text-left border-b">
                      Scoring Method
                    </th>
                    <th className="px-3 py-2 text-left border-b">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(configs) ? configs : []).map((cfg: any) => (
                    <tr
                      key={cfg.dataset_id}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {cfg.name}
                      </td>
                      <td className="px-3 py-2">{cfg.category || '—'}</td>
                      <td className="px-3 py-2">{cfg.admin_level || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {cfg.score_method || '—'}
                      </td>
                      <td className="px-3 py-2">{cfg.weight.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-md text-sm hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
