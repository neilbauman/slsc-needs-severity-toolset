'use client';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#163F5B] text-white px-6 py-4 shadow">
        <h1 className="text-xl font-semibold">
          Philippines Shelter Severity Toolset <span className="text-yellow-400">(sandbox)</span>
        </h1>
        <nav className="text-sm text-white mt-1">Home</nav>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Core Datasets Panel */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold text-[#163F5B]">Core Datasets</h2>
          <ul className="list-disc list-inside text-sm text-gray-800 mt-2 space-y-1">
            <li>Population (ADM1–ADM4)</li>
            <li>Evacuation Centers</li>
            <li>Building Typology</li>
          </ul>
          <div className="mt-4">
            <Link href="/datasets">
              <button className="bg-yellow-500 text-white font-medium px-4 py-2 rounded hover:bg-yellow-600 transition">
                Manage Datasets
              </button>
            </Link>
          </div>
        </section>

        {/* Baseline Instance Panel */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold text-[#163F5B]">Baseline Instance</h2>
          <p className="text-sm text-gray-700 mt-2">
            Composed of selected core datasets used to compute the SSC index.
          </p>
          <div className="mt-4">
            <Link href="/instances">
              <button className="bg-yellow-500 text-white font-medium px-4 py-2 rounded hover:bg-yellow-600 transition">
                View Instances
              </button>
            </Link>
          </div>
        </section>

        {/* Map Viewer Panel */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold text-[#163F5B]">Map Viewer</h2>
          <p className="text-sm text-gray-700 mt-2">
            Will support ADM-level toggles and scored dataset overlays.
          </p>
        </section>
      </main>
    </div>
  );
}
