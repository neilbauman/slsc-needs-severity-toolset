'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Settings, Globe, MapPin, RefreshCw, Info } from 'lucide-react';

interface Props {
  responseId: string;
  currentScope: 'national' | 'affected_area' | string | null;
  onUpdate: (newScope: string) => void;
}

export default function NormalizationSettings({ responseId, currentScope, onUpdate }: Props) {
  const supabase = createClient();
  
  const [scope, setScope] = useState<string>(currentScope || 'affected_area');
  const [saving, setSaving] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const handleScopeChange = async (newScope: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('responses')
        .update({ normalization_scope: newScope })
        .eq('id', responseId);

      if (error) throw error;
      
      setScope(newScope);
      onUpdate(newScope);
    } catch (err: any) {
      console.error('Error updating normalization scope:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleNormalize = async () => {
    setNormalizing(true);
    try {
      const { data, error } = await supabase.rpc('normalize_response_scores', {
        in_response_id: responseId
      });

      if (error) throw error;

      if (data?.error) {
        alert(`Error: ${data.error}`);
        return;
      }

      alert(`Normalization complete: ${data.rows_updated} scores updated using ${data.scope} scope`);
      onUpdate(scope);
    } catch (err: any) {
      console.error('Error normalizing scores:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setNormalizing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Settings size={18} />
          Normalization Settings
        </h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-400 hover:text-gray-600"
        >
          <Info size={18} />
        </button>
      </div>

      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium mb-1">What is Normalization Scope?</p>
          <p className="text-blue-700">
            Normalization determines how vulnerability scores (1-5) are calculated relative to the data range:
          </p>
          <ul className="mt-2 space-y-1 text-blue-700">
            <li>
              <strong>Affected Area:</strong> Scores are relative to the crisis zone only. 
              A "5" means highest vulnerability within affected areas.
            </li>
            <li>
              <strong>National:</strong> Scores are relative to the entire country. 
              A "5" means highest vulnerability nationwide.
            </li>
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleScopeChange('affected_area')}
          disabled={saving}
          className={`flex-1 p-3 rounded-lg border-2 transition-all ${
            scope === 'affected_area'
              ? 'border-blue-500 bg-blue-50 text-blue-800'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 justify-center mb-1">
            <MapPin size={18} />
            <span className="font-medium">Affected Area</span>
          </div>
          <p className="text-xs text-gray-500">
            Normalize within crisis zone
          </p>
        </button>

        <button
          onClick={() => handleScopeChange('national')}
          disabled={saving}
          className={`flex-1 p-3 rounded-lg border-2 transition-all ${
            scope === 'national'
              ? 'border-blue-500 bg-blue-50 text-blue-800'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 justify-center mb-1">
            <Globe size={18} />
            <span className="font-medium">National</span>
          </div>
          <p className="text-xs text-gray-500">
            Normalize against all areas
          </p>
        </button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-xs text-gray-500">
          After changing scope, re-normalize to update scores
        </p>
        <button
          onClick={handleNormalize}
          disabled={normalizing}
          className="btn btn-secondary text-sm flex items-center gap-1"
        >
          <RefreshCw size={14} className={normalizing ? 'animate-spin' : ''} />
          {normalizing ? 'Normalizing...' : 'Re-normalize Scores'}
        </button>
      </div>
    </div>
  );
}
