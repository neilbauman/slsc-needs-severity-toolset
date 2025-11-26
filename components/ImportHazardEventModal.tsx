'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type HazardEventRow = {
  id: string;
  name: string;
  event_type?: string | null;
  created_at?: string | null;
  instance_id: string;
  instances?: { name: string } | null;
};

type ImportHazardEventModalProps = {
  instanceId: string;
  onClose: () => void;
  onImported: () => Promise<void> | void;
};

export default function ImportHazardEventModal({ instanceId, onClose, onImported }: ImportHazardEventModalProps) {
  const [events, setEvents] = useState<HazardEventRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HazardEventRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('hazard_events')
          .select('id, name, event_type, created_at, instance_id, instances(name)')
          .neq('instance_id', instanceId)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) {
          console.error('Failed to load hazard events for import:', error);
          setError(error.message);
          setEvents([]);
        } else {
          setEvents(data || []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [instanceId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const term = search.toLowerCase();
    return events.filter((event) => {
      return (
        event.name.toLowerCase().includes(term) ||
        event.instances?.name?.toLowerCase().includes(term) ||
        event.event_type?.toLowerCase().includes(term)
      );
    });
  }, [events, search]);

  const handleImport = async () => {
    if (!selected) return;
    setImporting(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('clone_hazard_event', {
        p_source_event_id: selected.id,
        p_target_instance_id: instanceId,
      });
      if (error) throw error;
      await onImported();
    } catch (err: any) {
      console.error('Failed to import hazard event:', err);
      setError(err?.message || 'Failed to import hazard event');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Hazard Event</h2>
            <p className="text-sm text-gray-500">Reuse a typhoon track or contour set from another instance.</p>
          </div>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, instance, or type…"
            className="flex-1 border rounded px-2 py-1 text-sm"
          />
          <span className="text-xs text-gray-500">
            {filtered.length} of {events.length} events
          </span>
        </div>

        {error && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="border rounded h-72 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Loading hazard events…
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              No hazard events found.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Source Instance</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => (
                  <tr
                    key={event.id}
                    className={`border-t cursor-pointer hover:bg-indigo-50 ${selected?.id === event.id ? 'bg-indigo-100' : ''}`}
                    onClick={() => setSelected(event)}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900">{event.name}</td>
                    <td className="px-3 py-2 text-gray-600">{event.instances?.name || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 capitalize">{event.event_type || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {event.created_at ? new Date(event.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Hazard event metadata and geometry will be copied. Scores must be recomputed in this instance.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!selected || importing}
              className="px-3 py-1 rounded text-sm text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--gsc-blue)' }}
            >
              {importing ? 'Importing…' : 'Import Selected'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

