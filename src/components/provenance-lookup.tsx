"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { O8Provenance } from "@/lib/o8/types";

interface ProvenanceLookupProps {
  className?: string;
  onResult?: (provenance: O8Provenance | null) => void;
}

export function ProvenanceLookup({ className, onResult }: ProvenanceLookupProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<O8Provenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleLookup = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const { getO8Client } = await import("@/lib/o8/client");
      const client = getO8Client();
      const provenance = await client.verifyProvenance(query.trim());

      setResult(provenance);
      onResult?.(provenance);

      if (!provenance) {
        setError("No provenance record found for this fingerprint or CID.");
      }
    } catch (err) {
      console.error("Provenance lookup failed:", err);
      setError("Failed to verify provenance. Check your connection to Starforge.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResult(null);
    setError(null);
    setSearched(false);
    onResult?.(null);
  };

  return (
    <div className={cn("border border-[#1a1a1a] bg-black", className)}>
      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <p className="text-sm font-medium text-gray-400">
          Verify Provenance
        </p>
      </div>

      <div className="p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="Enter CID or audio fingerprint..."
            className="flex-1 px-3 py-2 border border-[#1a1a1a] bg-black text-body text-white placeholder:text-gray-500 focus:outline-none focus:border-white"
            disabled={loading}
          />
          <Button
            onClick={handleLookup}
            disabled={loading || !query.trim()}
            className="bg-[#66023C] hover:bg-[#520230] text-white border-0"
          >
            {loading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="40 20" fill="none" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </Button>
        </div>

        {/* Result Display */}
        {searched && (
          <div className="mt-4">
            {error ? (
              <div className="flex items-start gap-3 p-3 bg-red-400/5 border border-red-400/20">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-red-400 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 7v6M12 16v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div>
                  <p className="text-body-sm text-red-400 font-medium">Not Verified</p>
                  <p className="text-body-sm text-gray-500 mt-1">{error}</p>
                </div>
              </div>
            ) : result ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#66023C]">
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-body font-medium">∞8 Verified</span>
                </div>

                <div className="border border-[#1a1a1a] divide-y divide-[#1a1a1a]">
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-body-sm text-gray-500">Identity</span>
                    <span className="text-body-sm text-white font-mono">
                      {result.identity_id.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-body-sm text-gray-500">Fingerprint</span>
                    <span className="text-body-sm text-white font-mono">
                      {result.fingerprint.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-body-sm text-gray-500">Timestamp</span>
                    <span className="text-body-sm text-white">
                      {new Date(result.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {result.generation_context && (
                    <>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-body-sm text-gray-500">Provider</span>
                        <span className="text-body-sm text-white">
                          {result.generation_context.provider}
                        </span>
                      </div>
                      <div className="px-3 py-2">
                        <span className="text-body-sm text-gray-500 block mb-1">Prompt</span>
                        <p className="text-body-sm text-white">
                          {result.generation_context.prompt}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={handleClear}
                  className="text-body-sm text-gray-500 hover:text-white"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
