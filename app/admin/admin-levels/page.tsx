'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useCountry } from '@/lib/countryContext';
import CountryAdminLevelsConfig from '@/components/CountryAdminLevelsConfig';
import { Shield, Globe } from 'lucide-react';
import Link from 'next/link';

// Prevent static generation - this page uses useSearchParams
export const dynamic = 'force-dynamic';

function AdminLevelsContent() {
  const { user, loading: authLoading } = useAuth();
  const { isSiteAdmin, loading: countryLoading, availableCountries } = useCountry();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  
  // Ensure we're on the client before accessing searchParams
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Pre-select country from URL parameter
  useEffect(() => {
    if (!mounted) return;
    const countryIdParam = searchParams.get('countryId');
    if (countryIdParam && availableCountries.some(c => c.id === countryIdParam)) {
      setSelectedCountryId(countryIdParam);
    }
  }, [mounted, searchParams, availableCountries]);

  // Redirect if not site admin
  if (!authLoading && !countryLoading && (!user || !isSiteAdmin)) {
    router.push('/');
    return null;
  }

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-gray-600 hover:text-gray-900 mb-4 inline-block"
          >
            ← Back to Admin
          </Link>
        </div>

        {/* Country Selector */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Globe className="inline mr-2" size={16} />
            Select Country to Configure
          </label>
          <select
            value={selectedCountryId}
            onChange={(e) => setSelectedCountryId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a country...</option>
            {availableCountries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name} ({country.iso_code})
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            Each country has its own admin level configuration. Select a country to configure its administrative level names (e.g., "Province", "District", "Municipality").
          </p>
        </div>

        {/* Configuration Component */}
        {selectedCountryId ? (
          <CountryAdminLevelsConfig countryId={selectedCountryId} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <Globe className="mx-auto text-gray-400 mb-4" size={48} />
            <p>Please select a country above to configure its admin level names.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Note: This page uses useSearchParams which requires dynamic rendering
// The Suspense boundary ensures proper client-side rendering
export default function AdminLevelsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AdminLevelsContent />
    </Suspense>
  );
}
