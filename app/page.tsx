'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useCountry } from '@/lib/countryContext';
import { Globe, ArrowRight, Shield, Users, LogIn, Settings } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import FrameworkConfigModal from '@/components/FrameworkConfigModal';
import FrameworkStructureManager from '@/components/FrameworkStructureManager';

type Country = {
  id: string;
  iso_code: string;
  name: string;
  active: boolean;
};

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { availableCountries, currentCountry, isSiteAdmin, loading: countryLoading } = useCountry();
  const router = useRouter();
  const [publicCountries, setPublicCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFrameworkConfig, setShowFrameworkConfig] = useState(false);
  const [showFrameworkStructure, setShowFrameworkStructure] = useState(false);

  // Load public countries (all active countries) with retry logic
  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const timeoutId = setTimeout(() => {
      if (loadingCountries && publicCountries.length === 0 && !error) {
        console.warn('Countries query is taking longer than 5 seconds');
        setError('Countries query is taking longer than expected. Check your Supabase connection. If you haven\'t run the database migrations yet, please run them in your Supabase SQL Editor.');
        setLoadingCountries(false);
      }
    }, 5000);

    async function loadPublicCountries(attempt = 1) {
      try {
        setError(null);
        let supabase;
        try {
          supabase = createClient();
        } catch (clientError: any) {
          console.error('[HomePage] Failed to create Supabase client:', clientError);
          setError(`Database configuration error: ${clientError.message || 'Please check your .env.local file'}`);
          setPublicCountries([]);
          setLoadingCountries(false);
          return;
        }
        
        // Use a simpler query with timeout handling
        const queryPromise = supabase
          .from('countries')
          .select('id, iso_code, name, active')
          .eq('active', true)
          .order('name');
        
        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
        );
        
        const { data, error: queryError } = await Promise.race([
          queryPromise,
          timeoutPromise,
        ]) as any;
        
        if (cancelled) return;
        
        if (queryError) {
          console.error('Error loading countries:', queryError);
          // If table doesn't exist, that's okay - show empty state
          if (queryError.code === 'PGRST116' || queryError.message?.includes('does not exist')) {
            setError('Countries table not set up yet. Please run database migrations.');
            setPublicCountries([]);
            setLoadingCountries(false);
          } else if (attempt < maxRetries && !cancelled) {
            // Retry on transient errors
            console.log(`Retrying countries query (attempt ${attempt + 1}/${maxRetries})...`);
            setTimeout(() => {
              if (!cancelled) loadPublicCountries(attempt + 1);
            }, retryDelay);
          } else {
            setError(`Failed to load countries: ${queryError.message || 'Connection timeout. Please check your Supabase connection and try refreshing the page.'}`);
            setPublicCountries([]);
            setLoadingCountries(false);
          }
        } else {
          setPublicCountries(data || []);
          setLoadingCountries(false);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load countries:', err);
        
        if (attempt < maxRetries && !cancelled) {
          // Retry on timeout/network errors
          console.log(`Retrying countries query after error (attempt ${attempt + 1}/${maxRetries})...`);
          setTimeout(() => {
            if (!cancelled) loadPublicCountries(attempt + 1);
          }, retryDelay);
        } else {
          setError(err?.message || 'Failed to load countries. The database connection may be slow or unavailable. Please try refreshing the page.');
          setPublicCountries([]);
          setLoadingCountries(false);
        }
      }
    }
    loadPublicCountries();
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  // If user is logged in and has a country selected, redirect to dashboard ONCE on initial load
  // But allow them to navigate back to home page explicitly
  useEffect(() => {
    if (!authLoading && !countryLoading && user && currentCountry) {
      // Check if we've already done the initial redirect (stored in sessionStorage)
      // This allows users to explicitly navigate back to home later
      const hasRedirected = typeof window !== 'undefined' 
        ? sessionStorage.getItem('homeRedirected') === 'true'
        : false;
      
      if (!hasRedirected && typeof window !== 'undefined' && window.location.pathname === '/') {
        // Mark that we've redirected, so user can navigate back to home later
        sessionStorage.setItem('homeRedirected', 'true');
        router.push(`/countries/${currentCountry.iso_code.toLowerCase()}`);
      }
    }
  }, [user, currentCountry, authLoading, countryLoading, router]);

  // Show countries user has access to if logged in, otherwise show all public countries
  const countriesToShow = user && availableCountries.length > 0 ? availableCountries : publicCountries;

  // Show loading state; hard escape after 12s so we never block forever
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [forceShowContent, setForceShowContent] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (authLoading || (loadingCountries && publicCountries.length === 0 && !error)) {
        setLoadingTimeout(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [authLoading, loadingCountries, publicCountries.length, error]);
  useEffect(() => {
    const escape = setTimeout(() => setForceShowContent(true), 12000);
    return () => clearTimeout(escape);
  }, []);

  const stillLoading = authLoading || (loadingCountries && publicCountries.length === 0 && !error);
  if (stillLoading && !forceShowContent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
          {loadingTimeout && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto text-left">
              <p className="text-sm text-yellow-800 font-semibold mb-2">Loading is taking longer than expected</p>
              <p className="text-xs text-yellow-700 mb-1"><strong>If you saw a blank page or chunk/500 errors first:</strong> In the project folder run <code className="bg-yellow-100 px-1 rounded">npm start</code>, wait for &quot;✓ Ready&quot;, then hard-refresh (Cmd+Shift+R).</p>
              <p className="text-xs text-yellow-700 mb-2 mt-2">Otherwise this might be:</p>
              <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
                <li>Supabase connection — check <code className="bg-yellow-100 px-0.5 rounded">.env.local</code> (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)</li>
                <li>Database timeout or network — see browser console (F12)</li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setForceShowContent(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Show page anyway
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                >
                  Reload Page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Shown when we escaped loading after 12s */}
        {forceShowContent && stillLoading && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Page loaded slowly.</strong> Some data may still be loading. If the list below is empty or something looks wrong, try <strong>Refreshing</strong> or run <code className="bg-amber-100 px-1 rounded">npm start</code> in the project folder and hard-refresh (Cmd+Shift+R).
            </p>
          </div>
        )}
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> {error}
            </p>
            <p className="text-xs text-yellow-700 mt-2">
              If you haven't run the database migrations yet, please run them in your Supabase SQL Editor.
            </p>
            <button
              onClick={() => {
                setError(null);
                setLoadingCountries(true);
                setPublicCountries([]);
                window.location.reload();
              }}
              className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-4">
            <Globe className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            SLSC Needs Severity Toolset
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
            Select a country to access its Shelter Severity Center dashboard, datasets, and response instances.
          </p>
          
          {/* Auth Status */}
          <div className="flex items-center justify-center gap-4">
            {user ? (
              <>
                {isSiteAdmin && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    <Shield size={16} />
                    Site Administrator
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  Logged in as: <span className="font-semibold">{user.email}</span>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg"
              >
                <LogIn size={18} />
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Countries Grid */}
        {loadingCountries ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading countries...</div>
          </div>
        ) : countriesToShow.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-300">
            <Users className="mx-auto text-gray-400 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {user ? 'No Countries Available' : 'No Countries Configured'}
            </h2>
            <p className="text-gray-600 mb-4">
              {user 
                ? 'You don\'t have access to any countries yet. Contact an administrator to assign countries to your account.'
                : 'No countries are currently available. Please sign in to access country dashboards.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {countriesToShow.map((country) => (
                <Link
                  key={country.id}
                  href={user ? `/countries/${country.iso_code.toLowerCase()}` : '/login'}
                  className="group bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-xl transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                          {country.iso_code}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition">
                            {country.name}
                          </h3>
                          <p className="text-sm text-gray-500">{country.iso_code}</p>
                        </div>
                      </div>
                    </div>
                    <ArrowRight 
                      className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" 
                      size={20} 
                    />
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      {user 
                        ? `View datasets, instances, and analytics for ${country.name}`
                        : `Sign in to access ${country.name} dashboard`}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        )}

        {/* Quick Actions - Only show if logged in */}
        {user && (
          <div className="mt-12 grid gap-4 md:grid-cols-3">
              <Link
                href="/datasets"
                prefetch={false}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-500 hover:shadow-lg transition text-center"
              >
                <h3 className="font-semibold text-gray-900 mb-2">All Datasets</h3>
                <p className="text-sm text-gray-600">Browse datasets across all countries</p>
              </Link>
              <Link
                href="/instances"
                prefetch={false}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-500 hover:shadow-lg transition text-center"
              >
                <h3 className="font-semibold text-gray-900 mb-2">Legacy Instances</h3>
                <p className="text-sm text-gray-600">View legacy response instances</p>
              </Link>
              <Link
                href="/responses"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:border-green-500 hover:shadow-lg transition text-center"
              >
                <h3 className="font-semibold text-green-700 mb-2">Layered Responses</h3>
                <p className="text-sm text-gray-600">New: Baseline + temporal layer architecture</p>
              </Link>
              {isSiteAdmin && (
                <>
                  <Link
                    href="/admin"
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-500 hover:shadow-lg transition text-center"
                  >
                    <h3 className="font-semibold text-gray-900 mb-2">Admin Panel</h3>
                    <p className="text-sm text-gray-600">Manage countries and users</p>
                  </Link>
                  <button
                    onClick={() => setShowFrameworkConfig(true)}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-500 hover:shadow-lg transition text-center"
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Settings size={20} className="text-blue-600" />
                      <h3 className="font-semibold text-gray-900">Framework Config</h3>
                    </div>
                    <p className="text-sm text-gray-600">Configure aggregation settings</p>
                  </button>
                  <button
                    onClick={() => setShowFrameworkStructure(true)}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-500 hover:shadow-lg transition text-center"
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Settings size={20} className="text-blue-600" />
                      <h3 className="font-semibold text-gray-900">Framework Structure</h3>
                    </div>
                    <p className="text-sm text-gray-600">Manage pillars, themes, indicators</p>
                  </button>
                </>
              )}
          </div>
        )}
        
        {/* Framework Configuration Modal */}
        {isSiteAdmin && (
          <>
            <FrameworkConfigModal
              open={showFrameworkConfig}
              onClose={() => setShowFrameworkConfig(false)}
            />
            <FrameworkStructureManager
              open={showFrameworkStructure}
              onClose={() => setShowFrameworkStructure(false)}
            />
          </>
        )}

        {/* Public Info Section */}
        {!user && (
          <div className="mt-12 bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About the SSC Toolset</h2>
              <p className="text-gray-600 max-w-2xl mx-auto mb-6">
                The Shelter Severity Center (SSC) Toolset provides comprehensive analysis and visualization 
                of shelter-related data across multiple countries. Access country-specific dashboards, datasets, 
                and response instances to support humanitarian decision-making.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg"
              >
                <LogIn size={18} />
                Sign In to Get Started
              </Link>
          </div>
        )}
      </div>
    </div>
  );
}
