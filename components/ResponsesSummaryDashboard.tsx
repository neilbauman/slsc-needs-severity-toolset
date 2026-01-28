'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import Link from 'next/link';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Layers, 
  MapPin,
  TrendingUp,
  BarChart3
} from 'lucide-react';

type ResponseSummary = {
  id: string;
  name: string;
  status: string | null;
  created_at: string | null;
  admin_scope: string[] | null;
  layer_count: number;
  has_scores: boolean;
  avg_score: number | null;
};

type DashboardStats = {
  total_responses: number;
  active_responses: number;
  draft_responses: number;
  total_areas_covered: number;
  avg_vulnerability: number | null;
  responses_needing_attention: ResponseSummary[];
};

export default function ResponsesSummaryDashboard() {
  const supabase = createClient();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentResponses, setRecentResponses] = useState<ResponseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Fetch responses with layer counts
      const { data: responses } = await supabase
        .from('responses')
        .select('id, name, status, created_at, admin_scope')
        .order('created_at', { ascending: false });

      if (!responses) return;

      // Fetch layer counts for each response
      const responseIds = responses.map(r => r.id);
      const { data: layerCounts } = await supabase
        .from('response_layers')
        .select('response_id')
        .in('response_id', responseIds);

      const layerCountMap = new Map<string, number>();
      (layerCounts || []).forEach(l => {
        layerCountMap.set(l.response_id, (layerCountMap.get(l.response_id) || 0) + 1);
      });

      // Fetch score stats for responses
      const { data: scoreStats } = await supabase
        .from('response_scores')
        .select('response_id, score')
        .in('response_id', responseIds)
        .eq('category', 'Overall')
        .is('layer_id', null);

      const scoreMap = new Map<string, { hasScores: boolean; avgScore: number | null }>();
      responseIds.forEach(id => scoreMap.set(id, { hasScores: false, avgScore: null }));
      
      const scoresByResponse = new Map<string, number[]>();
      (scoreStats || []).forEach(s => {
        if (!scoresByResponse.has(s.response_id)) {
          scoresByResponse.set(s.response_id, []);
        }
        scoresByResponse.get(s.response_id)!.push(s.score);
      });

      scoresByResponse.forEach((scores, responseId) => {
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        scoreMap.set(responseId, { hasScores: scores.length > 0, avgScore: avg });
      });

      // Build response summaries
      const summaries: ResponseSummary[] = responses.map(r => ({
        ...r,
        layer_count: layerCountMap.get(r.id) || 0,
        has_scores: scoreMap.get(r.id)?.hasScores || false,
        avg_score: scoreMap.get(r.id)?.avgScore || null
      }));

      // Calculate dashboard stats
      const activeResponses = summaries.filter(r => r.status === 'active');
      const draftResponses = summaries.filter(r => r.status === 'draft' || !r.status);
      
      const allAreas = new Set<string>();
      summaries.forEach(r => (r.admin_scope || []).forEach(a => allAreas.add(a)));

      const allScores = summaries.filter(r => r.avg_score !== null).map(r => r.avg_score!);
      const overallAvg = allScores.length > 0 
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
        : null;

      // Responses needing attention: no scores or draft status
      const needingAttention = summaries.filter(r => 
        !r.has_scores || r.status === 'draft' || !r.status
      ).slice(0, 5);

      setStats({
        total_responses: summaries.length,
        active_responses: activeResponses.length,
        draft_responses: draftResponses.length,
        total_areas_covered: allAreas.size,
        avg_vulnerability: overallAvg,
        responses_needing_attention: needingAttention
      });

      setRecentResponses(summaries.slice(0, 5));
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total_responses}</p>
              <p className="text-xs text-gray-500">Total Responses</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active_responses}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.draft_responses}</p>
              <p className="text-xs text-gray-500">Draft</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total_areas_covered}</p>
              <p className="text-xs text-gray-500">Areas Covered</p>
            </div>
          </div>
        </div>
      </div>

      {/* Average Vulnerability Score */}
      {stats.avg_vulnerability !== null && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingUp size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Average Vulnerability Score</p>
                <p className="text-3xl font-bold">{stats.avg_vulnerability.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(level => (
                  <div
                    key={level}
                    className={`w-8 h-3 rounded ${
                      level <= Math.round(stats.avg_vulnerability || 0)
                        ? level <= 2 ? 'bg-green-500' :
                          level <= 3 ? 'bg-yellow-500' :
                          level <= 4 ? 'bg-orange-500' : 'bg-red-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Scale: 1 (Low) - 5 (High)</p>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Responses */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 size={18} />
            Recent Responses
          </h3>
          {recentResponses.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No responses yet</p>
          ) : (
            <div className="space-y-2">
              {recentResponses.map(r => (
                <Link
                  key={r.id}
                  href={`/responses/${r.id}`}
                  className="block p-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-gray-500">
                        {r.admin_scope?.length || 0} areas • {r.layer_count} layers
                      </p>
                    </div>
                    <div className="text-right">
                      {r.avg_score !== null ? (
                        <span className={`text-sm font-bold ${
                          r.avg_score <= 2 ? 'text-green-600' :
                          r.avg_score <= 3 ? 'text-yellow-600' :
                          r.avg_score <= 4 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {r.avg_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No scores</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Needing Attention */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-600" />
            Needs Attention
          </h3>
          {stats.responses_needing_attention.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              All responses are up to date
            </p>
          ) : (
            <div className="space-y-2">
              {stats.responses_needing_attention.map(r => (
                <Link
                  key={r.id}
                  href={`/responses/${r.id}`}
                  className="block p-2 hover:bg-yellow-50 rounded-lg border border-yellow-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{r.name}</p>
                    <div className="flex gap-1">
                      {!r.has_scores && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          No scores
                        </span>
                      )}
                      {(r.status === 'draft' || !r.status) && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
