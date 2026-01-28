'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { MapPin, Search, Check, X, Save, RefreshCw } from 'lucide-react';

interface Props {
  responseId: string;
  currentScope: string[];
  onUpdate: (newScope: string[]) => void;
}

type AdminBoundary = {
  admin_pcode: string;
  name: string;
  admin_level: string;
  parent_pcode: string | null;
};

type RegionGroup = {
  pcode: string;
  name: string;
  children: AdminBoundary[];
};

export default function AffectedAreaEditor({ responseId, currentScope, onUpdate }: Props) {
  const supabase = createClient();
  
  const [boundaries, setBoundaries] = useState<AdminBoundary[]>([]);
  const [regions, setRegions] = useState<RegionGroup[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>(currentScope);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadBoundaries();
  }, []);

  useEffect(() => {
    setSelectedAreas(currentScope);
  }, [currentScope]);

  const loadBoundaries = async () => {
    setLoading(true);
    try {
      // Load ADM1 regions
      const { data: adm1Data } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, admin_level, parent_pcode')
        .eq('admin_level', 'ADM1')
        .order('name');

      // Load ADM2 areas
      const { data: adm2Data } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, admin_level, parent_pcode')
        .eq('admin_level', 'ADM2')
        .order('name');

      setBoundaries(adm2Data || []);

      // Group ADM2 by parent ADM1
      const regionGroups: RegionGroup[] = (adm1Data || []).map(region => ({
        pcode: region.admin_pcode,
        name: region.name,
        children: (adm2Data || []).filter(b => b.parent_pcode === region.admin_pcode)
      })).filter(r => r.children.length > 0);

      setRegions(regionGroups);
    } catch (err) {
      console.error('Error loading boundaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('responses')
        .update({ admin_scope: selectedAreas })
        .eq('id', responseId);

      if (error) throw error;

      onUpdate(selectedAreas);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Error saving affected areas:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedAreas(currentScope);
    setIsEditing(false);
  };

  const toggleArea = (pcode: string) => {
    setSelectedAreas(prev => 
      prev.includes(pcode)
        ? prev.filter(p => p !== pcode)
        : [...prev, pcode]
    );
  };

  const toggleRegion = (region: RegionGroup) => {
    const regionPcodes = region.children.map(c => c.admin_pcode);
    const allSelected = regionPcodes.every(p => selectedAreas.includes(p));
    
    if (allSelected) {
      // Deselect all in region
      setSelectedAreas(prev => prev.filter(p => !regionPcodes.includes(p)));
    } else {
      // Select all in region
      setSelectedAreas(prev => {
        const newSet = new Set([...prev, ...regionPcodes]);
        return Array.from(newSet);
      });
    }
  };

  const selectAll = () => {
    setSelectedAreas(boundaries.map(b => b.admin_pcode));
  };

  const clearAll = () => {
    setSelectedAreas([]);
  };

  const filteredRegions = searchTerm
    ? regions.map(r => ({
        ...r,
        children: r.children.filter(c => 
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.admin_pcode.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(r => r.children.length > 0 || r.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : regions;

  if (loading) {
    return <div className="text-sm text-gray-500">Loading areas...</div>;
  }

  // Display mode (not editing)
  if (!isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin size={18} />
            Affected Areas
          </h3>
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-secondary text-sm"
          >
            Edit Areas
          </button>
        </div>
        
        <div className="text-sm">
          <span className="font-medium">{currentScope.length}</span> ADM2 areas selected
        </div>

        {currentScope.length > 0 && (
          <div className="flex flex-wrap gap-1 max-h-[150px] overflow-y-auto">
            {currentScope.map(pcode => {
              const area = boundaries.find(b => b.admin_pcode === pcode);
              return (
                <span 
                  key={pcode}
                  className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                >
                  {area?.name || pcode}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin size={18} />
          Edit Affected Areas
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="btn btn-secondary text-sm flex items-center gap-1"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary text-sm flex items-center gap-1"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Search and quick actions */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search areas..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <button
          onClick={selectAll}
          className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Select All
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Clear
        </button>
      </div>

      <div className="text-sm text-gray-600">
        {selectedAreas.length} of {boundaries.length} areas selected
      </div>

      {/* Region list with checkboxes */}
      <div className="border rounded-lg max-h-[400px] overflow-y-auto divide-y">
        {filteredRegions.map(region => {
          const regionPcodes = region.children.map(c => c.admin_pcode);
          const selectedInRegion = regionPcodes.filter(p => selectedAreas.includes(p)).length;
          const allSelected = selectedInRegion === regionPcodes.length;
          const someSelected = selectedInRegion > 0 && selectedInRegion < regionPcodes.length;

          return (
            <div key={region.pcode} className="bg-white">
              {/* Region header */}
              <div
                onClick={() => toggleRegion(region)}
                className="flex items-center gap-3 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 sticky top-0"
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={() => toggleRegion(region)}
                  className="rounded"
                />
                <span className="font-medium text-sm flex-1">{region.name}</span>
                <span className="text-xs text-gray-500">
                  {selectedInRegion}/{regionPcodes.length}
                </span>
              </div>

              {/* ADM2 areas in region */}
              <div className="divide-y divide-gray-100">
                {region.children.map(area => (
                  <label
                    key={area.admin_pcode}
                    className="flex items-center gap-3 px-3 py-1.5 pl-8 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAreas.includes(area.admin_pcode)}
                      onChange={() => toggleArea(area.admin_pcode)}
                      className="rounded"
                    />
                    <span className="text-sm flex-1">{area.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{area.admin_pcode}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
