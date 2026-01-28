'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Plus, Trash2, Edit2, ChevronUp, ChevronDown, Save } from 'lucide-react';
import LayerEffectPreview from './LayerEffectPreview';

interface Props {
  responseId: string;
  onUpdate?: () => void;
}

type Layer = {
  id: string;
  name: string;
  layer_type: string;
  order_index: number;
  effect_direction: string;
  weight: number;
  reference_date: string | null;
};

type HazardEvent = {
  id: string;
  name: string;
  event_type: string;
  created_at: string | null;
};

const LAYER_TYPES = [
  { value: 'hazard_prediction', label: 'Hazard Prediction', description: 'Forecasted hazard impact' },
  { value: 'hazard_impact', label: 'Hazard Impact', description: 'Actual hazard occurrence' },
  { value: 'assessment', label: 'Assessment', description: 'Field assessment data' },
  { value: 'intervention', label: 'Intervention', description: 'Humanitarian response activities' },
  { value: 'monitoring', label: 'Monitoring', description: 'Ongoing monitoring data' },
];

const EFFECT_DIRECTIONS = [
  { value: 'increase', label: 'Increase Vulnerability', color: 'text-red-600' },
  { value: 'decrease', label: 'Decrease Vulnerability', color: 'text-green-600' },
  { value: 'neutral', label: 'Neutral', color: 'text-gray-600' },
];

