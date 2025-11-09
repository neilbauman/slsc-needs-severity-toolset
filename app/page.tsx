'use client';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Philippines SSC Toolset</h1>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Core Datasets</h2>
        <ul className="list-disc list-inside">
          <li>Population (ADM1–ADM4)</li>
          <li>Evacuation Centers</li>
          <li>Building Typology</li>
        </ul>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Baseline Instance</h2>
        <p className="text-sm text-gray-600">Composed of selected core datasets</p>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Response Instances</h2>
        <Link href="/instances" className="text-blue-600 underline">View all instances</Link>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Map Viewer</h2>
        <p className="text-sm">Will support ADM-level toggles and scored dataset overlays</p>
      </section>
    </main>
  );
}
