'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useCountry } from '@/lib/countryContext';
import { createClient } from '@/lib/supabaseClient';
import { Shield, GitBranch, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type LookupRow = { p1: number; p2: number; p3: number; score: number };

export default function DecisionTreeAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isSiteAdmin, loading: countryLoading } = useCountry();
  const router = useRouter();
  const supabase = createClient();

  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !countryLoading && (!user || !isSiteAdmin)) {
      router.push('/');
    }
  }, [user, isSiteAdmin, authLoading, countryLoading, router]);

  const fetchRows = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setError('Not authenticated');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/decision-tree', {
        headers: { 'x-user-id': session.user.id },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load decision tree');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSiteAdmin) fetchRows();
  }, [isSiteAdmin]);

  const updateScore = (index: number, score: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], score };
      return next;
    });
  };

  const handleSave = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setError('Not authenticated');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/decision-tree', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': session.user.id },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setMessage('Decision tree saved.');
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || countryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isSiteAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Shield className="mx-auto text-gray-400 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">Only site administrators can edit the SSC decision tree.</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700">Return to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <GitBranch className="text-teal-600" size={32} />
                SSC Decision Tree
              </h1>
              <p className="text-gray-600 mt-2">
                Lookup table: (P1 shelter, P2 NFI, P3 access) → overall severity 1–5. Used when pillar rollup method is &quot;Decision Tree&quot;.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md"
              >
                <ArrowLeft size={16} />
                Back to Admin
              </Link>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {message && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">{message}</p>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
            Loading decision tree...
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                P1 = 1–5 (shelter), P2 and P3 = 1–4. Edit the <strong>Score</strong> (1–5) for each combination.
              </p>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">P1</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">P2</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">P3</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Score (1–5)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((row, i) => (
                    <tr key={`${row.p1}-${row.p2}-${row.p3}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{row.p1}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.p2}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.p3}</td>
                      <td className="px-4 py-2">
                        <select
                          value={row.score}
                          onChange={(e) => updateScore(i, Number(e.target.value))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {[1, 2, 3, 4, 5].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
              {rows.length} rows. Changes apply when you click &quot;Save changes&quot;.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
