import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data, error } = await supabase.rpc("derive_dataset", body);
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("RPC error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
