import { createClient } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import Link from "next/link";

export default async function DatasetsPage() {
  const supabase = createClient();

  // Fetch all datasets
  const { data: datasets, error } = await supabase
    .from("datasets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch error:", error);
  }

  const list = datasets || [];

  // Auto-categorize and group
  const coreDatasets = list.filter(
    (d: any) =>
      ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4"].includes(
        (d.admin_level || "").toUpperCase()
      ) ||
      /(population|hazard|vulnerability)/i.test(d.name || "")
  );

  const otherDatasets = list.filter((d: any) => !coreDatasets.includes(d));

  function renderTable(datasets: any[]) {
    return (
      <div className="overflow-x-auto bg-white rounded-lg shadow mb-10">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Admin Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {datasets.map((dataset: any) => (
              <tr key={dataset.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-800">
                  {dataset.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {dataset.type || "—"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {dataset.admin_level?.toUpperCase() || "N/A"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {dataset.category ||
                    (coreDatasets.includes(dataset)
                      ? "Core"
                      : "Uncategorized")}
                </td>
                <td className="px-6 py-4 text-right text-sm space-x-3">
                  <button
                    onClick={() =>
                      alert(`Viewing details for ${dataset.name}`)
                    }
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </button>
                  <button
                    onClick={() =>
                      alert(`Editing dataset: ${dataset.name}`)
                    }
                    className="text-yellow-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      alert(`Deleted dataset: ${dataset.name}`)
                    }
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Datasets</h1>
            <p className="text-gray-600 text-sm">
              Manage, view, and derive baseline data
            </p>
          </div>

          <Link
            href="/datasets/upload"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
          >
            + Upload Dataset
          </Link>
        </div>

        {coreDatasets.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Core Datasets
            </h2>
            {renderTable(coreDatasets)}
          </>
        )}

        {otherDatasets.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Other Datasets
            </h2>
            {renderTable(otherDatasets)}
          </>
        )}

        {coreDatasets.length === 0 && otherDatasets.length === 0 && (
          <p className="text-gray-500">No datasets found.</p>
        )}
      </main>
    </div>
  );
}
