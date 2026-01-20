'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useCountry } from '@/lib/countryContext';
import { createClient } from '@/lib/supabaseClient';
import { Plus, Trash2, Edit2, X, Check, AlertTriangle, Globe, Shield, Users, Settings } from 'lucide-react';
import Link from 'next/link';

interface Country {
  id: string;
  iso_code: string;
  name: string;
  active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isSiteAdmin, loading: countryLoading } = useCountry();
  const router = useRouter();
  const supabase = createClient();
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [deletingCountry, setDeletingCountry] = useState<Country | null>(null);
  const [checkingDeletion, setCheckingDeletion] = useState(false);
  const [deletionCheck, setDeletionCheck] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    iso_code: '',
    name: '',
    active: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirect if not site admin
  useEffect(() => {
    if (!authLoading && !countryLoading && (!user || !isSiteAdmin)) {
      router.push('/');
    }
  }, [user, isSiteAdmin, authLoading, countryLoading, router]);

  // Load countries
  const loadCountries = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('countries')
        .select('*')
        .order('name');
      
      if (fetchError) throw fetchError;
      setCountries(data || []);
    } catch (err: any) {
      console.error('Error loading countries:', err);
      setError(err.message || 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSiteAdmin) {
      loadCountries();
    }
  }, [isSiteAdmin]);

  // Check if country can be deleted (has no related data)
  const checkCountryDeletion = async (country: Country) => {
    setCheckingDeletion(true);
    setDeletionCheck(null);
    
    try {
      const checks = {
        datasets: 0,
        instances: 0,
        admin_boundaries: 0,
        user_countries: 0,
      };

      // Check datasets
      const { count: datasetCount } = await supabase
        .from('datasets')
        .select('*', { count: 'exact', head: true })
        .eq('country_id', country.id);
      checks.datasets = datasetCount || 0;

      // Check instances
      const { count: instanceCount } = await supabase
        .from('instances')
        .select('*', { count: 'exact', head: true })
        .eq('country_id', country.id);
      checks.instances = instanceCount || 0;

      // Check admin_boundaries
      const { count: boundaryCount } = await supabase
        .from('admin_boundaries')
        .select('*', { count: 'exact', head: true })
        .eq('country_id', country.id);
      checks.admin_boundaries = boundaryCount || 0;

      // Check user_countries
      const { count: userCountryCount } = await supabase
        .from('user_countries')
        .select('*', { count: 'exact', head: true })
        .eq('country_id', country.id);
      checks.user_countries = userCountryCount || 0;

      const totalRelated = Object.values(checks).reduce((sum, val) => sum + val, 0);
      
      setDeletionCheck({
        ...checks,
        canDelete: totalRelated === 0,
        totalRelated,
      });
    } catch (err: any) {
      console.error('Error checking deletion:', err);
      setDeletionCheck({
        error: err.message || 'Failed to check related data',
        canDelete: false,
      });
    } finally {
      setCheckingDeletion(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      // Validate ISO code (3 uppercase letters)
      if (!/^[A-Z]{3}$/.test(formData.iso_code)) {
        throw new Error('ISO code must be exactly 3 uppercase letters (e.g., PHL, BGD, MMR)');
      }

      // Validate name
      if (!formData.name.trim()) {
        throw new Error('Country name is required');
      }

      if (editingCountry) {
        // Update existing country
        const { error: updateError } = await supabase
          .from('countries')
          .update({
            iso_code: formData.iso_code.toUpperCase(),
            name: formData.name.trim(),
            active: formData.active,
          })
          .eq('id', editingCountry.id);

        if (updateError) throw updateError;
      } else {
        // Create new country
        const { error: insertError } = await supabase
          .from('countries')
          .insert({
            iso_code: formData.iso_code.toUpperCase(),
            name: formData.name.trim(),
            active: formData.active,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(`A country with ISO code "${formData.iso_code.toUpperCase()}" already exists`);
          }
          throw insertError;
        }
      }

      // Reset form and reload
      setFormData({ iso_code: '', name: '', active: true });
      setShowAddForm(false);
      setEditingCountry(null);
      await loadCountries();
    } catch (err: any) {
      console.error('Error saving country:', err);
      setFormError(err.message || 'Failed to save country');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingCountry || !deletionCheck?.canDelete) return;

    try {
      setSaving(true);
      const { error: deleteError } = await supabase
        .from('countries')
        .delete()
        .eq('id', deletingCountry.id);

      if (deleteError) throw deleteError;

      setDeletingCountry(null);
      setDeletionCheck(null);
      await loadCountries();
    } catch (err: any) {
      console.error('Error deleting country:', err);
      setFormError(err.message || 'Failed to delete country');
    } finally {
      setSaving(false);
    }
  };

  // Start editing
  const startEdit = (country: Country) => {
    setEditingCountry(country);
    setFormData({
      iso_code: country.iso_code,
      name: country.name,
      active: country.active,
    });
    setShowAddForm(true);
    setFormError(null);
  };

  // Cancel form
  const cancelForm = () => {
    setShowAddForm(false);
    setEditingCountry(null);
    setFormData({ iso_code: '', name: '', active: true });
    setFormError(null);
  };

  // Show loading or unauthorized
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
          <p className="text-gray-600 mb-4">You must be a site administrator to access this page.</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Globe className="text-blue-600" size={32} />
                Country Management
              </h1>
              <p className="text-gray-600 mt-2">Add, edit, or remove countries from the system</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/admin/admin-levels"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                Configure Admin Levels
              </Link>
              <Link
                href="/admin/users"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Users size={16} />
                Manage Users
              </Link>
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingCountry ? 'Edit Country' : 'Add New Country'}
            </h2>
            
            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ISO Code (3 letters) *
                </label>
                <input
                  type="text"
                  value={formData.iso_code}
                  onChange={(e) => setFormData({ ...formData, iso_code: e.target.value.toUpperCase().slice(0, 3) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., PHL, BGD, MMR"
                  maxLength={3}
                  required
                  disabled={saving || !!editingCountry} // Can't change ISO code when editing
                />
                {editingCountry && (
                  <p className="mt-1 text-xs text-gray-500">ISO code cannot be changed after creation</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Philippines, Bangladesh, Myanmar"
                  required
                  disabled={saving}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={saving}
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-700">
                  Active (visible to users)
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
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
                      <Check size={16} />
                      {editingCountry ? 'Update Country' : 'Add Country'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Countries List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Countries ({countries.length})
            </h2>
            {!showAddForm && (
              <button
                onClick={() => {
                  setShowAddForm(true);
                  setEditingCountry(null);
                  setFormData({ iso_code: '', name: '', active: true });
                  setFormError(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={16} />
                Add Country
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading countries...</div>
          ) : countries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Globe className="mx-auto text-gray-400 mb-4" size={48} />
              <p>No countries found. Add your first country to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {countries.map((country) => (
                <div
                  key={country.id}
                  className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {country.iso_code}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {country.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          ISO: {country.iso_code} • 
                          {country.active ? (
                            <span className="text-green-600 ml-1">Active</span>
                          ) : (
                            <span className="text-gray-400 ml-1">Inactive</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/admin-levels?countryId=${country.id}`}
                      className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md transition"
                      title="Configure admin levels"
                    >
                      <Settings size={18} />
                    </Link>
                    <button
                      onClick={() => startEdit(country)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                      title="Edit country"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setDeletingCountry(country);
                        checkCountryDeletion(country);
                      }}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Delete country"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deletingCountry && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-red-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Country
                </h3>
              </div>

              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <strong>{deletingCountry.name}</strong> ({deletingCountry.iso_code})?
                This action cannot be undone.
              </p>

              {checkingDeletion ? (
                <div className="mb-4 text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600 mt-2">Checking for related data...</p>
                </div>
              ) : deletionCheck ? (
                <div className="mb-4">
                  {deletionCheck.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                      <p className="text-sm text-red-800">{deletionCheck.error}</p>
                    </div>
                  ) : deletionCheck.canDelete ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                      <p className="text-sm text-green-800">
                        ✓ No related data found. Safe to delete.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                      <p className="text-sm text-yellow-800 font-semibold mb-2">
                        ⚠ Cannot delete: This country has related data:
                      </p>
                      <ul className="text-sm text-yellow-700 space-y-1 ml-4 list-disc">
                        {deletionCheck.datasets > 0 && <li>{deletionCheck.datasets} dataset(s)</li>}
                        {deletionCheck.instances > 0 && <li>{deletionCheck.instances} instance(s)</li>}
                        {deletionCheck.admin_boundaries > 0 && <li>{deletionCheck.admin_boundaries} admin boundary(ies)</li>}
                        {deletionCheck.user_countries > 0 && <li>{deletionCheck.user_countries} user assignment(s)</li>}
                      </ul>
                      <p className="text-xs text-yellow-700 mt-2">
                        Please remove or reassign all related data before deleting this country.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={!deletionCheck?.canDelete || saving}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Country
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setDeletingCountry(null);
                    setDeletionCheck(null);
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
