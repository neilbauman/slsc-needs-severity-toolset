'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { X, Download, Check } from 'lucide-react';

interface Props {
  baselineId: string;
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Instance = {
  id: string;
  name: string;
  created_at: string | null;
};

type InstanceDataset = {
  id: string;
  dataset_id: string;
  category: string | null;
  weight: number | null;
  dataset?: {
    id: string;
    name: string;
    admin_level: string;
    type: string;
  };
};

export default function ImportFromInstanceModal({ baselineId, isOpen, onClose, onImported }: Props) {
  const supabase = createClient();
  
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [instanceDatasets, setInstanceDatasets] = useState<InstanceDataset[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [importing, setImporting] = useState(false);
  const [existingDatasetIds, setExistingDatasetIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadInstances();
      loadExistingDatasets();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedInstanceId) {
      loadInstanceDatasets(selectedInstanceId);
    } else {
      setInstanceDatasets([]);
      setSelectedDatasets(new Set());
    }
  }, [selectedInstanceId]);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('instances')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (err) {
      console.error('Error loading instances:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingDatasets = async () => {
    try {
      const { data } = await supabase
        .from('baseline_datasets')
        .select('dataset_id')
        .eq('baseline_id', baselineId);

      setExistingDatasetIds(new Set((data || []).map(d => d.dataset_id)));
    } catch (err) {
      console.error('Error loading existing datasets:', err);
    }
  };

  const loadInstanceDatasets = async (instanceId: string) => {
    setLoadingDatasets(true);
    try {
      const { data, error } = await supabase
        .from('instance_datasets')
        .select(`
          id,
          dataset_id,
          category,
          weight,
          dataset:datasets(id, name, admin_level, type)
        `)
        .eq('instance_id', instanceId);

      if (error) throw error;

      // Flatten the dataset join
      const flattened = (data || []).map(d => ({
        ...d,
        dataset: Array.isArray(d.dataset) ? d.dataset[0] : d.dataset
      }));

      setInstanceDatasets(flattened);
      
      // Pre-select datasets that aren't already in baseline
      const newDatasets = flattened.filter(d => !existingDatasetIds.has(d.dataset_id));
      setSelectedDatasets(new Set(newDatasets.map(d => d.dataset_id)));
    } catch (err) {
      console.error('Error loading instance datasets:', err);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const toggleDataset = (datasetId: string) => {
    setSelectedDatasets(prev => {
      const next = new Set(prev);
      if (next.has(datasetId)) {
        next.delete(datasetId);
      } else {
        next.add(datasetId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedDatasets.size === instanceDatasets.length) {
      setSelectedDatasets(new Set());
    } else {
      setSelectedDatasets(new Set(instanceDatasets.map(d => d.dataset_id)));
    }
  };

  const handleImport = async () => {
    if (selectedDatasets.size === 0) {
      alert('Please select at least one dataset to import');
      return;
    }

    setImporting(true);
    try {
      // Get selected instance datasets with their categories
      const toImport = instanceDatasets.filter(d => selectedDatasets.has(d.dataset_id));
      
      // Insert into baseline_datasets
      const inserts = toImport.map(d => ({
        baseline_id: baselineId,
        dataset_id: d.dataset_id,
        category: d.category || 'Uncategorized',
        weight: d.weight || 1.0
      }));

      const { error } = await supabase
        .from('baseline_datasets')
        .upsert(inserts, { 
          onConflict: 'baseline_id,dataset_id',
          ignoreDuplicates: true 
        });

      if (error) throw error;

      onImported();
      onClose();
    } catch (err: any) {
      console.error('Error importing datasets:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Download size={20} />
            Import Datasets from Instance
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading instances...</div>
          ) : (
            <>
              {/* Instance Selector */}
              <div>
                <label className="block text-sm font-medium mb-1">Select Instance</label>
                <select
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Choose an instance...</option>
                  {instances.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                      {inst.created_at && ` (${new Date(inst.created_at).toLocaleDateString()})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select a legacy instance to import its dataset configuration
                </p>
              </div>

              {/* Dataset List */}
              {selectedInstanceId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Datasets in Instance
                    </label>
                    <button
                      onClick={toggleAll}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {selectedDatasets.size === instanceDatasets.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {loadingDatasets ? (
                    <div className="text-sm text-gray-500 py-4 text-center">
                      Loading datasets...
                    </div>
                  ) : instanceDatasets.length === 0 ? (
                    <div className="text-sm text-gray-500 py-4 text-center border rounded-lg">
                      No datasets found in this instance
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                      {instanceDatasets.map(d => {
                        const isExisting = existingDatasetIds.has(d.dataset_id);
                        const isSelected = selectedDatasets.has(d.dataset_id);

                        return (
                          <label
                            key={d.id}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                              isExisting ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDataset(d.dataset_id)}
                              disabled={isExisting}
                              className="rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {d.dataset?.name || 'Unknown Dataset'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {d.category || 'No category'} • {d.dataset?.admin_level} • {d.dataset?.type}
                              </div>
                            </div>
                            {isExisting && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex items-center gap-1">
                                <Check size={12} />
                                Already in baseline
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {instanceDatasets.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {selectedDatasets.size} datasets selected for import
                      {existingDatasetIds.size > 0 && (
                        <span className="text-gray-400">
                          {' '}({Array.from(existingDatasetIds).filter(id => 
                            instanceDatasets.some(d => d.dataset_id === id)
                          ).length} already in baseline)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importing || selectedDatasets.size === 0}
            className="btn btn-primary flex items-center gap-1"
          >
            <Download size={16} />
            {importing ? 'Importing...' : `Import ${selectedDatasets.size} Datasets`}
          </button>
        </div>
      </div>
    </div>
  );
}
