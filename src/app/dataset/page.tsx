"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SwanbladeLogo } from "@/components/SwanbladeLogo";
import { DATASET_LAYERS, LAYER_META, type DatasetLayer } from "@/lib/dataset/layers";

interface Entry {
  id: string;
  layer: DatasetLayer;
  kind: string | null;
  title: string;
  content_text: string | null;
  audio_url: string | null;
  data: Record<string, unknown>;
  ai_training_opt_in: boolean;
  created_at: string;
}

interface CanonJob {
  id: string;
  status: string;
  model_name: string | null;
  file_count: number;
  created_at: string;
  completed_at: string | null;
  lora_model_url: string | null;
  error_message: string | null;
}

const TRAINABLE_LAYERS: DatasetLayer[] = ["vocal_canon", "live_captures", "paired_controls"];

export default function DatasetPage() {
  const [active, setActive] = useState<DatasetLayer>("vocal_canon");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [canonJobs, setCanonJobs] = useState<CanonJob[]>([]);
  const [trainable, setTrainable] = useState(0);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const meta = LAYER_META[active];

  const load = useCallback(async (layer: DatasetLayer) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/dataset/entries?layer=${layer}`);
      const d = await r.json();
      setEntries(d.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrainable = useCallback(async () => {
    const requests = TRAINABLE_LAYERS.map((layer) =>
      fetch(`/api/dataset/entries?layer=${layer}`).then((r) => r.json()),
    );
    const results = await Promise.all(requests);
    let count = 0;
    for (const r of results) {
      for (const e of (r.entries ?? []) as Entry[]) {
        if (e.audio_url && !e.audio_url.startsWith("data:") && e.ai_training_opt_in) count++;
      }
    }
    setTrainable(count);
  }, []);

  const loadCanonJobs = useCallback(async () => {
    const r = await fetch("/api/dataset/train-canon");
    if (!r.ok) return;
    const d = await r.json();
    setCanonJobs(d.jobs ?? []);
  }, []);

  useEffect(() => {
    load(active);
  }, [active, load]);

  useEffect(() => {
    loadTrainable();
    loadCanonJobs();
  }, [loadTrainable, loadCanonJobs]);

  const startCanonTraining = async () => {
    setTraining(true);
    setTrainError(null);
    try {
      const r = await fetch("/api/dataset/train-canon", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Training kickoff failed");
      loadCanonJobs();
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : "Training kickoff failed");
    } finally {
      setTraining(false);
    }
  };

  const counts = useMemo(() => {
    const m: Record<DatasetLayer, number> = {
      vocal_canon: 0,
      paired_controls: 0,
      preference_rankings: 0,
      automatic_writing: 0,
      influence_corpus: 0,
      live_captures: 0,
      contextual_notes: 0,
    };
    return m;
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 font-display text-sm tracking-wide">
            <SwanbladeLogo size={32} />
            Swanblade
          </Link>
          <nav className="flex items-center gap-6 text-[11px] text-gray-500">
            <Link href="/studio" className="hover:text-white">Studio</Link>
            <Link href="/sovereignty" className="hover:text-white">Sovereignty</Link>
            <span className="text-white">Dataset</span>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-2 mb-10">
          <h1 className="font-display text-4xl">Private dataset</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            Seven layers make up the moat. Feed each one with the kind of material it was built for.
            Anything you add here can be opted into LoRA training and the taste reranker — or kept sovereign.
          </p>
        </div>

        {/* Canon training */}
        <section className="bg-black border border-white/[0.06] p-5 mb-10 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-white">Train ACE-Step on your canon</p>
              <p className="text-[11px] text-gray-500 max-w-xl">
                Fine-tunes ACE-Step 1.5 on opted-in audio from vocal canon, live captures,
                and paired controls. {trainable} audio entries eligible.
              </p>
              <p className="text-[10px] text-gray-600">
                Experimental training scaffold. Runs on Modal (A10G), ~1-3 hours per canon.
              </p>
            </div>
            <button
              onClick={startCanonTraining}
              disabled={training || trainable < 3}
              className="px-3 py-1.5 text-[10px] border border-white/20 hover:bg-white hover:text-black transition disabled:opacity-40 whitespace-nowrap"
            >
              {training ? "Starting..." : "Train canon"}
            </button>
          </div>
          {trainError && <p className="text-[11px] text-red-400">{trainError}</p>}

          {canonJobs.length > 0 && (
            <div className="pt-3 border-t border-white/[0.04] space-y-1.5">
              <p className="text-[10px] tracking-wide text-gray-500 uppercase">Canon jobs</p>
              {canonJobs.slice(0, 5).map((j) => (
                <div key={j.id} className="flex items-center justify-between text-[11px]">
                  <div className="min-w-0 flex-1">
                    <span className="text-white">{j.model_name ?? j.id.slice(0, 8)}</span>
                    <span className="text-gray-600 ml-2 font-mono text-[10px]">{j.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span>{j.file_count} src</span>
                    <span className={
                      j.status === "completed" ? "text-green-400" :
                      j.status === "failed" ? "text-red-400" : "text-yellow-400"
                    }>
                      {j.status}
                    </span>
                    <span>{new Date(j.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Layer tabs */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {DATASET_LAYERS.map((layer) => {
            const m = LAYER_META[layer];
            const isActive = layer === active;
            return (
              <button
                key={layer}
                onClick={() => setActive(layer)}
                className={`px-3 py-1.5 text-[10px] border transition ${
                  isActive
                    ? "border-white/30 text-white bg-white/[0.04]"
                    : "border-white/[0.06] text-gray-500 hover:text-gray-300"
                }`}
              >
                {m.title}
                {counts[layer] > 0 && <span className="ml-1.5 text-gray-600">{counts[layer]}</span>}
              </button>
            );
          })}
        </div>

        <section className="bg-black border border-white/[0.06] p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white">{meta.title}</p>
              <p className="text-[11px] text-gray-500 mt-1 max-w-xl">{meta.purpose}</p>
            </div>
            <div className="flex items-center gap-2">
              {meta.accepts.includes("audio") && (
                <button
                  onClick={() => setShowImport(true)}
                  className="px-3 py-1.5 text-[10px] border border-white/[0.06] text-gray-400 hover:text-white hover:border-white/20 transition"
                >
                  Import from library
                </button>
              )}
              <button
                onClick={() => setShowAdd(true)}
                className="px-3 py-1.5 text-[10px] border border-white/20 hover:bg-white hover:text-black transition"
              >
                + Add
              </button>
            </div>
          </div>
        </section>

        {loading && <p className="text-xs text-gray-500">Loading...</p>}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-gray-600">No entries yet. This layer is blank ground.</p>
        )}

        <div className="space-y-1">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} onArchive={() => load(active)} />
          ))}
        </div>
      </main>

      {showAdd && (
        <AddEntryModal
          layer={active}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load(active);
            loadTrainable();
          }}
        />
      )}
      {showImport && (
        <LibraryImporter
          layer={active}
          onClose={() => setShowImport(false)}
          onDone={() => {
            load(active);
            loadTrainable();
          }}
        />
      )}
    </div>
  );
}

function EntryRow({ entry, onArchive }: { entry: Entry; onArchive: () => void }) {
  const archive = async () => {
    if (!confirm("Archive this entry?")) return;
    await fetch(`/api/dataset/entries?id=${entry.id}`, { method: "DELETE" });
    onArchive();
  };
  return (
    <div className="border border-white/[0.04] px-4 py-3 flex items-start justify-between gap-4 hover:border-white/[0.12] transition">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm text-white truncate">{entry.title}</p>
          {entry.kind && <span className="text-[9px] text-gray-600 uppercase tracking-wide">{entry.kind}</span>}
          {!entry.ai_training_opt_in && (
            <span className="text-[9px] tracking-wide uppercase text-[#66023C] border border-[#66023C]/40 px-1.5 py-0.5">
              Not for training
            </span>
          )}
        </div>
        {entry.content_text && (
          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{entry.content_text}</p>
        )}
        {entry.audio_url && (
          <audio controls src={entry.audio_url} className="mt-2 h-7" />
        )}
        <p className="text-[10px] text-gray-600 mt-1">{new Date(entry.created_at).toLocaleDateString()}</p>
      </div>
      <button
        onClick={archive}
        className="text-[10px] text-gray-600 hover:text-red-400"
      >
        Archive
      </button>
    </div>
  );
}

function AddEntryModal({
  layer,
  onClose,
  onSaved,
}: {
  layer: DatasetLayer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const meta = LAYER_META[layer];
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("");
  const [content, setContent] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [optIn, setOptIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAudio = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/dataset/audio/upload", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Upload failed");
      setAudioUrl(d.audio_url);
      setAudioFileName(file.name);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/dataset/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layer,
          title,
          kind: kind || undefined,
          content_text: content || undefined,
          audio_url: audioUrl || undefined,
          ai_training_opt_in: optIn,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Save failed");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <form
        className="bg-black border border-white/[0.08] max-w-xl w-full"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <p className="text-sm text-white">Add to {meta.title}</p>
          <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-white">Close</button>
        </div>
        <div className="p-5 space-y-4">
          <Input label="Title" value={title} onChange={setTitle} required placeholder={meta.placeholder.split(".")[0]} />
          <Input label="Kind (optional)" value={kind} onChange={setKind} placeholder="e.g. lead, harmony, brighter" />
          {meta.accepts.includes("text") && (
            <Textarea label="Notes" value={content} onChange={setContent} placeholder={meta.placeholder} />
          )}
          {meta.accepts.includes("audio") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-wide text-gray-500 uppercase">Audio file</span>
                {audioUrl && (
                  <button
                    type="button"
                    onClick={() => { setAudioUrl(""); setAudioFileName(""); }}
                    className="text-[10px] text-gray-600 hover:text-white"
                  >
                    Remove
                  </button>
                )}
              </div>
              {audioUrl ? (
                <div className="border border-white/[0.04] p-3 space-y-2">
                  <p className="text-[11px] text-white truncate">{audioFileName || "Uploaded"}</p>
                  <audio controls src={audioUrl} className="w-full h-8" />
                </div>
              ) : (
                <label className="block border border-dashed border-white/[0.12] hover:border-white/[0.24] p-4 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aiff,.aif"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAudio(f);
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                  <p className="text-[11px] text-gray-400">
                    {uploading ? "Uploading..." : "Drop or click to upload audio"}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">wav, mp3, flac, ogg, m4a — stays on your machine</p>
                </label>
              )}
            </div>
          )}
          <label className="flex items-center justify-between text-[11px] text-gray-400 border border-white/[0.04] px-3 py-2">
            <span>Include in AI training (LoRA + reranker)</span>
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          </label>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
        <div className="p-5 border-t border-white/[0.06] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[10px] border border-white/[0.06] text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading || !title}
            className="px-3 py-1.5 text-[10px] border border-white/20 hover:bg-white hover:text-black transition disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface LibrarySoundItem {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  lengthSeconds: number;
  type: string;
  hasAudio: boolean;
}

function LibraryImporter({
  layer,
  onClose,
  onDone,
}: {
  layer: DatasetLayer;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sounds, setSounds] = useState<LibrarySoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dataset/library-import")
      .then((r) => r.json())
      .then((d) => setSounds(d.sounds ?? []))
      .finally(() => setLoading(false));
  }, []);

  const importSound = async (sound: LibrarySoundItem) => {
    setBusy(sound.id);
    setError(null);
    try {
      const r = await fetch("/api/dataset/library-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sound_id: sound.id, layer }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Import failed");
      setImported((prev) => new Set(prev).add(sound.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  const withAudio = sounds.filter((s) => s.hasAudio);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-black border border-white/[0.08] max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <p className="text-sm text-white">Import from library</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Into {LAYER_META[layer].title}</p>
          </div>
          <button onClick={() => { onDone(); onClose(); }} className="text-xs text-gray-500 hover:text-white">Done</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {loading && <p className="text-xs text-gray-500">Loading library...</p>}
          {!loading && withAudio.length === 0 && (
            <p className="text-xs text-gray-600">No library sounds with audio yet. Generate something in Studio first.</p>
          )}
          {error && <p className="text-[11px] text-red-400 mb-3">{error}</p>}
          <div className="space-y-1">
            {withAudio.map((s) => {
              const done = imported.has(s.id);
              const working = busy === s.id;
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 border border-white/[0.04] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{s.prompt}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600">{s.lengthSeconds.toFixed(0)}s</span>
                    <button
                      disabled={done || working}
                      onClick={() => importSound(s)}
                      className={`px-2.5 py-1 text-[10px] border transition ${
                        done
                          ? "border-green-400/30 text-green-400/80"
                          : "border-white/[0.06] text-gray-400 hover:text-white hover:border-white/20"
                      } disabled:opacity-50`}
                    >
                      {done ? "Imported" : working ? "..." : "Import"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] tracking-wide text-gray-500 uppercase">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-[#0a0a0a] border border-white/[0.06] px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] tracking-wide text-gray-500 uppercase">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        className="w-full bg-[#0a0a0a] border border-white/[0.06] px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20 resize-y"
      />
    </label>
  );
}
