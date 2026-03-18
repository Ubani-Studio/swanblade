"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  suggestions: string[];
  isGenerating: boolean;
}

export function PromptComposer({ value, onChange, onSubmit, suggestions, isGenerating }: PromptComposerProps) {
  return (
    <div className="border border-[#1a1a1a] bg-black p-6">
      <p className="text-sm font-medium text-gray-400">Prompt Composer</p>
      <Textarea
        rows={3}
        value={value}
        placeholder="Describe the sound you want to create..."
        onChange={(event) => onChange(event.target.value)}
        className="mt-3"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onChange(suggestion)}
            className="border border-[#1a1a1a] px-4 py-2 text-sm text-gray-500 transition hover:border-white hover:text-white"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={onSubmit} loading={isGenerating}>
          {isGenerating ? "Generating..." : "Generate Sound"}
        </Button>
      </div>
    </div>
  );
}
