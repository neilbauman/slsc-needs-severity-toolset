import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  const supabase = createClient();
  const { source_id, scalar, new_name, new_category, target_admin_level } = await req.json();

  const { data, error } = await supabase.rpc("derive_dataset", {
    source_id,
    scalar,
    new_name,
    new_category,
    target_admin_level,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data });
}
