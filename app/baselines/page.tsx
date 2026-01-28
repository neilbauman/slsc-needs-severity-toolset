'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * /baselines has no id — redirect to /responses where baselines are listed.
 * This prevents 404s when something requests /baselines (e.g. RSC prefetch).
 */
export default function BaselinesIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/responses');
  }, [router]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-2">Redirecting to baselines...</p>
        <Link href="/responses" className="text-blue-600 hover:underline">
          Go to Layered Responses
        </Link>
      </div>
    </div>
  );
}
