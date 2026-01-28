'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';

interface Props {
  responseId: string;
  responseName: string;
}

type ExportFormat = 'csv' | 'json';

export default function ExportResponseButton({ responseId, responseName }: Props) {
  const supabase = createClient();
  
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const exportData = async (format: ExportFormat) => {
    setExporting(true);
    setShowMenu(false);
    
    try {
      // Fetch all response data
      const [
        { data: response },
        { data: scores },
        { data: layers }
      ] = await Promise.all([
        supabase
          .from('responses')
          .select('*')
          .eq('id', responseId)
          .single(),
        supabase
          .from('response_scores')
          .select('admin_pcode, category, baseline_score, layer_adjustment, score, normalized_score')
          .eq('response_id', responseId)
          .is('layer_id', null)
          .order('category')
          .order('admin_pcode'),
        supabase
          .from('response_layers')
          .select('name, layer_type, effect_direction, weight, reference_date, order_index')
          .eq('response_id', responseId)
          .order('order_index')
      ]);

      // Fetch admin names for scores
      const pcodes = [...new Set((scores || []).map(s => s.admin_pcode))];
      const { data: adminNames } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name')
        .in('admin_pcode', pcodes);

      const nameMap = new Map((adminNames || []).map(a => [a.admin_pcode, a.name]));

      // Enrich scores with names
      const enrichedScores = (scores || []).map(s => ({
        ...s,
        admin_name: nameMap.get(s.admin_pcode) || s.admin_pcode
      }));

      if (format === 'json') {
        exportAsJson({
          response,
          layers: layers || [],
          scores: enrichedScores
        });
      } else {
        exportAsCsv(enrichedScores);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const exportAsJson = (data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${sanitizeFilename(responseName)}_export.json`);
  };

  const exportAsCsv = (scores: any[]) => {
    const headers = ['Admin Code', 'Admin Name', 'Category', 'Baseline Score', 'Layer Adjustment', 'Final Score', 'Normalized Score'];
    const rows = scores.map(s => [
      s.admin_pcode,
      `"${(s.admin_name || '').replace(/"/g, '""')}"`,
      s.category,
      s.baseline_score?.toFixed(3) || '',
      s.layer_adjustment?.toFixed(3) || '',
      s.score?.toFixed(3) || '',
      s.normalized_score?.toFixed(3) || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `${sanitizeFilename(responseName)}_scores.csv`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="btn btn-secondary flex items-center gap-1"
      >
        {exporting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        Export
      </button>

      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
            <button
              onClick={() => exportData('csv')}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FileSpreadsheet size={16} className="text-green-600" />
              Export as CSV
            </button>
            <button
              onClick={() => exportData('json')}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FileJson size={16} className="text-blue-600" />
              Export as JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
