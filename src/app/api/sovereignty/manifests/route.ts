import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 50));
  const includeRevoked = searchParams.get("include_revoked") === "true";

  let query = supabase
    .from("provenance_manifests")
    .select(
      "id, sound_id, origin8_fingerprint, watermark_status, manifest, pipeline_steps, private_canon, ai_training_opt_in, revoked_at, revoke_reason, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeRevoked) {
    query = query.is("revoked_at", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ manifests: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body?.manifest_id || body?.action !== "revoke") {
    return NextResponse.json({ error: "manifest_id and action=revoke required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("provenance_manifests")
    .update({
      revoked_at: new Date().toISOString(),
      revoke_reason: String(body.reason ?? "user_revoked").slice(0, 500),
    })
    .eq("id", body.manifest_id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