export default function LayerManagementPanel({ responseId, onUpdate }: Props) {
  const supabase = createClient();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [hazardEvents, setHazardEvents] = useState<HazardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('hazard_impact');
  const [formEffect, setFormEffect] = useState('increase');
  const [formWeight, setFormWeight] = useState(1.0);
  const [formDate, setFormDate] = useState('');
  const [formHazardEventId, setFormHazardEventId] = useState('');

  useEffect(() => {
    loadData();
  }, [responseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load layers
      const { data: layersData, error: layersError } = await supabase
        .from('response_layers')
        .select('*')
        .eq('response_id', responseId)
        .order('order_index');

      if (layersError) throw layersError;
      setLayers(layersData || []);

      // Load available hazard events
      const { data: eventsData } = await supabase
        .from('hazard_events')
        .select('id, name, event_type, created_at')
        .order('created_at', { ascending: false });

      setHazardEvents(eventsData || []);
    } catch (err) {
      console.error('Error loading layers:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormType('hazard_impact');
    setFormEffect('increase');
    setFormWeight(1.0);
    setFormDate('');
    setFormHazardEventId('');
    setEditingLayer(null);
  };

  const openEditModal = (layer: Layer) => {
    setEditingLayer(layer);
    setFormName(layer.name);
    setFormType(layer.layer_type);
    setFormEffect(layer.effect_direction);
    setFormWeight(layer.weight);
    setFormDate(layer.reference_date || '');
    setShowAddModal(true);
  };

  const handleSaveLayer = async () => {
    if (!formName.trim()) {
      alert('Please enter a layer name');
      return;
    }

    setSaving(true);
    try {
      const layerData = {
        response_id: responseId,
        name: formName.trim(),
        layer_type: formType,
        effect_direction: formEffect,
        weight: formWeight,
        reference_date: formDate || null,
        order_index: editingLayer ? editingLayer.order_index : layers.length + 1,
      };

      if (editingLayer) {
        // Update existing
        const { error } = await supabase
          .from('response_layers')
          .update(layerData)
          .eq('id', editingLayer.id);

        if (error) throw error;
      } else {
        // Create new
        const { data: newLayer, error } = await supabase
          .from('response_layers')
          .insert(layerData)
          .select()
          .single();

        if (error) throw error;

        // If hazard event selected, link it
        if (formHazardEventId && newLayer) {
          await supabase
            .from('layer_hazard_events')
            .insert({
              layer_id: newLayer.id,
              hazard_event_id: formHazardEventId,
              weight: 1.0
            });
        }
      }

      setShowAddModal(false);
      resetForm();
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      console.error('Error saving layer:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLayer = async (layerId: string) => {
    if (!confirm('Delete this layer? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('response_layers')
        .delete()
        .eq('id', layerId);

      if (error) throw error;
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      console.error('Error deleting layer:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleReorderLayer = async (layerId: string, direction: 'up' | 'down') => {
    const index = layers.findIndex(l => l.id === layerId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= layers.length) return;

    const currentLayer = layers[index];
    const swapLayer = layers[newIndex];

    try {
      // Swap order_index values
      await supabase
        .from('response_layers')
        .update({ order_index: swapLayer.order_index })
        .eq('id', currentLayer.id);

      await supabase
        .from('response_layers')
        .update({ order_index: currentLayer.order_index })
        .eq('id', swapLayer.id);

      await loadData();
      onUpdate?.();
    } catch (err: any) {
      console.error('Error reordering layers:', err);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      hazard_prediction: 'bg-orange-100 text-orange-800',
      hazard_impact: 'bg-red-100 text-red-800',
      assessment: 'bg-blue-100 text-blue-800',
      intervention: 'bg-green-100 text-green-800',
      monitoring: 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getEffectBadgeColor = (effect: string) => {
    const colors: Record<string, string> = {
      increase: 'bg-red-100 text-red-800',
      decrease: 'bg-green-100 text-green-800',
      neutral: 'bg-gray-100 text-gray-800',
    };
    return colors[effect] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading layers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Response Layers</h3>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="btn btn-primary flex items-center gap-1"
        >
          <Plus size={16} />
          Add Layer
        </button>
      </div>

      {layers.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center border rounded-lg">
          No layers defined. Add layers to track temporal changes to vulnerability.
        </div>
      ) : (
        <div className="space-y-2">
          {layers.map((layer, index) => (
            <div 
              key={layer.id} 
              className="border rounded-lg p-3 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleReorderLayer(layer.id, 'up')}
                    disabled={index === 0}
                    className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleReorderLayer(layer.id, 'down')}
                    disabled={index === layers.length - 1}
                    className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{layer.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getTypeBadgeColor(layer.layer_type)}`}>
                      {layer.layer_type.replace('_', ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getEffectBadgeColor(layer.effect_direction)}`}>
                      {layer.effect_direction}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {layer.reference_date 
                      ? new Date(layer.reference_date).toLocaleDateString()
                      : 'No date'}
                    {layer.weight !== 1 && ` • Weight: ${layer.weight}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(layer)}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                  title="Edit layer"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteLayer(layer.id)}
                  className="p-1.5 hover:bg-red-100 rounded text-red-500"
                  title="Delete layer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Layer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">
              {editingLayer ? 'Edit Layer' : 'Add New Layer'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Layer Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Typhoon Impact, Field Assessment"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Layer Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {LAYER_TYPES.map(lt => (
                    <option key={lt.value} value={lt.value}>
                      {lt.label} - {lt.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Effect on Vulnerability</label>
                <select
                  value={formEffect}
                  onChange={(e) => setFormEffect(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {EFFECT_DIRECTIONS.map(ed => (
                    <option key={ed.value} value={ed.value}>
                      {ed.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formEffect === 'increase' && 'This layer will increase vulnerability scores (e.g., hazard events)'}
                  {formEffect === 'decrease' && 'This layer will decrease vulnerability scores (e.g., interventions)'}
                  {formEffect === 'neutral' && 'This layer provides context without directly affecting scores'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Reference Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Weight</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formWeight}
                    onChange={(e) => setFormWeight(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {!editingLayer && (formType === 'hazard_impact' || formType === 'hazard_prediction') && hazardEvents.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Link Hazard Event (optional)</label>
                  <select
                    value={formHazardEventId}
                    onChange={(e) => setFormHazardEventId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">None</option>
                    {hazardEvents.map(he => (
                      <option key={he.id} value={he.id}>
                        {he.name} ({he.event_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Layer Effect Preview */}
              {formEffect !== 'neutral' && (
                <LayerEffectPreview
                  responseId={responseId}
                  layerType={formType}
                  effectDirection={formEffect}
                  weight={formWeight}
                  hazardEventId={formHazardEventId || null}
                />
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLayer}
                disabled={saving || !formName.trim()}
                className="btn btn-primary flex items-center gap-1"
              >
                <Save size={16} />
                {saving ? 'Saving...' : editingLayer ? 'Update Layer' : 'Add Layer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
