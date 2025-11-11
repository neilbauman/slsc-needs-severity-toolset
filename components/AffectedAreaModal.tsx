// components/AffectedAreaModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import type { Feature, Geometry } from 'geojson';

type AdmRow = {
  admin_pcode: string;
  name: string;
  geom: Geometry;
};

export default function AffectedAreaModal({
  instanceId,
  initialScope,
  onClose,
  onSaved,
}: {
  instanceId: string;
  initialScope?: string[] | null;
  onClose: () => void;
  onSaved: (updatedScope: string[]) => Promise<void>;
}) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<AdmRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialScope ?? [])
  );
  const [q, setQ] = useState('');

  // Load ADM1 features via RPC (falls back to SELECT if RPC blocked)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // Try RPC first
      const rpc = await supabase
        .rpc('get_admin_boundaries_geojson', { in_level: 'ADM1' })
        .select();

      let data: any[] | null = null;
      let error = rpc.error;

      if (!error) {
        data = rpc.data as any[];
      } else {
        // Fallback: direct SELECT with ST_AsGeoJSON (requires SELECT + RLS policy)
        const fb = await supabase
          .from('admin_boundaries')
          .select('admin_pcode,name,geom')
          .eq('admin_level', 'ADM1')
          .order('name', { ascending: true });

        error = fb.error;
        data = fb.data as any[] | null;
      }

      if (cancelled) return;

      if (error) {
        console.error('Failed to load ADM1:', error.message || error);
        setRows([]);
      } else {
        // Normalize into AdmRow list
        const normalized: AdmRow[] = (data ?? []).map((r: any) => ({
          admin_pcode: r.admin_pcode,
          name: r.name,
          geom:
            (r.geom && (r.geom as Geometry)) ||
            (r.geometry as Geometry) ||
            (typeof r.geom_json === 'string'
              ? (JSON.parse(r.geom_json) as Geometry)
              : r.geom_json),
        }));
        setRows(normalized);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(qq) ||
        r.admin_pcode.toLowerCase().includes(qq)
    );
  }, [q, rows]);

  const allSelected = selected.size === rows.length && rows.length > 0;

  function toggle(p: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function selectAll() {
    if (rows.length === 0) return;
    setSelected(new Set(rows.map((r) => r.admin_pcode)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function handleSave() {
    setSaving(true);
    const scope = Array.from(selected);

    const { error } = await supabase
      .from('instances')
      .update({ admin_scope: scope })
      .eq('id', instanceId);

    setSaving(false);

    if (error) {
      alert('Failed to save affected area: ' + error.message);
      return;
    }
    await onSaved(scope);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl w-[1100px] max-w-[95vw] max-h-[88vh] flex flex-col border">
        <div className="px-4 py-3 border-b bg-[var(--gsc-beige,#f5f2ee)] text-[var(--gsc-gray,#374151)] flex items-center justify-between">
          <div className="font-semibold text-sm">
            Configure Affected Area (ADM1)
          </div>
          <button
            className="px-3 py-1 rounded border text-sm hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
          {/* Left: list */}
          <div className="border-r flex flex-col">
            <div className="p-3 flex items-center gap-2 border-b">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or pcode..."
                className="w-full px-3 py-2 rounded border text-sm"
              />
              <button
                className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                onClick={selectAll}
                disabled={rows.length === 0}
              >
                Select all
              </button>
              <button
                className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                onClick={clearAll}
                disabled={selected.size === 0}
              >
                Clear all
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="p-6 text-sm text-gray-500">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">
                  No ADM1 features found.
                  <div className="mt-2">
                    Check SQL permissions for{' '}
                    <code>get_admin_boundaries_geojson</code> and RLS.
                  </div>
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((r) => {
                    const checked = selected.has(r.admin_pcode);
                    return (
                      <li
                        key={r.admin_pcode}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                      >
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(r.admin_pcode)}
                          />
                          <span className="text-sm font-medium">
                            {r.name}
                          </span>
                        </label>
                        <span className="text-xs text-gray-500">
                          {r.admin_pcode}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-3 py-2 border-t text-xs text-gray-600">
              Selected: {selected.size} of {rows.length}{' '}
              {allSelected ? '(All)' : ''}
            </div>
          </div>

          {/* Right: simple summary */}
          <div className="flex flex-col">
            <div className="p-3 border-b text-sm font-medium">Selection</div>
            <div className="flex-1 overflow-auto p-3">
              {selected.size === 0 ? (
                <div className="text-sm text-gray-500">No results.</div>
              ) : (
                <ul className="text-sm space-y-1">
                  {Array.from(selected)
                    .sort()
                    .map((p) => {
                      const row = rows.find((r) => r.admin_pcode === p);
                      return (
                        <li key={p} className="flex justify-between gap-3">
                          <span className="truncate">{row?.name ?? p}</span>
                          <span className="text-gray-500">{p}</span>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 rounded text-white text-sm"
            style={{
              background: 'var(--gsc-blue, #004b87)',
            }}
          >
            {saving ? 'Saving…' : 'Save Affected Area'}
          </button>
        </div>
      </div>
    </div>
  );
}
