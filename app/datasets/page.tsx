'use client';

import Link from 'next/link';

export default function DatasetsPage() {
  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Core Datasets</h1>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Available Datasets</h2>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>
            <Link href="/datasets/population" className="text-blue-600 underline">
              Population (ADM1–ADM4)
            </Link>
          </li>
          <li>
            <Link href="/datasets/evacuation-centers" className="text-blue-600 underline">
              Evacuation Centers
            </Link>
          </li>
          <li>
            <Link href="/datasets/building-typology" className="text-blue-600 underline">
              Building Typology
            </Link>
          </li>
        </ul>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Upload New Dataset</h2>
        <p className="text-sm text-gray-600">
          Coming soon: drag-and-drop support for CSV, GeoJSON, and Excel files. Uploaded datasets will appear in the list above.
        </p>
      </section>
    </main>
  );
}
