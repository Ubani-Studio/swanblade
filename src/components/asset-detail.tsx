"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ManifestRow {
  id: string;
  sound_id: string | null;
  origin8_fingerprint: string;
  watermark_status: "sidecar" | "embedded" | "pending";
  manifest: unknown;
  pipeline_steps: Array<{
    stage: string;
    adapter: string;
    status: string;
    parameters?: Record<string, unknown>;
    elapsed_ms?: number;
  }>;
  private_canon: boolean;
  ai_training_opt_in: boolean;
  revoked_at: string | null;
  created_at: string;
}

export function AssetDetail({
  manifestId,
  onClose,
  className,
}: {
  manifestId: string;
  onClose: () => void;
  className?: string;
}) {
  const [row, setRow] = useState<ManifestRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sovereignty/manifests?include_revoked=true&limit=100")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const found = (d.manifests as ManifestRow[])?.find((m) => m.id === manifestId) ?? null;
        setRow(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [manifestId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        className={cn("bg-black border border-white/[0.08] max-w-2xl w-full max-h-[80vh] overflow-y-auto", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <p className="text-sm text-white">Asset detail</p>
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-white">Close</button>
        </div>
        <div className="p-5 space-y-5">
          {loading && <p className="text-xs text-gray-500">Loading manifest...</p>}
          {!loading && !row && <p className="text-xs text-gray-500">Manifest not found or revoked.</p>}
          {row && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] tracking-wide text-gray-500 uppercase">Provenance</p>
                <div className="text-[11px] text-gray-300 space-y-1 font-mono">
                  <div><span className="text-gray-600">manifest:</span> {row.id}</div>
                  <div><span className="text-gray-600">08 fp:</span> {row.origin8_fingerprint}</div>
                  <div><span className="text-gray-600">watermark:</span> {row.watermark_status}</div>
                  <div><span className="text-gray-600">private canon:</span> {row.private_canon ? "yes" : "no"}</div>
                  <div><span className="text-gray-600">ai training opt-in:</span> {row.ai_training_opt_in ? "yes" : "no"}</div>
                  <div><span className="text-gray-600">stamped:</span> {new Date(row.created_at).toLocaleString()}</div>
                  {row.revoked_at && (
                    <div className="text-red-400">revoked: {new Date(row.revoked_at).toLocaleString()}</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] tracking-wide text-gray-500 uppercase">Pipeline steps</p>
                {row.pipeline_steps.length === 0 && <p className="text-[11px] text-gray-600">None recorded.</p>}
                {row.pipeline_steps.map((s, i) => (
                  <div key={i} className="border border-white/[0.04] p-2.5 text-[11px] text-gray-400">
                    <div className="flex items-center justify-between">
                      <span className="text-white">{i + 1}. {s.stage}</span>
                      <span className={cn(
                        "text-[9px] uppercase tracking-wide",
                        s.status === "completed" ? "text-green-400" : "text-yellow-400",
                      )}>{s.status}</span>
                    </div>
                    <div className="text-gray-600 font-mono text-[10px]">{s.adapter}</div>
                    {s.parameters && Object.keys(s.parameters).length > 0 && (
                      <pre className="mt-1 text-[10px] text-gray-500 whitespace-pre-wrap">
                        {JSON.stringify(s.parameters, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] tracking-wide text-gray-500 uppercase">C2PA manifest</p>
                <pre className="text-[10px] text-gray-500 bg-white/[0.02] p-3 overflow-x-auto max-h-64">
                  {JSON.stringify(row.manifest, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
