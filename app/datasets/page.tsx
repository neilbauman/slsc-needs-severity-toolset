import Link from "next/link";

export default function DatasetsPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold text-sky-900 mb-2">Core Datasets</h1>
        <p className="text-gray-700 mb-6">
          Upload and manage core datasets used in SSC calculations.
        </p>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-sky-900">Uploaded Datasets</h2>
            <Link
              href="#"
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-4 py-2 rounded shadow"
            >
              Upload New Dataset
            </Link>
          </div>

          <ul className="space-y-4">
            <li className="bg-gray-50 p-4 rounded-lg shadow-sm border">
              <h3 className="text-sky-800 font-medium">Population (ADM1–ADM4)</h3>
              <p className="text-sm text-gray-600">CSV format • Last updated: Nov 8</p>
            </li>
            <li className="bg-gray-50 p-4 rounded-lg shadow-sm border">
              <h3 className="text-sky-800 font-medium">Evacuation Centers</h3>
              <p className="text-sm text-gray-600">GeoJSON format • Last updated: Nov 6</p>
            </li>
            <li className="bg-gray-50 p-4 rounded-lg shadow-sm border">
              <h3 className="text-sky-800 font-medium">Building Typology</h3>
              <p className="text-sm text-gray-600">Excel format • Last updated: Nov 2</p>
            </li>
          </ul>
        </div>

        <div className="text-sm text-gray-500 text-center">
          Need help formatting your dataset?{' '}
          <Link href="#" className="underline text-sky-700">
            View upload guide
          </Link>
        </div>
      </div>
    </main>
  );
}
