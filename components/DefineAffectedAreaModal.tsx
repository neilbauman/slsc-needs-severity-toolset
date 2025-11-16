'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
  open: boolean;
}

interface AdminBoundary {
  admin_pcode: string;
  name: string;
  admin_level: string;
  parent_pcode?: string;
}

export default function DefineAffectedAreaModal({
  instance,
  onClose,
  onSaved,
  open,
}: Props) {
  const [adm1List, setAdm1List] = useState<AdminBoundary[]>([]);
  const [adm2List, setAdm2List] = useState<AdminBoundary[]>([]);
  const [selectedAdm1, setSelectedAdm1] = useState<string[]>([]);
  const [excludedAdm2, setExcludedAdm2] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load ADM1 + ADM2 levels from admin_boundaries
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);

      const { data: adm1, error: e1 } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, admin_level')
        .eq('admin_level', '1')
        .order('name');
      if (e1) console.error('ADM1 load error:', e1);
      else setAdm1List(adm1 || []);

      const { data: adm2, error: e2 } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, admin_level, parent_pcode')
        .eq('admin_level', '2')
        .order('name');
      if (e2) console.error('ADM2 load error:', e2);
      else setAdm2List(adm2 || []);

      setSelectedAdm1(instance?.admin_scope ?? []);
      setLoading(false);
    };
    load();
  }, [instance, open]);

  const toggleAdm1 = (pcode: string) => {
    setSelectedAdm1((prev) =>
      prev.includes(pcode) ? prev.filter((c) => c !== pcode) : [...prev, pcode]
    );
  };

  const toggleAdm2 = (pcode: string) => {
    setExcludedAdm2((prev) =>
      prev.includes(pcode) ? prev.filter((c) => c !== pcode) : [...prev, pcode]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('instances')
      .update({
        admin_scope: selectedAdm1,
      })
      .eq('id', instance.id);

    setLoading(false);
    if (error) {
      alert('Failed to save affected area: ' + error.message);
      return;
    }
    await onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
        <h2 className="text-lg font-semibold mb-4">Define Affected Area</h2>

        {loading ? (
          <div className="text-sm text-gray-500">Loading administrative areas…</div>
        ) : (
          <div className="space-y-6 overflow-y-auto max-h-[70vh]">
            <div>
              <h3 className="text-sm font-semibold mb-2">Step 1: Select ADM1 Regions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                {adm1List.map((a1) => (
                  <label key={a1.admin_pcode} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedAdm1.includes(a1.admin_pcode)}
                      onChange={() => toggleAdm1(a1.admin_pcode)}
                    />
                    {a1.name}
                  </label>
                ))}
              </div>
            </div>

            {selectedAdm1.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Step 2: Refine ADM2 (Optional)
                </h3>
                {selectedAdm1.map((adm1Code) => {
                  const a1 = adm1List.find((a) => a.admin_pcode === adm1Code);
                  const a2s = adm2List.filter(
                    (a) => a.parent_pcode === adm1Code
                  );
                  return (
                    <div key={adm1Code} className="mb-4">
                      <div className="font-medium text-gray-700 mb-1">
                        {a1?.name}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                        {a2s.map((a2) => (
                          <label
                            key={a2.admin_pcode}
                            className="flex items-center gap-2 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={!excludedAdm2.includes(a2.admin_pcode)}
                              onChange={() => toggleAdm2(a2.admin_pcode)}
                            />
                            {a2.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${
              loading
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Saving…' : 'Save Affected Area'}
          </button>
        </div>
      </div>
    </div>
  );
}
