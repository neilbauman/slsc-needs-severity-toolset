'use client';

import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header with title and breadcrumbs */}
      <header className="bg-white shadow px-6 py-4">
        <div className="text-sm text-gray-400">Home</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Philippines Shelter Severity Toolset <span className="text-sm text-gray-500">(sandbox)</span>
        </h1>
        <p className="text-sm text-gray-500">Rapid dashboard for data and instance management</p>
      </header>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Core Datasets */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-700">Core Datasets</h2>
          <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
            <li>Population (ADM1–ADM4)</li>
            <li>Evacuation Centers</li>
            <li>Building Typology</li>
          </ul>
          <div className="mt-4">
            <Link
              href="/datasets"
              className="inline-block bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm"
            >
              Manage Datasets
            </Link>
          </div>
        </section>

        {/* Baseline Instance */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-700">Baseline Instance</h2>
          <p className="text-sm text-gray-600 mt-1">
            Composed of selected core datasets used to compute the SSC index.
          </p>
          <div className="mt-4">
            <Link
              href="/instances"
              className="inline-block bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 text-sm"
            >
              View Instances
            </Link>
          </div>
        </section>

        {/* Map Viewer */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-700">Map Viewer</h2>
          <p className="text-sm text-gray-600 mt-1">
            Will support ADM-level toggles and scored dataset overlays.
          </p>
        </section>
      </div>
    </main>
  );
}
