'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Core Datasets Section */}
      <section className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <h2 className="text-md font-semibold text-gray-800 mb-1">
          Core Datasets
        </h2>
        <p className="text-sm text-gray-600 mb-2">
          Upload and manage baseline datasets used for SSC calculations.
        </p>
        <ul className="text-sm text-gray-700 mb-3 list-disc list-inside">
          <li>Population</li>
          <li>Evacuation Centers</li>
          <li>Building Typology</li>
        </ul>
        <Link
          href="/datasets"
          className="inline-block bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-medium py-1.5 px-3 rounded transition"
        >
          Manage Datasets
        </Link>
      </section>

      {/* Baseline Instance Section */}
      <section className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <h2 className="text-md font-semibold text-gray-800 mb-1">
          Baseline Instances
        </h2>
        <p className="text-sm text-gray-600 mb-2">
          Configure instances that combine datasets and generate shelter severity scores.
        </p>
        <Link
          href="/instances"
          className="inline-block bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-medium py-1.5 px-3 rounded transition"
        >
          View Instances
        </Link>
      </section>

      {/* Map Viewer Section */}
      <section className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <h2 className="text-md font-semibold text-gray-800 mb-1">
          Map Viewer
        </h2>
        <p className="text-sm text-gray-600">
          Explore cleaned and scored datasets over administrative boundaries.
          Use map layers to view severity distributions.
        </p>
      </section>
    </div>
  )
}
