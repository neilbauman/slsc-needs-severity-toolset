'use client';
import Link from 'next/link';

export default function DatasetsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b pb-4 mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">Datasets</h1>
          <nav className="text-sm text-gray-500 mt-1">
            <Link href="/" className="text-blue-600 hover:underline">
              Dashboard
            </Link>{' '}
            &raquo; Datasets
          </nav>
        </header>

        {/* Upload Button */}
        <div className="flex justify-end">
          <Link
            href="/datasets/upload"
            className="inline-block bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Upload New Dataset
          </Link>
        </div>

        {/* Core Datasets */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">
            Core Datasets
          </h2>
          <div className="space-y-2">
            {[
              'Population (ADM1–ADM4)',
              'Administrative Boundaries (ADM0–ADM4)',
              'GIS Layers (Buildings, Roads, Elevation)',
            ].map((title) => (
              <div
                key={title}
                className="bg-white rounded-xl shadow px-4 py-3 text-sm text-gray-700"
              >
                {title}
              </div>
            ))}
          </div>
        </section>

        {/* Other Datasets */}
        <section className="space-y-4 pt-6">
          <h2 className="text-lg font-semibold text-gray-700">
            Other Uploaded Datasets
          </h2>
          <div className="space-y-2">
            {[
              'Building Typology by Barangay',
              'Evacuation Centers (Partial)',
            ].map((title) => (
              <div
                key={title}
                className="bg-white rounded-xl shadow px-4 py-3 text-sm text-gray-700"
              >
                {title}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
