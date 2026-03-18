"use client";

import { useCallback, useEffect, useState } from "react";

export interface LoraModel {
  id: string;
  name: string;
  description?: string | null;
  file_count: number;
  final_loss?: number;
  dataset_chunks?: number;
  created_at: string;
  completed_at: string;
  available: boolean;
}

export interface LoraSelection {
  id: string;
  name: string;
}

interface LoraSelectorProps {
  value: LoraSelection | null;
  onChange: (selection: LoraSelection | null) => void;
}

export function LoraSelector({ value, onChange }: LoraSelectorProps) {
  const [models, setModels] = useState<LoraModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch("/api/training/models");
        if (res.ok) {
          const data = await res.json();
          setModels(data.models || []);
        }
      } catch {
        // Models endpoint may not be available
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, []);

  const handleSelect = useCallback(
    (model: LoraModel | null) => {
      onChange(model ? { id: model.id, name: model.name } : null);
      setExpanded(false);
    },
    [onChange]
  );

  const selectedModel = models.find((m) => m.id === value?.id);

  // Don't render if no models available
  if (!loading && models.length === 0) return null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-black border border-white/[0.06] p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-400">Sound World</p>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-600">
        Generate with your trained LoRA style models.
      </p>

      {loading ? (
        <div className="mt-3 text-xs text-gray-600">Loading models...</div>
      ) : (
        <div className="mt-3 relative">
          {/* Selected / Trigger */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-full flex items-center justify-between px-4 py-2.5 border text-sm text-left transition-colors ${
              value
                ? "border-white/[0.12] text-white"
                : "border-white/[0.06] text-gray-500 hover:border-white/[0.12]"
            }`}
          >
            <span className="truncate">
              {selectedModel
                ? `${selectedModel.name} (${selectedModel.file_count} files)`
                : "None — base model"}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              className={`ml-2 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Dropdown */}
          {expanded && (
            <div className="absolute top-full left-0 right-0 mt-1 border border-white/[0.06] bg-black z-10 max-h-60 overflow-y-auto">
              {/* None option */}
              <button
                onClick={() => handleSelect(null)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  !value
                    ? "bg-white/[0.04] text-white"
                    : "text-gray-500 hover:bg-white/[0.02] hover:text-gray-300"
                }`}
              >
                None — base model
              </button>

              {/* Models */}
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  disabled={!model.available}
                  className={`w-full text-left px-4 py-2.5 border-t border-white/[0.04] transition-colors ${
                    value?.id === model.id
                      ? "bg-white/[0.04] text-white"
                      : model.available
                      ? "text-gray-400 hover:bg-white/[0.02] hover:text-gray-200"
                      : "text-gray-700 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{model.name}</span>
                    <span className="text-xs text-gray-600 shrink-0 ml-2">
                      {formatDate(model.completed_at)}
                    </span>
                  </div>
                  {model.description && (
                    <p className="text-xs text-gray-600 mt-0.5 truncate">
                      {model.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-600">
                      {model.file_count} files
                    </span>
                    {model.final_loss !== undefined && (
                      <span className="text-xs text-gray-600">
                        loss: {model.final_loss.toFixed(4)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active indicator */}
      {value && selectedModel && (
        <div className="mt-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-500">
            {selectedModel.description || "Generation will use your trained style"}
          </span>
        </div>
      )}
    </div>
  );
}
