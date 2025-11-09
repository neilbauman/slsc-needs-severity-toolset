'use client';

import Link from 'next/link';

export default function DatasetsPage() {
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
            <span className="mx-2">/</span>
            <span>Datasets</span>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        {/* Core Datasets Section */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold text-[#163B54] mb-4">Core Datasets</h2>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Admin Boundaries (ADM1–ADM4)</li>
            <li>Population by Admin</li>
            <li>Building Typology</li>
            <li>Evacuation Centers</li>
          </ul>
        </section>

        {/* Uploaded Raw Datasets Section */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold text-[#163B54] mb-4">Uploaded Datasets</h2>
          <p className="text-sm mb-4">Additional datasets uploaded for baseline analysis.</p>
          {/* Placeholder until upload functionality is implemented */}
          <div className="text-sm text-gray-500 italic">No datasets uploaded yet.</div>
        </section>

        {/* Add Dataset Button */}
        <div>
          <Link
            href="#"
            className="inline-block bg-yellow-400 hover:bg-yellow-500 text-[#163B54] font-medium px-4 py-2 rounded shadow"
          >
            Add New Dataset
          </Link>
        </div>
      </main>
    </div>
  );
}
