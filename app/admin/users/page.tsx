'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useCountry } from '@/lib/countryContext';
import { createClient } from '@/lib/supabaseClient';
import { Plus, Trash2, Edit2, Shield, User, Users, X, Check, AlertTriangle, Globe } from 'lucide-react';
import Link from 'next/link';

interface UserWithAccess {
  id: string;
  email: string;
  full_name?: string | null;
  created_at: string;
  user_countries: {
    id: string;
    country_id: string;
    role: 'admin' | 'user';
    country: {
      id: string;
      iso_code: string;
      name: string;
    };
  }[];
  isSiteAdmin: boolean;
}

interface Country {
  id: string;
  iso_code: string;
  name: string;
  active: boolean;
}

export default function UserManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { isSiteAdmin, loading: countryLoading } = useCountry();
  const router = useRouter();
  const supabase = createClient();
  
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [assigningUser, setAssigningUser] = useState<UserWithAccess | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Redirect if not site admin
  useEffect(() => {
    if (!authLoading && !countryLoading && (!user || !isSiteAdmin)) {
      router.push('/');
    }
  }, [user, isSiteAdmin, authLoading, countryLoading, router]);

  // Load users and countries
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all countries
      const { data: countriesData, error: countriesError } = await supabase
        .from('countries')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (countriesError) throw countriesError;
      setCountries(countriesData || []);

      // Load all users using API route (uses service role to access auth.users)
      const response = await fetch('/api/admin/get-all-users');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load users' }));
        throw new Error(errorData.error || `Failed to load users: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load users');
      }

      // Transform API response to our format
      const usersList: UserWithAccess[] = (result.users || []).map((u: any) => {
        const userCountries = (u.user_countries || []).map((uc: any) => ({
          id: uc.id,
          country_id: uc.country_id,
          role: uc.role,
          country: uc.country,
        }));

        const isSiteAdmin = userCountries.some((uc: any) => uc.role === 'admin');

        return {
          id: u.id,
          email: u.email || `user-${u.id.slice(0, 8)}@...`,
          full_name: u.full_name || null,
          created_at: u.created_at,
          user_countries: userCountries,
          isSiteAdmin,
        };
      });

      // Sort users: site admins first, then by email
      usersList.sort((a, b) => {
        if (a.isSiteAdmin !== b.isSiteAdmin) {
          return a.isSiteAdmin ? -1 : 1;
        }
        return (a.email || '').localeCompare(b.email || '');
      });

      console.log(`Loaded ${usersList.length} users from API`);
      setUsers(usersList);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSiteAdmin) {
      loadData();
    }
  }, [isSiteAdmin]);

  // Assign country access to user
  const handleAssignAccess = async () => {
    if (!assigningUser || !selectedCountry) {
      setFormError('Please select a country');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('user_countries')
        .select('id')
        .eq('user_id', assigningUser.id)
        .eq('country_id', selectedCountry)
        .single();

      if (existing) {
        // Update existing assignment
        const { error: updateError } = await supabase
          .from('user_countries')
          .update({ role: selectedRole })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Create new assignment
        const { error: insertError } = await supabase
          .from('user_countries')
          .insert({
            user_id: assigningUser.id,
            country_id: selectedCountry,
            role: selectedRole,
          });

        if (insertError) throw insertError;
      }

      // Reset form and reload
      setAssigningUser(null);
      setSelectedCountry('');
      setSelectedRole('user');
      await loadData();
    } catch (err: any) {
      console.error('Error assigning access:', err);
      setFormError(err.message || 'Failed to assign access');
    } finally {
      setSaving(false);
    }
  };

  // Create new user
  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserEmail.includes('@')) {
      setFormError('Valid email is required');
      return;
    }

    if (!sendInvite && !newUserPassword) {
      setFormError('Password is required if not sending invitation email');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      // Get current user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword || undefined,
          sendInvite,
          currentUserId: session.user.id,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        // If user already exists, reload data to show them in the list
        if (result.existingUserId) {
          await loadData();
          // Scroll to the existing user after a brief delay
          setTimeout(() => {
            const userElement = document.getElementById(`user-${result.existingUserId}`);
            if (userElement) {
              userElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Highlight the user briefly
              userElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
              setTimeout(() => {
                userElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
              }, 3000);
            }
          }, 500);
        }
        throw new Error(result.error || 'Failed to create user');
      }

      // Reset form and reload
      setNewUserEmail('');
      setNewUserPassword('');
      setSendInvite(true);
      setShowCreateUserForm(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating user:', err);
      setFormError(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  // Remove country access
  const handleRemoveAccess = async (userCountryId: string) => {
    if (!confirm('Are you sure you want to remove this access?')) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_countries')
        .delete()
        .eq('id', userCountryId);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error removing access:', err);
      alert(err.message || 'Failed to remove access');
    } finally {
      setSaving(false);
    }
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
                <Users className="text-blue-600" size={32} />
                User Management
              </h1>
              <p className="text-gray-600 mt-2">Assign administrative access and country-level permissions</p>
            </div>
            <Link
              href="/admin"
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-blue-600 mt-0.5" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">How User Access Works:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Site Admin:</strong> Users with role "admin" for any country can access all countries and manage the system</li>
                <li><strong>Country User:</strong> Users with role "user" for specific countries can only access those countries</li>
                <li><strong>No Access:</strong> Users not in this list cannot access the system</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Create User Form */}
        {showCreateUserForm && (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Create New User Account
              </h2>
              <button
                onClick={() => {
                  setShowCreateUserForm(false);
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setSendInvite(true);
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium mb-1">{formError}</p>
                {formError.includes('already exists') && (
                  <p className="text-xs text-red-700 mt-1">
                    The user has been highlighted in the list below. Click "Add Access" to assign country access and roles.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@example.com"
                  disabled={saving}
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendInvite"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={saving}
                />
                <label htmlFor="sendInvite" className="ml-2 block text-sm text-gray-700">
                  Send invitation email (user will set their own password)
                </label>
              </div>

              {!sendInvite && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                    disabled={saving}
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    User will need to change this password on first login
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateUser}
                  disabled={saving || !newUserEmail}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Create User
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateUserForm(false);
                    setNewUserEmail('');
                    setNewUserPassword('');
                    setSendInvite(true);
                    setFormError(null);
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Access Form */}
        {assigningUser && (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Assign Access to {assigningUser.full_name || assigningUser.email}
                {assigningUser.full_name && (
                  <span className="text-sm font-normal text-gray-600 ml-2">({assigningUser.email})</span>
                )}
              </h2>
              <button
                onClick={() => {
                  setAssigningUser(null);
                  setSelectedCountry('');
                  setSelectedRole('user');
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium mb-1">{formError}</p>
                {formError.includes('already exists') && (
                  <p className="text-xs text-red-700 mt-1">
                    The user has been highlighted in the list below. Click "Add Access" to assign country access and roles.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                >
                  <option value="">Select a country...</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name} ({country.iso_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'user')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                >
                  <option value="user">User (country-specific access)</option>
                  <option value="admin">Admin (site administrator - all countries)</option>
                </select>
                {selectedRole === 'admin' && (
                  <p className="mt-1 text-xs text-blue-600">
                    ⚠️ Admin role grants access to all countries and administrative functions
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAssignAccess}
                  disabled={saving || !selectedCountry}
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
                      Assign Access
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setAssigningUser(null);
                    setSelectedCountry('');
                    setSelectedRole('user');
                    setFormError(null);
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Users ({users.length})
            </h2>
            {!showCreateUserForm && (
              <button
                onClick={() => {
                  setShowCreateUserForm(true);
                  setAssigningUser(null);
                  setFormError(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={16} />
                Create User
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="mx-auto text-gray-400 mb-4" size={48} />
              <p>No users found in the system.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {users.map((userItem) => (
                <div
                  key={userItem.id}
                  id={`user-${userItem.id}`}
                  className="px-6 py-4 hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {userItem.isSiteAdmin ? (
                          <Shield className="text-blue-600" size={20} />
                        ) : (
                          <User className="text-gray-400" size={20} />
                        )}
                        <div>
                          {userItem.full_name && (
                            <h3 className="text-lg font-semibold text-gray-900">
                              {userItem.full_name}
                            </h3>
                          )}
                          <div className="flex items-center gap-2">
                            <p className={`text-sm ${userItem.full_name ? 'text-gray-600' : 'text-lg font-semibold text-gray-900'}`}>
                              {userItem.email}
                            </p>
                            {userItem.isSiteAdmin && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Site Administrator
                              </span>
                            )}
                          </div>
                          {!userItem.full_name && userItem.isSiteAdmin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                              Site Administrator
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {userItem.user_countries.length > 0 ? (
                        <div className="ml-8 space-y-2">
                          <p className="text-sm font-medium text-gray-700">Country Access:</p>
                          <div className="flex flex-wrap gap-2">
                            {userItem.user_countries.map((uc) => (
                              <div
                                key={uc.id}
                                className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md text-sm"
                              >
                                <Globe size={14} className="text-gray-500" />
                                <span className="text-gray-700">
                                  {uc.country.name} ({uc.country.iso_code})
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  uc.role === 'admin' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {uc.role}
                                </span>
                                <button
                                  onClick={() => handleRemoveAccess(uc.id)}
                                  className="text-red-600 hover:text-red-800 ml-1"
                                  title="Remove access"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="ml-8 text-sm text-gray-500">No country access assigned</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setAssigningUser(userItem);
                          setSelectedCountry('');
                          setSelectedRole('user');
                          setFormError(null);
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Plus size={14} />
                        Add Access
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Note about user management */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-blue-600 mt-0.5" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">User Management Guide:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li><strong>Create User:</strong> Click "Create User" to create a new account. You can send an invitation email (user sets their own password) or set a password manually.</li>
                <li><strong>Assign Access:</strong> Click "Add Access" next to any user to assign country access</li>
                <li><strong>Admin Role:</strong> Select "Admin" role to grant site administrator privileges (access to all countries and admin functions)</li>
                <li><strong>User Role:</strong> Select "User" role to grant access to specific countries only</li>
                <li><strong>Remove Access:</strong> Click the X icon on any country assignment to remove access</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
