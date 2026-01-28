'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Eye, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

interface Props {
  responseId: string;
  layerType: string;
  effectDirection: string;
  weight: number;
  hazardEventId: string | null;
}

type PreviewSummary = {
  affected_areas: number;
  avg_adjustment: number;
  min_adjustment?: number;
  max_adjustment?: number;
  avg_current_score: number;
  avg_projected_score: number;
  significant_changes?: number;
  note?: string;
};

type SampleEffect = {
  admin_pcode: string;
  admin_name: string;
  current_score: number;
  adjustment: number;
  projected_score: number;
};

type PreviewResult = {
  status: string;
  layer_type: string;
  effect_direction: string;
  weight: number;
  adjustment_factor: number;
  preview: {
    summary: PreviewSummary;
    sample_effects: SampleEffect[];
  };
  error?: string;
};

export default function LayerEffectPreview({ 
  responseId, 
  layerType, 
  effectDirection, 
  weight, 
  hazardEventId 
}: Props) {
  const supabase = createClient();
  
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (effectDirection && weight > 0) {
      loadPreview();
    }
  }, [effectDirection, weight, hazardEventId]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('preview_layer_effect', {
        in_response_id: responseId,
        in_layer_type: layerType,
        in_effect_direction: effectDirection,
        in_weight: weight,
        in_hazard_event_id: hazardEventId || null
      });

      if (rpcError) throw rpcError;

      if (data?.error) {
        setError(data.error);
        return;
      }

      setPreview(data as PreviewResult);
    } catch (err: any) {
      console.error('Error loading preview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDirectionIcon = () => {
    if (effectDirection === 'increase') return <TrendingUp size={16} className="text-red-500" />;
    if (effectDirection === 'decrease') return <TrendingDown size={16} className="text-green-500" />;
    return <Minus size={16} className="text-gray-400" />;
  };

  if (effectDirection === 'neutral') {
    return (
      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-500 text-center">
        Neutral layers don't affect scores
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-500 text-center animate-pulse">
        Loading preview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-700 flex items-center gap-2">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  if (!preview) {
    return (
      <button
        onClick={loadPreview}
        className="w-full bg-gray-50 rounded-lg p-3 text-sm text-gray-600 hover:bg-gray-100 flex items-center justify-center gap-2"
      >
        <Eye size={16} />
        Preview Effect
      </button>
    );
  }

  const summary = preview.preview?.summary;
  const samples = preview.preview?.sample_effects || [];

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Eye size={16} />
          Effect Preview
        </h4>
        <span className="flex items-center gap-1 text-xs">
          {getDirectionIcon()}
          {effectDirection} × {weight}
        </span>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white rounded p-2">
            <div className="text-lg font-bold">{summary.affected_areas}</div>
            <div className="text-xs text-gray-500">Areas</div>
          </div>
          <div className="bg-white rounded p-2">
            <div className={`text-lg font-bold ${
              summary.avg_adjustment > 0 ? 'text-red-600' : 
              summary.avg_adjustment < 0 ? 'text-green-600' : ''
            }`}>
              {summary.avg_adjustment >= 0 ? '+' : ''}{summary.avg_adjustment.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">Avg Δ</div>
          </div>
          <div className="bg-white rounded p-2">
            <div className="text-lg font-bold">
              {summary.avg_current_score.toFixed(1)} → {summary.avg_projected_score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">Score Change</div>
          </div>
        </div>
      )}

      {summary?.note && (
        <div className="text-xs text-gray-500 italic">{summary.note}</div>
      )}

      {samples.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
            Sample effects ({samples.length} areas)
          </summary>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {samples.map((s, i) => (
              <div 
                key={i}
                className="flex items-center justify-between py-1 px-2 bg-white rounded"
              >
                <span className="truncate flex-1" title={s.admin_pcode}>
                  {s.admin_name}
                </span>
                <span className="flex items-center gap-2 text-right">
                  <span className="text-gray-500">{s.current_score.toFixed(1)}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`font-medium ${
                    s.projected_score > s.current_score ? 'text-red-600' :
                    s.projected_score < s.current_score ? 'text-green-600' : ''
                  }`}>
                    {s.projected_score.toFixed(1)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
