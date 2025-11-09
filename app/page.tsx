'use client';

import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-[#003f5c] text-white px-6 py-6 shadow">
        <h1 className="text-2xl font-semibold">Philippines Shelter Severity Toolset <span className="text-sm text-[#ffa600]">(sandbox)</span></h1>
        <nav className="mt-1 text-sm text-gray-200">
          Home
        </nav>
      </header>

      {/* Page content */}
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Core Datasets */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
          <h2 className="text-lg font-medium text-[#003f5c]">Core Datasets</h2>
          <ul className="list-disc list-inside text-sm mt-2 text-gray-700 space-y-1">
            <li>Population (ADM1–ADM4)</li>
            <li>Evacuation Centers</li>
            <li>Building Typology</li>
          </ul>
          <div className="mt-4">
            <Link
              href="/datasets"
              className="inline-block bg-[#ffa600] text-[#003f5c] font-medium px-4 py-2 rounded hover:bg-[#ffb733] transition text-sm"
            >
              Manage Datasets
            </Link>
          </div>
        </section>

        {/* Baseline Instance */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
          <h2 className="text-lg font-medium text-[#003f5c]">Baseline Instance</h2>
          <p className="text-sm text-gray-700 mt-1">
            Composed of selected core datasets used to compute the SSC index.
          </p>
          <div className="mt-4">
            <Link
              href="/instances"
              className="inline-block bg-[#ffa600] text-[#003f5c] font-medium px-4 py-2 rounded hover:bg-[#ffb733] transition text-sm"
            >
              View Instances
            </Link>
          </div>
        </section>

        {/* Map Viewer */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
          <h2 className="text-lg font-medium text-[#003f5c]">Map Viewer</h2>
          <p className="text-sm text-gray-700 mt-1">
            Will support ADM-level toggles and scored dataset overlays.
          </p>
        </section>
      </div>
    </main>
  );
}
