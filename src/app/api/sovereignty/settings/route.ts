import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("private_canon, ai_training_opt_in")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    private_canon: Boolean(data?.private_canon),
    ai_training_opt_in: Boolean(data?.ai_training_opt_in),
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, boolean> = {};
  if (typeof body.private_canon === "boolean") patch.private_canon = body.private_canon;
  if (typeof body.ai_training_opt_in === "boolean") patch.ai_training_opt_in = body.ai_training_opt_in;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...patch });
}
