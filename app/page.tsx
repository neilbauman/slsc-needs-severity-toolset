import Link from 'next/link';

export default function Dashboard() {
  return (
    <main className="p-6 space-y-6">
      <header className="bg-primary text-white p-4 rounded shadow">
        <h1 className="text-2xl font-bold">Philippines Shelter Severity Toolset <span className="text-accent">(sandbox)</span></h1>
        <nav className="text-sm mt-1">Home</nav>
      </header>

      <section className="bg-white rounded-2xl shadow p-4">
        <h2 className="text-lg font-semibold text-primary">Core Datasets</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-2">
          <li>Population (ADM1–ADM4)</li>
          <li>Evacuation Centers</li>
          <li>Building Typology</li>
        </ul>
        <Link href="/datasets" className="bg-accent text-white text-sm px-4 py-2 rounded hover:bg-yellow-600 inline-block">Manage Datasets</Link>
      </section>

      <section className="bg-white rounded-2xl shadow p-4">
        <h2 className="text-lg font-semibold text-primary">Baseline Instance</h2>
        <p className="text-sm text-gray-700 mb-2">Composed of selected core datasets used to compute the SSC index.</p>
        <Link href="/instances" className="bg-accent text-white text-sm px-4 py-2 rounded hover:bg-yellow-600 inline-block">View Instances</Link>
      </section>

      <section className="bg-white rounded-2xl shadow p-4">
        <h2 className="text-lg font-semibold text-primary">Map Viewer</h2>
        <p className="text-sm text-gray-700">Will support ADM-level toggles and scored dataset overlays.</p>
      </section>
    </main>
  );
}