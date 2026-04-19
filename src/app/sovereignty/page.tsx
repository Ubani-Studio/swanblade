"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AssetDetail } from "@/components/asset-detail";
import { SwanbladeLogo } from "@/components/SwanbladeLogo";

interface Settings {
  private_canon: boolean;
  ai_training_opt_in: boolean;
}

interface ManifestRow {
  id: string;
  sound_id: string | null;
  origin8_fingerprint: string;
  watermark_status: "sidecar" | "embedded" | "pending";
  private_canon: boolean;
  ai_training_opt_in: boolean;
  revoked_at: string | null;
  created_at: string;
  pipeline_steps: Array<{ stage: string; status: string }>;
}

export default function SovereigntyPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [manifests, setManifests] = useState<ManifestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, m] = await Promise.all([
        fetch("/api/sovereignty/settings").then((r) => r.json()),
        fetch("/api/sovereignty/manifests?include_revoked=true&limit=100").then((r) => r.json()),
      ]);
      if (s?.error) throw new Error(s.error);
      setSettings(s);
      setManifests(m.manifests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (patch: Partial<Settings>) => {
    const r = await fetch("/api/sovereignty/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) setSettings((prev) => ({ ...(prev ?? { private_canon: false, ai_training_opt_in: false }), ...patch }));
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this manifest? The asset will be marked non-authoritative.")) return;
    await fetch("/api/sovereignty/manifests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest_id: id, action: "revoke" }),
    });
    load();
  };

  const active = manifests.filter((m) => !m.revoked_at);
  const revoked = manifests.filter((m) => m.revoked_at);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 font-display text-sm tracking-wide">
            <SwanbladeLogo size={32} />
            Swanblade
          </Link>
          <nav className="flex items-center gap-6 text-[11px] text-gray-500">
            <Link href="/studio" className="hover:text-white">Studio</Link>
            <span className="text-white">Sovereignty</span>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-2 mb-10">
          <h1 className="font-display text-4xl">Data sovereignty</h1>
          <p className="text-sm text-gray-400 max-w-xl">
            Every generation is stamped with the 08 Protocol perceptual fingerprint and sealed in a signed C2PA manifest.
            Control how assets move and what your taste data may be used for.
          </p>
        </div>

        {loading && <p className="text-xs text-gray-500">Loading...</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {settings && (
          <section className="mb-12 space-y-4">
            <h2 className="text-[11px] tracking-wide text-gray-500 uppercase">Ethical lock</h2>
            <Toggle
              label="Private Canon (Ethical Lock)"
              description="Fail-closed enforcement. Every generation must carry a valid 08 Protocol + C2PA manifest or the server refuses to return the asset."
              checked={settings.private_canon}
              onChange={(v) => update({ private_canon: v })}
            />
            <Toggle
              label="Allow AI training on my canon"
              description="Opt your signed canon into Swanblade's aggregated preference model. Off by default."
              checked={settings.ai_training_opt_in}
              onChange={(v) => update({ ai_training_opt_in: v })}
            />
          </section>
        )}

        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] tracking-wide text-gray-500 uppercase">Signed manifests</h2>
            <span className="text-[10px] text-gray-600">{active.length} active · {revoked.length} revoked</span>
          </div>

          <div className="space-y-1">
            {active.length === 0 && <p className="text-xs text-gray-600">No manifests yet. Generate in the Studio.</p>}
            {active.map((m) => (
              <ManifestRow key={m.id} row={m} onInspect={() => setDetail(m.id)} onRevoke={() => revoke(m.id)} />
            ))}
          </div>

          {revoked.length > 0 && (
            <div className="mt-8 space-y-1">
              <p className="text-[10px] tracking-wide text-gray-600 uppercase">Revoked</p>
              {revoked.map((m) => (
                <ManifestRow key={m.id} row={m} onInspect={() => setDetail(m.id)} onRevoke={() => {}} />
              ))}
            </div>
          )}
        </section>
      </main>

      {detail && <AssetDetail manifestId={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="border border-white/[0.06] p-4 flex items-start justify-between gap-6">
      <div className="space-y-1">
        <p className="text-sm text-white">{label}</p>
        <p className="text-[11px] text-gray-500 max-w-md">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-10 h-5 border ${checked ? "bg-white border-white" : "bg-transparent border-white/30"} relative transition`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 ${checked ? "left-5 bg-black" : "left-0.5 bg-white/60"} w-4 h-4 transition-all`} />
      </button>
    </div>
  );
}

function ManifestRow({
  row,
  onInspect,
  onRevoke,
}: {
  row: ManifestRow;
  onInspect: () => void;
  onRevoke: () => void;
}) {
  const completed = row.pipeline_steps.filter((s) => s.status === "completed").length;
  const total = row.pipeline_steps.length;
  return (
    <div className="border border-white/[0.04] px-4 py-3 flex items-center justify-between gap-4 hover:border-white/[0.12] transition">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white font-mono truncate">{row.id.slice(0, 8)}</span>
          {row.private_canon && (
            <span className="text-[9px] uppercase tracking-wide text-[#66023C] border border-[#66023C]/40 px-1.5 py-0.5">Private Canon</span>
          )}
          {row.revoked_at && (
            <span className="text-[9px] uppercase tracking-wide text-red-400/80 border border-red-400/40 px-1.5 py-0.5">Revoked</span>
          )}
        </div>
        <p className="text-[10px] text-gray-500 mt-1 truncate">
          {row.origin8_fingerprint} · {completed}/{total} stages · {new Date(row.created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onInspect}
          className="px-2.5 py-1 border border-white/[0.06] text-[10px] text-gray-400 hover:text-white hover:border-white/20 transition"
        >
          Inspect
        </button>
        {!row.revoked_at && (
          <button
            onClick={onRevoke}
            className="px-2.5 py-1 border border-white/[0.06] text-[10px] text-gray-500 hover:text-red-400 hover:border-red-400/40 transition"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
