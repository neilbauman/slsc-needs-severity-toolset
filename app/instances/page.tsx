'use client';

import Link from 'next/link';

export default function InstancesPage() {
  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Response Instances</h1>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Existing Instances</h2>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>
            <Link href="/instances/alpha-response" className="text-blue-600 underline">
              Alpha Response – Oct 2025
            </Link>
          </li>
          <li>
            <Link href="/instances/baseline-q3" className="text-blue-600 underline">
              Baseline Q3 Snapshot
            </Link>
          </li>
        </ul>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Create New Instance</h2>
        <p className="text-sm text-gray-600">
          You will be able to define a new instance by selecting datasets and configuring SSC parameters.
        </p>
      </section>
    </main>
  );
}
