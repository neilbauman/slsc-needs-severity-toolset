// app/page.tsx
'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="space-y-6">
      <section className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold text-indigo-800 mb-2">Core Datasets</h2>
        <ul className="list-disc list-inside text-gray-700">
          <li>Population (ADM1–ADM4)</li>
          <li>Evacuation Centers</li>
          <li>Building Typology</li>
        </ul>
      </section>

      <section className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold text-indigo-800 mb-2">Baseline Instance</h2>
        <p className="text-gray-600">Composed of selected core datasets</p>
      </section>

      <section className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold text-indigo-800 mb-2">Response Instances</h2>
        <Link href="/instances" className="text-blue-600 hover:underline">
          View all instances
        </Link>
      </section>

      <section className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold text-indigo-800 mb-2">Map Viewer</h2>
        <p className="text-gray-600">
          Will support ADM-level toggles and scored dataset overlays
        </p>
      </section>
    </main>
  );
}
