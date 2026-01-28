'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (responseId: string) => void;
}

type Baseline = {
  id: string;
  name: string;
  status: string | null;
};

type AdminBoundary = {
  admin_pcode: string;
  name: string;
  admin_level: string;
  parent_pcode: string | null;
};

export default function CreateResponseModal({ isOpen, onClose, onCreated }: Props) {
  const supabase = createClient();
  
  const [step, setStep] = useState(1);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [adminBoundaries, setAdminBoundaries] = useState<AdminBoundary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baselineId, setBaselineId] = useState('');
  const [normalizationScope, setNormalizationScope] = useState<'national' | 'affected_area'>('affected_area');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load baselines
      const { data: baselinesData } = await supabase
        .from('country_baselines')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name');

      setBaselines(baselinesData || []);
      if (baselinesData && baselinesData.length > 0) {
        setBaselineId(baselinesData[0].id);
      }

      // Load ADM2 boundaries for area selection
      const { data: boundariesData } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, admin_level, parent_pcode')
        .eq('admin_level', 'ADM2')
        .order('name');

      setAdminBoundaries(boundariesData || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Please enter a response name');
      return;
    }
    if (!baselineId) {
      alert('Please select a baseline');
      return;
    }
    if (selectedAreas.length === 0) {
      alert('Please select at least one affected area');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('responses')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          baseline_id: baselineId,
          admin_scope: selectedAreas,
          normalization_scope: normalizationScope,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      onCreated(data.id);
      handleClose();
    } catch (err: any) {
      console.error('Error creating response:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setName('');
    setDescription('');
    setSelectedAreas([]);
    setSearchTerm('');
    onClose();
  };

  const toggleArea = (pcode: string) => {
    setSelectedAreas(prev => 
      prev.includes(pcode)
        ? prev.filter(p => p !== pcode)
        : [...prev, pcode]
    );
  };

  const selectAllFiltered = () => {
    const filtered = filteredBoundaries.map(b => b.admin_pcode);
    setSelectedAreas(prev => {
      const newSet = new Set([...prev, ...filtered]);
      return Array.from(newSet);
    });
  };

  const clearSelection = () => {
    setSelectedAreas([]);
  };

  const filteredBoundaries = adminBoundaries.filter(b => 
    b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.admin_pcode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create New Response</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s === step ? 'bg-blue-600 text-white' :
                  s < step ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-12 h-1 mx-1 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
            <span className="ml-2 text-sm text-gray-600">
              {step === 1 && 'Basic Info'}
              {step === 2 && 'Affected Areas'}
              {step === 3 && 'Review'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Response Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Typhoon Maria Response"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of the response..."
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Baseline</label>
                    <select
                      value={baselineId}
                      onChange={(e) => setBaselineId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {baselines.length === 0 ? (
                        <option value="">No active baselines available</option>
                      ) : (
                        baselines.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      The baseline provides pre-crisis vulnerability scores
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Normalization Scope</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="normalization"
                          checked={normalizationScope === 'affected_area'}
                          onChange={() => setNormalizationScope('affected_area')}
                        />
                        <span className="text-sm">Affected Area Only</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="normalization"
                          checked={normalizationScope === 'national'}
                          onChange={() => setNormalizationScope('national')}
                        />
                        <span className="text-sm">National</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {normalizationScope === 'affected_area' 
                        ? 'Scores normalized relative to areas within the crisis zone'
                        : 'Scores normalized relative to the entire country'}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Affected Areas */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Select Affected Areas (ADM2)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name or code..."
                        className="flex-1 px-3 py-2 border rounded-lg"
                      />
                      <button
                        onClick={selectAllFiltered}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        Select Filtered
                      </button>
                      <button
                        onClick={clearSelection}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">
                      {selectedAreas.length} areas selected
                    </div>
                  </div>

                  <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                    {filteredBoundaries.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No areas found
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredBoundaries.slice(0, 100).map(b => (
                          <label
                            key={b.admin_pcode}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAreas.includes(b.admin_pcode)}
                              onChange={() => toggleArea(b.admin_pcode)}
                              className="rounded"
                            />
                            <span className="flex-1">{b.name}</span>
                            <span className="text-xs text-gray-400 font-mono">{b.admin_pcode}</span>
                          </label>
                        ))}
                        {filteredBoundaries.length > 100 && (
                          <div className="p-2 text-center text-sm text-gray-500">
                            Showing first 100 of {filteredBoundaries.length} results
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Review Your Response</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Name:</span>
                      <p className="font-medium">{name}</p>
                    </div>
                    
                    {description && (
                      <div>
                        <span className="text-sm text-gray-500">Description:</span>
                        <p className="text-sm">{description}</p>
                      </div>
                    )}
                    
                    <div>
                      <span className="text-sm text-gray-500">Baseline:</span>
                      <p className="font-medium">
                        {baselines.find(b => b.id === baselineId)?.name || 'Not selected'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-sm text-gray-500">Normalization:</span>
                      <p className="font-medium">
                        {normalizationScope === 'affected_area' ? 'Affected Area Only' : 'National'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-sm text-gray-500">Affected Areas:</span>
                      <p className="font-medium">{selectedAreas.length} ADM2 areas selected</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedAreas.slice(0, 10).map(pcode => {
                          const area = adminBoundaries.find(b => b.admin_pcode === pcode);
                          return (
                            <span key={pcode} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {area?.name || pcode}
                            </span>
                          );
                        })}
                        {selectedAreas.length > 10 && (
                          <span className="text-xs text-gray-500">
                            +{selectedAreas.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      After creating the response, you can add layers (hazard events, assessments, interventions) 
                      to track how vulnerability changes over time.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : handleClose()}
            className="btn btn-secondary"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !name.trim()}
              className="btn btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn btn-primary"
            >
              {creating ? 'Creating...' : 'Create Response'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
