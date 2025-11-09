import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";

export default async function DatasetViewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // Fetch the dataset by ID
  const { data, error } = await supabase
    .from("datasets")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    console.error("Dataset not found:", error);
    notFound();
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold mb-2">{data.name}</h1>
      <p className="text-gray-600 mb-6">{data.description || "No description provided."}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 border rounded-lg shadow-sm bg-white">
          <h2 className="text-lg font-medium mb-3">Dataset Info</h2>
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold text-gray-700">Category</dt>
              <dd className="text-gray-600">{data.category || "Uncategorized"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-700">Admin Level</dt>
              <dd className="text-gray-600">{data.admin_level || "N/A"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-700">Created</dt>
              <dd className="text-gray-600">
                {new Date(data.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="p-4 border rounded-lg shadow-sm bg-white">
          <h2 className="text-lg font-medium mb-3">Source</h2>
          <p className="text-gray-600">
            {data.source ? (
              <a
                href={data.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {data.source}
              </a>
            ) : (
              "No source link available."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
