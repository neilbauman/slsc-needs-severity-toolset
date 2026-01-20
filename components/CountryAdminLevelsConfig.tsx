'use client';

import { useEffect, useState } from 'react';
import { useCountry } from '@/lib/countryContext';
import { createClient } from '@/lib/supabaseClient';
import { Plus, Trash2, Save, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface AdminLevel {
  id?: string;
  level_number: number;
  name: string;
  plural_name: string;
  code_prefix: string;
}

export default function CountryAdminLevelsConfig() {
  const { currentCountry, isSiteAdmin } = useCountry();
  const supabase = createClient();
  
  const [levels, setLevels] = useState<AdminLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize with default 4 levels
  const initializeLevels = () => {
    return [
      { level_number: 1, name: '', plural_name: '', code_prefix: '' },
      { level_number: 2, name: '', plural_name: '', code_prefix: '' },
      { level_number: 3, name: '', plural_name: '', code_prefix: '' },
      { level_number: 4, name: '', plural_name: '', code_prefix: '' },
    ];
  };

  const loadLevels = async () => {
    if (!currentCountry) {
      setLevels(initializeLevels());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('country_admin_levels')
        .select('*')
        .eq('country_id', currentCountry.id)
        .order('level_number', { ascending: true });

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        setLevels(
          data.map((l) => ({
            id: l.id,
            level_number: l.level_number,
            name: l.name,
            plural_name: l.plural_name || l.name + 's',
            code_prefix: l.code_prefix || '',
          }))
        );
      } else {
        // No levels configured, show empty form
        setLevels(initializeLevels());
      }
    } catch (err: any) {
      console.error('Error loading admin levels:', err);
      setError(err.message || 'Failed to load admin levels');
      setLevels(initializeLevels());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLevels();
  }, [currentCountry]);

  const handleLevelChange = (index: number, field: keyof AdminLevel, value: string) => {
    const updated = [...levels];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-generate plural if name changes and plural is empty
    if (field === 'name' && !updated[index].plural_name) {
      updated[index].plural_name = value ? value + 's' : '';
    }
    
    setLevels(updated);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!currentCountry) {
      setError('No country selected');
      return;
    }

    // Validate
    const errors: string[] = [];
    levels.forEach((level, index) => {
      if (!level.name.trim()) {
        errors.push(`Level ${level.level_number} name is required`);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Delete existing levels for this country
      const { error: deleteError } = await supabase
        .from('country_admin_levels')
        .delete()
        .eq('country_id', currentCountry.id);

      if (deleteError) throw deleteError;

      // Insert new levels
      const levelsToInsert = levels
        .filter((l) => l.name.trim())
        .map((l) => ({
          country_id: currentCountry.id,
          level_number: l.level_number,
          name: l.name.trim(),
          plural_name: l.plural_name.trim() || l.name.trim() + 's',
          code_prefix: l.code_prefix.trim() || null,
          order_index: l.level_number,
        }));

      if (levelsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('country_admin_levels')
          .insert(levelsToInsert);

        if (insertError) throw insertError;
      }

      setSuccess(true);
      await loadLevels(); // Reload to get IDs
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving admin levels:', err);
      setError(err.message || 'Failed to save admin levels');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-600">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
        <p>Loading admin level configuration...</p>
      </div>
    );
  }

  if (!currentCountry) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Please select a country to configure admin levels.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Configure Admin Level Names for {currentCountry.name}
        </h2>
        <p className="text-sm text-gray-600">
          Define custom names for your administrative levels (e.g., "Province", "District", "Municipality").
          These names will replace the generic ADM1, ADM2, ADM3, ADM4 throughout the application.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-red-600 mt-0.5" size={18} />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">✓ Admin level names saved successfully!</p>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {levels.map((level, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-4 bg-gray-50"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="w-24 text-sm font-medium text-gray-700">
                Level {level.level_number}
              </div>
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Name (Singular) *
                  </label>
                  <input
                    type="text"
                    value={level.name}
                    onChange={(e) => handleLevelChange(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Province"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Plural Name
                  </label>
                  <input
                    type="text"
                    value={level.plural_name}
                    onChange={(e) => handleLevelChange(index, 'plural_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Provinces"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Code Prefix (Optional)
                  </label>
                  <input
                    type="text"
                    value={level.code_prefix}
                    onChange={(e) => handleLevelChange(index, 'code_prefix', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., PROV"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          * Required fields. Leave levels empty if your country doesn't use all 4 levels.
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={16} />
              Save Configuration
            </>
          )}
        </button>
      </div>
    </div>
  );
}
