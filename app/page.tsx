'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      {/* Header */}
      <header className="bg-[#163B54] text-white px-6 py-4 shadow">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            Philippines Shelter Severity Toolset <span className="text-yellow-400">(sandbox)</span>
          </h1>
          <nav className="text-sm">
            <Link href="/" className="hover:underline">
              Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        {/* Core Datasets Panel */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold text-[#163B54] mb-2">Core Datasets</h2>
          <ul className="list-disc list-inside mb-4 text-sm">
            <li>Population (ADM1–ADM4)</li>
            <li>Evacuation Centers</li>
            <li>Building Typology</li>
          </ul>
          <Link
            href="/datasets"
            className="inline-block bg-yellow-400 hover:bg-yellow-500 text-[#163B54] font-medium px-4 py-2 rounded"
          >
            Manage Datasets
          </Link>
        </section>

        {/* Baseline Instance Panel */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold text-[#163B54] mb-2">Baseline Instance</h2>
          <p className="text-sm mb-4">
            Composed of selected core datasets used to compute the SSC index.
          </p>
          <Link
            href="/instances"
            className="inline-block bg-yellow-400 hover:bg-yellow-500 text-[#163B54] font-medium px-4 py-2 rounded"
          >
            View Instances
          </Link>
        </section>

        {/* Map Viewer Panel */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold text-[#163B54] mb-2">Map Viewer</h2>
          <p className="text-sm">
            Will support ADM-level toggles and scored dataset overlays.
          </p>
        </section>
      </main>
    </div>
  );
}
