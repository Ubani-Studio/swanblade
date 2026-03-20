import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { generation_id, engine, parameters, rating, comment } = body;

  if (!generation_id || ![-1, 1].includes(rating)) {
    return NextResponse.json(
      { error: "Missing generation_id or invalid rating." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("generation_feedback").insert({
    user_id: user.id,
    generation_id,
    engine: engine || "unknown",
    parameters: parameters || {},
    rating,
    comment: comment || null,
  });

  if (error) {
    console.error("[feedback] Insert failed:", error);
    return NextResponse.json(
      { error: "Failed to save feedback." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
