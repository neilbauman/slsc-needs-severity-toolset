'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useCountry } from '@/lib/countryContext';
import CountryAdminLevelsConfig from '@/components/CountryAdminLevelsConfig';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export default function AdminLevelsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isSiteAdmin, loading: countryLoading } = useCountry();
  const router = useRouter();

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
        <CountryAdminLevelsConfig />
      </div>
    </div>
  );
}
