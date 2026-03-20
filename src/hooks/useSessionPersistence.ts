"use client";

import { useEffect, useRef, useCallback } from "react";
import type { RemixFile, RemixEngineId, StereoMode, VampnetMode, TransplantCodebooks } from "@/components/studio/remix-panel";

/* ── Settings shape (localStorage) ── */

export interface SessionSettings {
  prompt: string;
  lengthSeconds: number;
  remixEngine: RemixEngineId;
  remixStrength: number;
  // VampNet
  vampnetPeriodicPrompt: number;
  vampnetUpperCodebookMask: number;
  vampnetOnsetMaskWidth: number;
  vampnetTemperature: number;
  vampnetFeedbackSteps: number;
  vampnetStereoMode: StereoMode;
  // VampNet Advanced Modes
  vampnetMode: VampnetMode;
  inpaintStart: number;
  inpaintEnd: number;
  transplantCodebooks: TransplantCodebooks;
  // Post-processing
  dryWet: number;
  spectralMatch: boolean;
  normalizeLoudness: boolean;
  compressEnabled: boolean;
  hpssEnabled: boolean;
  demucsStems: string[];
  enhanceEnabled: boolean;
  // MAGNeT
  magnetTemperature: number;
  magnetTopK: number;
}

const SETTINGS_KEY = "swanblade-session-settings";
const DB_NAME = "swanblade-session";
const DB_VERSION = 1;
const STORE_NAME = "audio-files";

/* ── IndexedDB helpers (audio blobs) ── */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeAudioFile(key: string, file: File | null): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  if (!file) {
    store.delete(key);
  } else {
    const arrayBuffer = await file.arrayBuffer();
    store.put({ name: file.name, type: file.type, size: file.size, buffer: arrayBuffer }, key);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function loadAudioFile(key: string): Promise<RemixFile | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        db.close();
        const data = req.result;
        if (!data) { resolve(null); return; }
        const file = new File([data.buffer], data.name, { type: data.type });
        const previewUrl = URL.createObjectURL(file);
        resolve({ file, name: data.name, size: data.size, previewUrl });
      };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
}

/* ── Hook ── */

export function useSessionPersistence(
  getSettings: () => SessionSettings,
  applySettings: (s: SessionSettings) => void,
  applyRemixFile: (f: RemixFile | null) => void,
  applyReferenceFile: (f: RemixFile | null) => void,
) {
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore on mount (once)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Settings from localStorage
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SessionSettings>;
        const defaults = getSettings();
        applySettings({ ...defaults, ...saved });
      }
    } catch {
      // corrupt data — ignore
    }

    // Audio files from IndexedDB
    loadAudioFile("remix").then((f) => { if (f) applyRemixFile(f); });
    loadAudioFile("reference").then((f) => { if (f) applyReferenceFile(f); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save settings (debounced 500ms)
  const saveSettings = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(getSettings()));
      } catch {
        // quota exceeded — ignore
      }
    }, 500);
  }, [getSettings]);

  // Save audio file to IndexedDB
  const saveRemixFile = useCallback((file: RemixFile | null) => {
    storeAudioFile("remix", file?.file ?? null).catch(() => {});
  }, []);

  const saveReferenceFile = useCallback((file: RemixFile | null) => {
    storeAudioFile("reference", file?.file ?? null).catch(() => {});
  }, []);

  return { saveSettings, saveRemixFile, saveReferenceFile };
}
