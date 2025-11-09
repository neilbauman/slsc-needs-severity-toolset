'use client';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="p-6 space-y-8">
      <h1 className="text-3xl font-bold text-blue-800">Philippines Shelter Severity Toolset (sandbox)</h1>
      <nav className="text-sm breadcrumbs text-blue-600">
        <ul className="flex gap-2">
          <li>Home</li>
        </ul>
      </nav>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Core Datasets</h2>
          <Link href="/datasets" className="text-blue-600 underline">Manage Datasets</Link>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Baseline Instance</h2>
          <p className="text-sm text-gray-600">Composed of selected core datasets</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Response Instances</h2>
          <Link href="/instances" className="text-blue-600 underline">View All Instances</Link>
        </div>
        <div className="bg-white rounded-xl shadow p-4 h-64">
          <h2 className="text-lg font-semibold mb-2">Map Viewer</h2>
          <p className="text-sm">Map display coming soon...</p>
        </div>
      </section>
    </main>
  );
}