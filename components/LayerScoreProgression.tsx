'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3 } from 'lucide-react';

interface Props {
  responseId: string;
  selectedLayerId: string | null;
  onRefresh?: () => void;
}

type TimelineStep = {
  step: number;
  layer_id: string | null;
  name: string;
  type: string;
  effect_direction?: string;
  avg_score: number;
  delta_from_previous: number;
  cumulative_delta: number;
};

type ProgressionData = {
  response_id: string;
  baseline_avg: number;
  steps: TimelineStep[];
};

export default function LayerScoreProgression({ responseId, selectedLayerId, onRefresh }: Props) {
  const supabase = createClient();
  
  const [data, setData] = useState<ProgressionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProgression();
  }, [responseId]);

  const loadProgression = async () => {
    setLoading(true);
    setError(null);
    
    // Timeout helper
    const timeout = (ms: number) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    );
    
    try {
      // Try RPC first with timeout
      const rpcPromise = supabase.rpc('get_timeline_score_progression', {
        in_response_id: responseId
      });

      const { data: result, error: rpcError } = await Promise.race([
        rpcPromise,
        timeout(8000)
      ]) as any;

      if (rpcError) {
        // Fallback: Load directly from response_scores
        console.log('RPC failed, loading from response_scores directly');
        await loadFromScores();
        return;
      }
      
      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(result as ProgressionData);
    } catch (err: any) {
      console.error('Error loading progression:', err);
      if (err.message === 'Request timeout') {
        // Fallback: Try direct query
        await loadFromScores();
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Fallback: Load scores directly if RPC fails
  const loadFromScores = async () => {
    try {
      const { data: scores, error } = await supabase
        .from('response_scores')
        .select('admin_pcode, score, category')
        .eq('response_id', responseId)
        .eq('category', 'Overall')
        .is('layer_id', null);
      
      if (error) throw error;
      
      if (scores && scores.length > 0) {
        const avgScore = scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length;
        
        // Create simple baseline-only progression
        setData({
          response_id: responseId,
          baseline_avg: avgScore,
          steps: [{
            step: 0,
            layer_id: null,
            name: 'Baseline',
            type: 'baseline',
            avg_score: Math.round(avgScore * 100) / 100,
            delta_from_previous: 0,
            cumulative_delta: 0
          }]
        });
      } else {
        setError('No score data found');
      }
    } catch (err: any) {
      setError('Failed to load scores: ' + err.message);
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 2) return 'bg-green-500';
    if (score <= 3) return 'bg-yellow-500';
    if (score <= 4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score <= 2) return 'text-green-700';
    if (score <= 3) return 'text-yellow-700';
    if (score <= 4) return 'text-orange-700';
    return 'text-red-700';
  };

  const getDeltaIndicator = (delta: number) => {
    if (delta > 0.01) return <TrendingUp size={14} className="text-red-500" />;
    if (delta < -0.01) return <TrendingDown size={14} className="text-green-500" />;
    return <Minus size={14} className="text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
        <p className="text-sm text-gray-500">Loading score progression...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
        {error}
      </div>
    );
  }

  if (!data || !data.steps || data.steps.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
        No score data available
      </div>
    );
  }

  // Find currently selected step
  const selectedStep = data.steps.find(s => 
    selectedLayerId === null ? s.layer_id === null : s.layer_id === selectedLayerId
  );

  // Calculate max score for scaling
  const maxScore = 5;
  const minScore = 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <BarChart3 size={18} />
          Score Progression
        </h4>
        <button
          onClick={loadProgression}
          className="text-gray-400 hover:text-gray-600"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Visual Progression Chart */}
      <div className="bg-white border rounded-lg p-4">
        {/* Score scale reference */}
        <div className="flex justify-between text-xs text-gray-400 mb-2 px-1">
          <span>1 (Low)</span>
          <span>3 (Medium)</span>
          <span>5 (High)</span>
        </div>
        
        {/* Step bars */}
        <div className="space-y-2">
          {data.steps.map((step, index) => {
            const isSelected = selectedLayerId === null 
              ? step.layer_id === null 
              : step.layer_id === selectedLayerId;
            const barWidth = ((step.avg_score - minScore) / (maxScore - minScore)) * 100;
            
            return (
              <div 
                key={step.layer_id || 'baseline'}
                className={`relative transition-all ${isSelected ? 'scale-[1.02]' : ''}`}
              >
                {/* Label row */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                      {step.name}
                    </span>
                    {step.type !== 'baseline' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        step.type === 'hazard_impact' || step.type === 'hazard_prediction' 
                          ? 'bg-red-100 text-red-700' 
                          : step.type === 'intervention' 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {step.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {index > 0 && (
                      <span className={`text-xs flex items-center gap-0.5 ${
                        step.delta_from_previous > 0 ? 'text-red-600' :
                        step.delta_from_previous < 0 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {getDeltaIndicator(step.delta_from_previous)}
                        {step.delta_from_previous > 0 ? '+' : ''}{step.delta_from_previous.toFixed(2)}
                      </span>
                    )}
                    <span className={`text-sm font-bold ${getScoreTextColor(step.avg_score)}`}>
                      {step.avg_score.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                {/* Bar */}
                <div className={`relative h-6 bg-gray-100 rounded overflow-hidden ${
                  isSelected ? 'ring-2 ring-blue-400' : ''
                }`}>
                  {/* Background grid lines */}
                  <div className="absolute inset-0 flex">
                    {[1, 2, 3, 4].map(i => (
                      <div 
                        key={i} 
                        className="flex-1 border-r border-gray-200"
                      />
                    ))}
                  </div>
                  
                  {/* Score bar */}
                  <div 
                    className={`absolute left-0 top-0 h-full transition-all duration-300 ${getScoreColor(step.avg_score)}`}
                    style={{ width: `${barWidth}%` }}
                  />
                  
                  {/* Delta indicator line (showing change from previous) */}
                  {index > 0 && Math.abs(step.delta_from_previous) > 0.01 && (
                    <div 
                      className={`absolute top-0 h-full w-0.5 ${
                        step.delta_from_previous > 0 ? 'bg-red-600' : 'bg-green-600'
                      }`}
                      style={{ 
                        left: `${((data.steps[index - 1].avg_score - minScore) / (maxScore - minScore)) * 100}%` 
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Baseline</p>
          <p className={`text-lg font-bold ${getScoreTextColor(data.baseline_avg)}`}>
            {data.baseline_avg.toFixed(2)}
          </p>
        </div>
        
        {selectedStep && selectedStep.layer_id !== null && (
          <>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">At Selected Layer</p>
              <p className={`text-lg font-bold ${getScoreTextColor(selectedStep.avg_score)}`}>
                {selectedStep.avg_score.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Cumulative Δ</p>
              <p className={`text-lg font-bold flex items-center justify-center gap-1 ${
                selectedStep.cumulative_delta > 0 ? 'text-red-600' :
                selectedStep.cumulative_delta < 0 ? 'text-green-600' : 'text-gray-600'
              }`}>
                {getDeltaIndicator(selectedStep.cumulative_delta)}
                {selectedStep.cumulative_delta > 0 ? '+' : ''}
                {selectedStep.cumulative_delta.toFixed(2)}
              </p>
            </div>
          </>
        )}
        
        {(!selectedStep || selectedStep.layer_id === null) && (
          <>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Final Score</p>
              <p className={`text-lg font-bold ${getScoreTextColor(data.steps[data.steps.length - 1].avg_score)}`}>
                {data.steps[data.steps.length - 1].avg_score.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Total Δ</p>
              <p className={`text-lg font-bold flex items-center justify-center gap-1 ${
                data.steps[data.steps.length - 1].cumulative_delta > 0 ? 'text-red-600' :
                data.steps[data.steps.length - 1].cumulative_delta < 0 ? 'text-green-600' : 'text-gray-600'
              }`}>
                {getDeltaIndicator(data.steps[data.steps.length - 1].cumulative_delta)}
                {data.steps[data.steps.length - 1].cumulative_delta > 0 ? '+' : ''}
                {data.steps[data.steps.length - 1].cumulative_delta.toFixed(2)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Interpretation */}
      {selectedStep && selectedStep.layer_id !== null && (
        <div className={`text-sm p-3 rounded-lg ${
          selectedStep.delta_from_previous > 0.1 ? 'bg-red-50 text-red-800' :
          selectedStep.delta_from_previous < -0.1 ? 'bg-green-50 text-green-800' :
          'bg-gray-50 text-gray-700'
        }`}>
          <strong>{selectedStep.name}</strong>
          {selectedStep.delta_from_previous > 0.1 && (
            <> increased average vulnerability by <strong>+{selectedStep.delta_from_previous.toFixed(2)}</strong> points</>
          )}
          {selectedStep.delta_from_previous < -0.1 && (
            <> decreased average vulnerability by <strong>{selectedStep.delta_from_previous.toFixed(2)}</strong> points</>
          )}
          {Math.abs(selectedStep.delta_from_previous) <= 0.1 && (
            <> had minimal impact on overall vulnerability scores</>
          )}
        </div>
      )}
    </div>
  );
}
