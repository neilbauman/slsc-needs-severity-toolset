'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';

// Dynamically import map component to avoid SSR issues with Leaflet
const ResponseComparisonMap = dynamic(
  () => import('@/components/ResponseComparisonMap'),
  { ssr: false, loading: () => <div className="h-[400px] bg-gray-100 flex items-center justify-center">Loading map...</div> }
);

import LayerManagementPanel from '@/components/LayerManagementPanel';
import AffectedAreaEditor from '@/components/AffectedAreaEditor';
import ValidationMetricsPanel from '@/components/ValidationMetricsPanel';
import NormalizationSettings from '@/components/NormalizationSettings';
import ExportResponseButton from '@/components/ExportResponseButton';
import CloneResponseButton from '@/components/CloneResponseButton';
import LayerTimelineNavigation from '@/components/LayerTimelineNavigation';
import LayerScoreProgression from '@/components/LayerScoreProgression';
import ScoringFlowDiagram from '@/components/ScoringFlowDiagram';
import ResponseMetricsPanel from '@/components/ResponseMetricsPanel';

// Dynamically import map to avoid SSR issues
const LayerScoreMap = dynamic(
  () => import('@/components/LayerScoreMap'),
  { ssr: false, loading: () => <div className="h-[400px] bg-gray-100 flex items-center justify-center rounded-lg">Loading map...</div> }
);

type Response = {
  id: string;
  name: string;
  description: string | null;
  admin_scope: string[] | null;
  status: string | null;
  normalization_scope: string | null;
  baseline_id: string | null;
  legacy_instance_id: string | null;
  country_id: string | null;
  population_dataset_id: string | null;
  poverty_dataset_id: string | null;
  created_at: string | null;
};

type Layer = {
  id: string;
  name: string;
  layer_type: string;
  effect_direction: string;
  order_index: number;
  reference_date: string | null;
  weight: number;
};

// Process tab types
type ProcessTab = 
  | 'configuration'
  | 'affected-area' 
  | 'baseline' 
  | 'comparison'
  | { type: 'layer'; layerId: string; layerType: string; name: string };

type ScoreSummary = {
  category: string;
  avg_score: number;
  min_score: number;
  max_score: number;
  avg_baseline: number;
  avg_adjustment: number;
  area_count: number;
};

type ComparisonData = {
  admin_pcode: string;
  admin_name: string | null;
  legacy_score: number | null;
  response_score: number | null;
  delta: number | null;
};

