'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Download, Search, X } from 'lucide-react';
import supabase from '@/lib/supabaseClient';

type Dataset = {
  id: string;
  name: string;
  type?: string | null;
};

type UnmatchedRow = {
  raw_pcode?: string | null;
  raw_name?: string | null;
  value_raw?: any;
  row_id?: string;
};

type Props = {
  dataset: Dataset;
  onClose: () => void;
  onManualMap?: (rowId: string, mappedPcode: string) => void;
};

export default function UnmatchedRowsViewer({ dataset, onClose, onManualMap }: Props) {
  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState<UnmatchedRow | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [mappingPcode, setMappingPcode] = useState('');

  useEffect(() => {
    loadUnmatchedRows();
  }, [dataset]);

  const loadUnmatchedRows = async () => {
    setLoading(true);
    try {
      // Get alignment preview and filter for unmatched rows
      const { data, error } = await supabase.rpc('preview_pcode_alignment', {
        dataset_id: dataset.id,
        matching_config: {},
      });

      if (error) throw error;

      // Filter for rows with no match
      const unmatched = (data || []).filter((row: any) => row.match_strategy === 'no_match');
      setUnmatchedRows(unmatched);
    } catch (err: any) {
      console.error('Failed to load unmatched rows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSuggestions = async (term: string) => {
    if (!term || term.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, admin_level')
        .or(`admin_pcode.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(10);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      console.error('Failed to search suggestions:', err);
      setSuggestions([]);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Raw PCode', 'Raw Name', 'Value'].join(','),
      ...unmatchedRows.map((row) =>
        [
          row.raw_pcode || '',
          row.raw_name || '',
          row.value_raw || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset.name}_unmatched_rows.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualMap = () => {
    if (selectedRow && mappingPcode && onManualMap && selectedRow.row_id) {
      onManualMap(selectedRow.row_id, mappingPcode);
      setSelectedRow(null);
      setMappingPcode('');
      loadUnmatchedRows();
    }
  };

  const filteredRows = unmatchedRows.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (row.raw_pcode?.toLowerCase().includes(term) || false) ||
      (row.raw_name?.toLowerCase().includes(term) || false)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Unmatched Rows</h2>
            <p className="text-sm text-gray-500">{dataset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="border-b border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by PCode or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <span className="text-sm text-gray-600">
              {filteredRows.length} of {unmatchedRows.length} unmatched rows
            </span>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500">Loading unmatched rows...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle size={48} className="text-gray-300 mb-4" />
              <p className="text-sm font-medium text-gray-900 mb-1">No unmatched rows found</p>
              <p className="text-sm text-gray-500">
                {searchTerm ? 'Try a different search term' : 'All rows have been successfully matched'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.slice(0, 100).map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {row.raw_pcode || <span className="text-gray-400">No PCode</span>}
                        </p>
                        <p className="text-xs text-gray-500">{row.raw_name || 'No name'}</p>
                      </div>
                      {row.value_raw && (
                        <div className="text-xs text-gray-600">
                          Value: {typeof row.value_raw === 'number' ? row.value_raw.toLocaleString() : row.value_raw}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRow(row);
                      handleSearchSuggestions(row.raw_pcode || row.raw_name || '');
                    }}
                    className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                  >
                    Map Manually
                  </button>
                </div>
              ))}
              {filteredRows.length > 100 && (
                <p className="text-xs text-center text-gray-500 py-2">
                  Showing first 100 rows. Use search to find specific rows.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Manual Mapping Modal */}
        {selectedRow && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Manual Mapping</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Raw Data</p>
                  <p className="text-sm text-gray-600">PCode: {selectedRow.raw_pcode || '—'}</p>
                  <p className="text-sm text-gray-600">Name: {selectedRow.raw_name || '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Map to PCode
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={mappingPcode}
                      onChange={(e) => {
                        setMappingPcode(e.target.value);
                        handleSearchSuggestions(e.target.value);
                      }}
                      placeholder="Enter or search for PCode..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setMappingPcode(suggestion.admin_pcode);
                              setSuggestions([]);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <p className="font-medium text-gray-900">{suggestion.admin_pcode}</p>
                            <p className="text-xs text-gray-500">{suggestion.name}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setSelectedRow(null);
                      setMappingPcode('');
                      setSuggestions([]);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualMap}
                    disabled={!mappingPcode}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply Mapping
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

