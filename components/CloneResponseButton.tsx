'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { Copy, Loader2, X } from 'lucide-react';

interface Props {
  responseId: string;
  responseName: string;
}

export default function CloneResponseButton({ responseId, responseName }: Props) {
  const supabase = createClient();
  const router = useRouter();
  
  const [showModal, setShowModal] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [newName, setNewName] = useState(`${responseName} (Copy)`);
  const [includeLayers, setIncludeLayers] = useState(true);
  const [includeScores, setIncludeScores] = useState(false);

  const handleClone = async () => {
    if (!newName.trim()) {
      alert('Please enter a name for the cloned response');
      return;
    }

    setCloning(true);
    try {
      // Fetch original response
      const { data: original, error: fetchError } = await supabase
        .from('responses')
        .select('*')
        .eq('id', responseId)
        .single();

      if (fetchError) throw fetchError;

      // Create new response
      const { data: newResponse, error: createError } = await supabase
        .from('responses')
        .insert({
          name: newName.trim(),
          description: original.description ? `Cloned from: ${responseName}\n\n${original.description}` : `Cloned from: ${responseName}`,
          baseline_id: original.baseline_id,
          legacy_instance_id: original.legacy_instance_id,
          admin_scope: original.admin_scope,
          normalization_scope: original.normalization_scope,
          status: 'draft'
        })
        .select()
        .single();

      if (createError) throw createError;

      // Clone layers if requested
      if (includeLayers) {
        const { data: layers } = await supabase
          .from('response_layers')
          .select('*')
          .eq('response_id', responseId)
          .order('order_index');

        if (layers && layers.length > 0) {
          const newLayers = layers.map(l => ({
            response_id: newResponse.id,
            name: l.name,
            layer_type: l.layer_type,
            effect_direction: l.effect_direction,
            weight: l.weight,
            reference_date: l.reference_date,
            order_index: l.order_index,
            config: l.config
          }));

          await supabase.from('response_layers').insert(newLayers);
        }
      }

      // Clone scores if requested (creates a snapshot)
      if (includeScores) {
        const { data: scores } = await supabase
          .from('response_scores')
          .select('*')
          .eq('response_id', responseId);

        if (scores && scores.length > 0) {
          const newScores = scores.map(s => ({
            response_id: newResponse.id,
            layer_id: null, // Don't clone layer-specific scores
            admin_pcode: s.admin_pcode,
            category: s.category,
            baseline_score: s.baseline_score,
            layer_adjustment: s.layer_adjustment,
            score: s.score,
            normalized_score: s.normalized_score
          }));

          await supabase.from('response_scores').insert(newScores);
        }
      }

      setShowModal(false);
      router.push(`/responses/${newResponse.id}`);
    } catch (err: any) {
      console.error('Clone error:', err);
      alert(`Clone failed: ${err.message}`);
    } finally {
      setCloning(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn btn-secondary flex items-center gap-1"
      >
        <Copy size={16} />
        Clone
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Clone Response</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New Response Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Enter name for cloned response"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Clone Options</label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLayers}
                    onChange={(e) => setIncludeLayers(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Include layers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeScores}
                    onChange={(e) => setIncludeScores(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Include computed scores (snapshot)</span>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p>
                  The cloned response will be created as a <strong>draft</strong> with the same:
                </p>
                <ul className="mt-1 ml-4 list-disc text-blue-700">
                  <li>Baseline configuration</li>
                  <li>Affected areas</li>
                  <li>Normalization settings</li>
                  {includeLayers && <li>Layer structure</li>}
                  {includeScores && <li>Current score snapshot</li>}
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={cloning || !newName.trim()}
                className="btn btn-primary flex items-center gap-1"
              >
                {cloning ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Copy size={16} />
                )}
                {cloning ? 'Cloning...' : 'Clone Response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
