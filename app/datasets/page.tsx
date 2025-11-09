import Header from "@/components/Header";
import { createClient } from "@/lib/supabaseClient";
import DatasetTable from "@/components/DatasetTable";

export default async function DatasetsPage() {
  const supabase = createClient();

  const { data: datasets, error } = await supabase
    .from("datasets")
    .select("*")
    .order("category", { ascending: true })
    .order("admin_level", { ascending: true });

  if (error) {
    console.error("❌ Supabase error:", error);
  }

  return (
    <div>
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <DatasetTable datasets={datasets || []} />
      </main>
    </div>
  );
}
