import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { DATASET_LAYERS, type DatasetLayer } from "@/lib/dataset/layers";

export const runtime = "nodejs";

function isLayer(v: unknown): v is DatasetLayer {
  return typeof v === "string" && (DATASET_LAYERS as readonly string[]).includes(v);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const layer = searchParams.get("layer");
  const limit = Math.min(200, Number(searchParams.get("limit") ?? 100));

  let query = supabase
    .from("dataset_entries")
    .select("id, layer, kind, title, content_text, audio_url, image_url, data, ai_training_opt_in, archived, created_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (layer && isLayer(layer)) query = query.eq("layer", layer);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !isLayer(body.layer) || !body.title) {
    return NextResponse.json({ error: "layer and title required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("dataset_entries")
    .insert({
      user_id: user.id,
      layer: body.layer,
      kind: body.kind ?? null,
      title: String(body.title).slice(0, 200),
      content_text: body.content_text ? String(body.content_text).slice(0, 50_000) : null,
      audio_url: body.audio_url ?? null,
      image_url: body.image_url ?? null,
      data: body.data ?? {},
      ai_training_opt_in: body.ai_training_opt_in ?? true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("dataset_entries")
    .update({ archived: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