export default function ResponseDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const responseId = params.id;
  
  const [response, setResponse] = useState<Response | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary[] | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProcessTab>('configuration');
  const [legacyInstanceName, setLegacyInstanceName] = useState<string | null>(null);
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0);
  const [datasetsForCountry, setDatasetsForCountry] = useState<{ id: string; name: string; type: string; admin_level: string }[]>([]);

  // Group layers by type for process tabs
  const hazardLayers = layers.filter(l => l.layer_type === 'hazard_prediction' || l.layer_type === 'hazard_impact');
  const assessmentLayers = layers.filter(l => l.layer_type === 'assessment');
  const interventionLayers = layers.filter(l => l.layer_type === 'intervention');
  const monitoringLayers = layers.filter(l => l.layer_type === 'monitoring');

  // Get current layer ID for map display
  const getCurrentLayerId = (): string | null => {
    if (typeof activeTab === 'object' && activeTab.type === 'layer') {
      return activeTab.layerId;
    }
    if (activeTab === 'baseline') return null; // Baseline = no layer
    return null;
  };

  const loadResponse = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch response details
      const { data: respData, error: respError } = await supabase
        .from('responses')
        .select('*')
        .eq('id', responseId)
        .single();
      
      if (respError) throw respError;
      setResponse(respData);

      // Fetch datasets for this response's country (for population/poverty selectors)
      if (respData?.country_id) {
        const { data: ds } = await supabase
          .from('datasets')
          .select('id, name, type, admin_level')
          .eq('country_id', respData.country_id)
          .eq('type', 'numeric')
          .order('name');
        setDatasetsForCountry(ds || []);
      } else {
        setDatasetsForCountry([]);
      }
      
      // Fetch layers
      const { data: layersData, error: layersError } = await supabase
        .from('response_layers')
        .select('*')
        .eq('response_id', responseId)
        .order('order_index');
      
      if (layersError) throw layersError;
      setLayers(layersData || []);
      
      // Fetch legacy instance name if linked
      if (respData.legacy_instance_id) {
        const { data: instData } = await supabase
          .from('instances')
          .select('name')
          .eq('id', respData.legacy_instance_id)
          .single();
        setLegacyInstanceName(instData?.name || null);
      }
      
      // Load score summary
      await loadScoreSummary(null);
      
      // Load comparison data if legacy instance exists
      if (respData.legacy_instance_id) {
        await loadComparisonData(respData.legacy_instance_id);
      }
      
    } catch (err: any) {
      console.error('Error loading response:', err);
      setError(err.message || 'Failed to load response');
    } finally {
      setLoading(false);
    }
  };

  const loadScoreSummary = async (layerId: string | null) => {
    try {
      const { data, error } = await supabase.rpc('get_response_score_summary', {
        in_response_id: responseId,
        in_layer_id: layerId
      });
      
      if (error) throw error;
      setScoreSummary(data?.categories || null);
    } catch (err: any) {
      console.error('Error loading score summary:', err);
    }
  };

  const loadComparisonData = async (legacyInstanceId: string) => {
    try {
      // Get response scores
      const { data: responseScores, error: respScoreError } = await supabase
        .from('response_scores')
        .select('admin_pcode, score')
        .eq('response_id', responseId)
        .eq('category', 'Overall')
        .is('layer_id', null);
      
      if (respScoreError) throw respScoreError;
      
      // Get legacy instance scores
      const { data: legacyScores, error: legacyError } = await supabase
        .from('instance_category_scores')
        .select('admin_pcode, score')
        .eq('instance_id', legacyInstanceId)
        .eq('category', 'Overall');
      
      if (legacyError) throw legacyError;
      
      // Get admin names
      const allPcodes = new Set([
        ...(responseScores || []).map(s => s.admin_pcode),
        ...(legacyScores || []).map(s => s.admin_pcode)
      ]);
      
      const { data: adminNames } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name')
        .in('admin_pcode', Array.from(allPcodes));
      
      const nameMap = new Map((adminNames || []).map(a => [a.admin_pcode, a.name]));
      
      // Build comparison map
      const legacyMap = new Map((legacyScores || []).map(s => [s.admin_pcode, s.score]));
      const responseMap = new Map((responseScores || []).map(s => [s.admin_pcode, s.score]));
      
      const comparison: ComparisonData[] = Array.from(allPcodes).map(pcode => {
        const legacy = legacyMap.get(pcode) ?? null;
        const resp = responseMap.get(pcode) ?? null;
        return {
          admin_pcode: pcode,
          admin_name: nameMap.get(pcode) || null,
          legacy_score: legacy,
          response_score: resp,
          delta: (legacy !== null && resp !== null) ? resp - legacy : null
        };
      }).sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0));
      
      setComparisonData(comparison);
    } catch (err: any) {
      console.error('Error loading comparison data:', err);
    }
  };

  const computeScores = async () => {
    setComputing(true);
    try {
      const { data, error } = await supabase.rpc('compute_response_scores', {
        in_response_id: responseId,
        in_up_to_layer_id: selectedLayerId
      });
      
      if (error) throw error;
      
      // Reload data
      await loadScoreSummary(selectedLayerId);
      if (response?.legacy_instance_id) {
        await loadComparisonData(response.legacy_instance_id);
      }
      setMetricsRefreshKey((k) => k + 1);
      
      alert(`Scores computed: ${data.total_scores} scores across ${data.layers_included || 0} layers`);
    } catch (err: any) {
      console.error('Error computing scores:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => {
    loadResponse();
  }, [responseId]);

  useEffect(() => {
    if (selectedLayerId !== null) {
      loadScoreSummary(selectedLayerId);
    }
  }, [selectedLayerId]);

  // Load scores when switching to a layer tab
  useEffect(() => {
    if (typeof activeTab === 'object' && activeTab.type === 'layer') {
      loadScoreSummary(activeTab.layerId);
    } else if (activeTab === 'baseline') {
      loadScoreSummary(null);
    }
  }, [activeTab]);

  const getLayerTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      hazard_prediction: 'bg-orange-100 text-orange-800',
      hazard_impact: 'bg-red-100 text-red-800',
      assessment: 'bg-blue-100 text-blue-800',
      intervention: 'bg-green-100 text-green-800',
      monitoring: 'bg-purple-100 text-purple-800',
      custom: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  const getEffectBadge = (direction: string) => {
    const colors: Record<string, string> = {
      increase: 'bg-red-100 text-red-800',
      decrease: 'bg-green-100 text-green-800',
      mixed: 'bg-yellow-100 text-yellow-800',
    };
    return colors[direction] || 'bg-gray-100 text-gray-600';
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">Loading response...</div>
      </div>
    );
  }

  if (error || !response) {
    return (
      <div className="p-4">
        <div className="card p-4 border-red-300 bg-red-50">
          <h2 className="font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-sm text-red-700">{error || 'Response not found'}</p>
          <Link href="/responses" className="btn btn-secondary mt-4">
            Back to Responses
          </Link>
        </div>
      </div>
    );
  }

  const stats = {
    avgDelta: comparisonData.length > 0 
      ? comparisonData.reduce((sum, c) => sum + Math.abs(c.delta || 0), 0) / comparisonData.filter(c => c.delta !== null).length
      : 0,
    maxDelta: Math.max(...comparisonData.map(c => Math.abs(c.delta || 0))),
    areasWithDelta: comparisonData.filter(c => c.delta !== null && Math.abs(c.delta) > 0.1).length,
    correlation: calculateCorrelation(comparisonData),
  };

  // Helper to check if tab is active
  const isTabActive = (tab: ProcessTab): boolean => {
    if (typeof activeTab === 'string' && typeof tab === 'string') {
      return activeTab === tab;
    }
    if (typeof activeTab === 'object' && typeof tab === 'object') {
      return activeTab.layerId === tab.layerId;
    }
    return false;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Breadcrumb with Response Name */}
      <nav className="text-sm text-gray-500 mb-2">
        <Link href="/" className="hover:text-gray-700">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/responses" className="hover:text-gray-700">Responses</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900 font-medium">{response.name}</span>
      </nav>

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--gsc-blue)' }}>
              {response.name}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded ${
              response.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {response.status || 'active'}
            </span>
          </div>
          {response.description && (
            <p className="text-sm text-gray-500 mt-1">{response.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <ExportResponseButton 
            responseId={responseId} 
            responseName={response.name} 
          />
          <CloneResponseButton
            responseId={responseId}
            responseName={response.name}
          />
          {response.legacy_instance_id && (
            <Link href={`/instances/${response.legacy_instance_id}`} className="btn btn-secondary">
              View Legacy Instance
            </Link>
          )}
          <Link href="/responses" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </header>

      {/* Process Tab Navigation - Follows workflow sequence */}
      <div className="border-b overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {/* 0. Configuration */}
          <button
            onClick={() => setActiveTab('configuration')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'configuration'
                ? 'border-purple-600 text-purple-600 bg-purple-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center">0</span>
              Configuration
            </span>
          </button>

          {/* 1. Affected Area */}
          <button
            onClick={() => setActiveTab('affected-area')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'affected-area'
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center">1</span>
              Affected Area
            </span>
          </button>

          {/* 2. Baseline */}
          <button
            onClick={() => setActiveTab('baseline')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'baseline'
                ? 'border-green-600 text-green-600 bg-green-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center">2</span>
              Baseline
            </span>
          </button>

          {/* 3+ Hazard Layers */}
          {hazardLayers.map((layer, idx) => (
            <button
              key={layer.id}
              onClick={() => setActiveTab({ type: 'layer', layerId: layer.id, layerType: layer.layer_type, name: layer.name })}
              className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                typeof activeTab === 'object' && activeTab.layerId === layer.id
                  ? 'border-red-600 text-red-600 bg-red-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs flex items-center justify-center">
                  {3 + idx}
                </span>
                {layer.name.length > 20 ? layer.name.slice(0, 18) + '...' : layer.name}
              </span>
            </button>
          ))}

          {/* Assessment Layers */}
          {assessmentLayers.map((layer, idx) => (
            <button
              key={layer.id}
              onClick={() => setActiveTab({ type: 'layer', layerId: layer.id, layerType: layer.layer_type, name: layer.name })}
              className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                typeof activeTab === 'object' && activeTab.layerId === layer.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center">
                  {3 + hazardLayers.length + idx}
                </span>
                {layer.name.length > 20 ? layer.name.slice(0, 18) + '...' : layer.name}
              </span>
            </button>
          ))}

          {/* Intervention Layers */}
          {interventionLayers.map((layer, idx) => (
            <button
              key={layer.id}
              onClick={() => setActiveTab({ type: 'layer', layerId: layer.id, layerType: layer.layer_type, name: layer.name })}
              className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                typeof activeTab === 'object' && activeTab.layerId === layer.id
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center">
                  {3 + hazardLayers.length + assessmentLayers.length + idx}
                </span>
                {layer.name.length > 20 ? layer.name.slice(0, 18) + '...' : layer.name}
              </span>
            </button>
          ))}

          {/* Comparison Tab (at end) */}
          {response.legacy_instance_id && (
            <button
              onClick={() => setActiveTab('comparison')}
              className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ml-auto ${
                activeTab === 'comparison'
                  ? 'border-purple-600 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                ⚖️ Compare Legacy
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Scoring Flow Diagram - Shown on all tabs */}
      <ScoringFlowDiagram compact={true} />

      {/* Population / PoC / PiN metrics - shown for baseline and layer tabs */}
      {(activeTab === 'baseline' || (typeof activeTab === 'object' && activeTab.type === 'layer')) && (
        <ResponseMetricsPanel
          responseId={responseId}
          layerId={getCurrentLayerId()}
          refreshKey={metricsRefreshKey}
        />
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Response Configuration */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-sm flex items-center justify-center">0</span>
                Response Configuration
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure the basic information and metadata for this response. This includes the response name, description, and other identifying information.
              </p>

              {/* Response Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Response Name *
                </label>
                <input
                  type="text"
                  value={response.name}
                  onChange={async (e) => {
                    const newName = e.target.value;
                    try {
                      const { error } = await supabase
                        .from('responses')
                        .update({ name: newName })
                        .eq('id', responseId);
                      if (error) throw error;
                      setResponse(prev => prev ? { ...prev, name: newName } : null);
                    } catch (err: any) {
                      console.error('Error updating response name:', err);
                      alert(`Error: ${err.message}`);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter response name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This name will appear in breadcrumbs and response lists
                </p>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={response.description || ''}
                  onChange={async (e) => {
                    const newDescription = e.target.value;
                    try {
                      const { error } = await supabase
                        .from('responses')
                        .update({ description: newDescription || null })
                        .eq('id', responseId);
                      if (error) throw error;
                      setResponse(prev => prev ? { ...prev, description: newDescription || null } : null);
                    } catch (err: any) {
                      console.error('Error updating description:', err);
                      alert(`Error: ${err.message}`);
                    }
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Describe this response scenario..."
                />
              </div>

              {/* Status */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={response.status || 'active'}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    try {
                      const { error } = await supabase
                        .from('responses')
                        .update({ status: newStatus })
                        .eq('id', responseId);
                      if (error) throw error;
                      setResponse(prev => prev ? { ...prev, status: newStatus } : null);
                    } catch (err: any) {
                      console.error('Error updating status:', err);
                      alert(`Error: ${err.message}`);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Population / Poverty datasets for PoC and PiN */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Reference datasets (PoC / PiN)</h4>
                <p className="text-xs text-gray-500 mb-2">
                  Optional. Used for Total Population, People of Concern (PoC), and People in Need (PiN). Left blank = auto-detect by name.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Population dataset</label>
                    <select
                      value={response.population_dataset_id || ''}
                      onChange={async (e) => {
                        const id = e.target.value || null;
                        try {
                          const { error } = await supabase.from('responses').update({ population_dataset_id: id }).eq('id', responseId);
                          if (error) throw error;
                          setResponse(prev => prev ? { ...prev, population_dataset_id: id } : null);
                          setMetricsRefreshKey(k => k + 1);
                        } catch (err: any) {
                          console.error(err);
                          alert(`Error: ${err.message}`);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Auto-detect (population/pop)</option>
                      {datasetsForCountry.filter(d => /population|pop/i.test(d.name)).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                      {datasetsForCountry.filter(d => !/population|pop/i.test(d.name)).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Poverty dataset (for PiN)</label>
                    <select
                      value={response.poverty_dataset_id || ''}
                      onChange={async (e) => {
                        const id = e.target.value || null;
                        try {
                          const { error } = await supabase.from('responses').update({ poverty_dataset_id: id }).eq('id', responseId);
                          if (error) throw error;
                          setResponse(prev => prev ? { ...prev, poverty_dataset_id: id } : null);
                          setMetricsRefreshKey(k => k + 1);
                        } catch (err: any) {
                          console.error(err);
                          alert(`Error: ${err.message}`);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">None</option>
                      {datasetsForCountry.filter(d => /poverty/i.test(d.name)).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                      {datasetsForCountry.filter(d => !/poverty/i.test(d.name)).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Metadata Info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800 font-medium mb-1">Response Metadata</p>
                <div className="text-xs text-purple-700 space-y-1">
                  <p><strong>Created:</strong> {response.created_at ? new Date(response.created_at).toLocaleDateString() : 'N/A'}</p>
                  <p><strong>ID:</strong> <code className="text-xs">{responseId}</code></p>
                  {response.legacy_instance_id && (
                    <p><strong>Legacy Instance:</strong> {legacyInstanceName || response.legacy_instance_id}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Affected Area Definition */}
            <div className="card p-4">
              <h4 className="font-semibold mb-3">Affected Area Definition</h4>
              <p className="text-sm text-gray-600 mb-4">
                Define the geographic scope of this response. All scoring and analysis will be limited to these administrative areas.
              </p>
              <AffectedAreaEditor
                responseId={responseId}
                currentScope={response.admin_scope || []}
                onUpdate={(newScope) => {
                  setResponse(prev => prev ? { ...prev, admin_scope: newScope } : null);
                }}
              />
            </div>

            {/* Normalization Settings */}
            <div className="card p-4">
              <NormalizationSettings
                responseId={responseId}
                currentScope={response.normalization_scope}
                onUpdate={(newScope) => {
                  setResponse(prev => prev ? { ...prev, normalization_scope: newScope } : null);
                  loadScoreSummary(null);
                }}
              />
            </div>
          </div>

          {/* Right: Summary and Map */}
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="card p-4">
              <h4 className="font-semibold mb-3">Response Summary</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600">{response.admin_scope?.length || 0}</p>
                  <p className="text-xs text-gray-600">ADM2 Areas</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{layers.length}</p>
                  <p className="text-xs text-gray-600">Layers</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{hazardLayers.length}</p>
                  <p className="text-xs text-gray-600">Hazards</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">{assessmentLayers.length + interventionLayers.length}</p>
                  <p className="text-xs text-gray-600">Assessments/Interventions</p>
                </div>
              </div>
            </div>

            {/* Map Preview */}
            <div className="card p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <span className="text-gray-500">📍</span> Affected Area Preview
              </h4>
              <LayerScoreMap
                responseId={responseId}
                layerId={null}
                adminScope={response.admin_scope || []}
              />
            </div>
          </div>
        </div>
      )}

      {/* Affected Area Tab */}
      {activeTab === 'affected-area' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Configuration */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm flex items-center justify-center">1</span>
                Define Affected Area
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Select the administrative areas (ADM2 provinces) that are affected by this crisis.
                All subsequent scoring will be scoped to these areas.
              </p>
              <AffectedAreaEditor
                responseId={responseId}
                currentScope={response.admin_scope || []}
                onUpdate={(newScope) => {
                  setResponse(prev => prev ? { ...prev, admin_scope: newScope } : null);
                }}
              />
            </div>

            <div className="card p-4">
              <NormalizationSettings
                responseId={responseId}
                currentScope={response.normalization_scope}
                onUpdate={(newScope) => {
                  setResponse(prev => prev ? { ...prev, normalization_scope: newScope } : null);
                  loadScoreSummary(null);
                }}
              />
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{response.admin_scope?.length || 0}</p>
                <p className="text-xs text-gray-500">ADM2 Areas Selected</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-2xl font-bold text-gray-600">{layers.length}</p>
                <p className="text-xs text-gray-500">Response Layers</p>
              </div>
            </div>
          </div>

          {/* Right: Map showing affected area */}
          <div className="card p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <span className="text-gray-500">📍</span> Affected Area Map
            </h4>
            <LayerScoreMap
              responseId={responseId}
              layerId={null}
              adminScope={response.admin_scope || []}
            />
          </div>
        </div>
      )}

      {/* Baseline Tab */}
      {activeTab === 'baseline' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Baseline Info */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-sm flex items-center justify-center">2</span>
                Pre-Crisis Baseline
              </h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-medium">Vulnerability Scores Before Crisis</p>
                <p className="text-sm text-green-700 mt-1">
                  This represents the underlying vulnerability of each area before any hazard events.
                  These baseline scores are derived from demographic, infrastructure, and socioeconomic data.
                </p>
                {response.legacy_instance_id && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <span>📊</span> Sourced from legacy instance scores
                  </p>
                )}
              </div>

              {/* Score Summary */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Score Summary</h4>
                <button 
                  onClick={computeScores} 
                  disabled={computing}
                  className="btn btn-sm btn-primary"
                >
                  {computing ? 'Computing...' : 'Recompute'}
                </button>
              </div>
              
              {scoreSummary && scoreSummary.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs">
                        <th className="py-2 pr-2">Category</th>
                        <th className="py-2 pr-2 text-right">Avg</th>
                        <th className="py-2 pr-2 text-right">Min</th>
                        <th className="py-2 pr-2 text-right">Max</th>
                        <th className="py-2 pr-2 text-right">Areas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoreSummary.map((cat) => (
                        <tr key={cat.category} className="border-t">
                          <td className="py-2 pr-2 font-medium text-xs">{cat.category}</td>
                          <td className="py-2 pr-2 text-right">{cat.avg_score?.toFixed(2)}</td>
                          <td className="py-2 pr-2 text-right text-gray-500">{cat.min_score?.toFixed(2)}</td>
                          <td className="py-2 pr-2 text-right text-gray-500">{cat.max_score?.toFixed(2)}</td>
                          <td className="py-2 pr-2 text-right text-gray-500">{cat.area_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No baseline scores yet. Click "Recompute" to generate.</p>
              )}
            </div>
          </div>

          {/* Right: Baseline Map */}
          <div className="card p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <span className="text-gray-500">🗺️</span> Baseline Vulnerability Map
            </h4>
            <LayerScoreMap
              responseId={responseId}
              layerId={null}
              adminScope={response.admin_scope || []}
            />
          </div>
        </div>
      )}

      {/* Layer Tabs (Hazards, Assessments, Interventions) */}
      {typeof activeTab === 'object' && activeTab.type === 'layer' && (() => {
        const layer = layers.find(l => l.id === activeTab.layerId);
        if (!layer) return <div className="text-gray-500">Layer not found</div>;
        
        const layerIndex = layers.findIndex(l => l.id === layer.id);
        const tabNumber = 3 + layerIndex;
        
        const colorClass = layer.layer_type.includes('hazard') ? 'red' : 
                          layer.layer_type === 'assessment' ? 'blue' : 
                          layer.layer_type === 'intervention' ? 'emerald' : 'gray';

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Layer Info */}
            <div className="space-y-4">
              <div className="card p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full bg-${colorClass}-100 text-${colorClass}-700 text-sm flex items-center justify-center`}>
                    {tabNumber}
                  </span>
                  {layer.name}
                </h3>
                
                {/* Layer details */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className={`bg-${colorClass}-50 rounded-lg p-3`}>
                    <p className="text-xs text-gray-500">Type</p>
                    <p className={`font-medium text-sm text-${colorClass}-700`}>
                      {layer.layer_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Effect</p>
                    <p className={`font-medium text-sm ${
                      layer.effect_direction === 'increase' ? 'text-red-700' :
                      layer.effect_direction === 'decrease' ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {layer.effect_direction === 'increase' ? '↑ Increases Severity' :
                       layer.effect_direction === 'decrease' ? '↓ Decreases Severity' : '— Neutral'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Weight</p>
                    <p className="font-medium text-sm">{layer.weight}x multiplier</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="font-medium text-sm">
                      {layer.reference_date 
                        ? new Date(layer.reference_date).toLocaleDateString()
                        : 'Not set'}
                    </p>
                  </div>
                </div>

                {/* Impact description */}
                <div className={`bg-${colorClass}-50 border border-${colorClass}-200 rounded-lg p-3`}>
                  {layer.layer_type.includes('hazard') && (
                    <>
                      <p className={`text-${colorClass}-800 font-medium`}>Hazard Event Impact</p>
                      <p className="text-sm text-gray-600 mt-1">
                        This layer applies the impact of a hazard event, increasing vulnerability scores
                        in affected areas based on exposure and intensity data.
                      </p>
                    </>
                  )}
                  {layer.layer_type === 'assessment' && (
                    <>
                      <p className="text-blue-800 font-medium">Field Assessment Data</p>
                      <p className="text-sm text-gray-600 mt-1">
                        This layer incorporates field assessment findings, adjusting scores based on
                        observed conditions and community-level data.
                      </p>
                    </>
                  )}
                  {layer.layer_type === 'intervention' && (
                    <>
                      <p className="text-emerald-800 font-medium">Humanitarian Intervention</p>
                      <p className="text-sm text-gray-600 mt-1">
                        This layer reflects humanitarian response activities, typically decreasing
                        vulnerability scores where aid has been delivered.
                      </p>
                    </>
                  )}
                </div>

                {/* Score changes at this layer */}
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Score Changes at This Layer</h4>
                  {scoreSummary && scoreSummary.length > 0 ? (
                    <div className="text-sm">
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-gray-500">Average Score:</span>
                        <span className="font-medium">{scoreSummary[0]?.avg_score?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-gray-500">From Baseline:</span>
                        <span className={`font-medium ${
                          (scoreSummary[0]?.avg_adjustment || 0) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {(scoreSummary[0]?.avg_adjustment || 0) > 0 ? '+' : ''}
                          {scoreSummary[0]?.avg_adjustment?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No scores computed for this layer.</p>
                  )}
                </div>
              </div>

              {/* Layer Management */}
              <div className="card p-4">
                <LayerManagementPanel 
                  responseId={responseId} 
                  onUpdate={loadResponse}
                />
              </div>
            </div>

            {/* Right: Map at this layer */}
            <div className="card p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <span className="text-gray-500">🗺️</span> 
                Scores at "{layer.name}"
              </h4>
              <LayerScoreMap
                responseId={responseId}
                layerId={layer.id}
                adminScope={response.admin_scope || []}
              />
              
              {/* Score progression below map */}
              <div className="mt-4 pt-4 border-t">
                <LayerScoreProgression
                  responseId={responseId}
                  selectedLayerId={layer.id}
                  onRefresh={() => loadScoreSummary(layer.id)}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Comparison Tab */}
      {activeTab === 'comparison' && (
        <div className="space-y-4">
          {!response.legacy_instance_id ? (
            <div className="card p-4 text-center text-gray-500">
              No legacy instance linked for comparison.
            </div>
          ) : (
            <>
              {/* Comparison Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Correlation</h3>
                  <p className={`text-2xl font-bold ${
                    stats.correlation > 0.8 ? 'text-green-600' : 
                    stats.correlation > 0.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {(stats.correlation * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Avg |Delta|</h3>
                  <p className="text-2xl font-bold">{stats.avgDelta.toFixed(2)}</p>
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Max |Delta|</h3>
                  <p className="text-2xl font-bold">{stats.maxDelta.toFixed(2)}</p>
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Areas Changed</h3>
                  <p className="text-2xl font-bold">{stats.areasWithDelta}</p>
                </div>
              </div>

              {/* Validation Metrics */}
              <ValidationMetricsPanel
                responseId={responseId}
                legacyInstanceId={response.legacy_instance_id}
              />

              {/* Comparison Map */}
              <div className="card p-4">
                <h3 className="font-semibold mb-3">Score Comparison Map</h3>
                <ResponseComparisonMap
                  responseId={responseId}
                  legacyInstanceId={response.legacy_instance_id}
                  adminScope={response.admin_scope || []}
                />
              </div>

              {/* Comparison Table */}
              <div className="card p-4">
                <h3 className="font-semibold mb-3">
                  Score Comparison: {response.name} vs {legacyInstanceName || 'Legacy Instance'}
                </h3>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-3">Admin Code</th>
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3 text-right">Legacy Score</th>
                        <th className="py-2 pr-3 text-right">Response Score</th>
                        <th className="py-2 pr-3 text-right">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonData.slice(0, 100).map((row) => (
                        <tr key={row.admin_pcode} className="border-t">
                          <td className="py-2 pr-3 font-mono text-xs">{row.admin_pcode}</td>
                          <td className="py-2 pr-3">{row.admin_name || '—'}</td>
                          <td className="py-2 pr-3 text-right">
                            {row.legacy_score?.toFixed(2) ?? '—'}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {row.response_score?.toFixed(2) ?? '—'}
                          </td>
                          <td className={`py-2 pr-3 text-right font-medium ${
                            (row.delta || 0) > 0.1 ? 'text-red-600' :
                            (row.delta || 0) < -0.1 ? 'text-green-600' : ''
                          }`}>
                            {row.delta !== null ? (row.delta > 0 ? '+' : '') + row.delta.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {comparisonData.length > 100 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Showing top 100 of {comparisonData.length} areas (sorted by |delta|)
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}

// Helper function to calculate Pearson correlation
function calculateCorrelation(data: ComparisonData[]): number {
  const pairs = data.filter(d => d.legacy_score !== null && d.response_score !== null);
  if (pairs.length < 2) return 0;
  
  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + (p.legacy_score || 0), 0);
  const sumY = pairs.reduce((s, p) => s + (p.response_score || 0), 0);
  const sumXY = pairs.reduce((s, p) => s + (p.legacy_score || 0) * (p.response_score || 0), 0);
  const sumX2 = pairs.reduce((s, p) => s + (p.legacy_score || 0) ** 2, 0);
  const sumY2 = pairs.reduce((s, p) => s + (p.response_score || 0) ** 2, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  
  return denominator === 0 ? 0 : numerator / denominator;
}
