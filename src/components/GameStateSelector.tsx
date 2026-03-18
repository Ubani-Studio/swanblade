"use client";

import { type GameState, GAME_STATE_CONFIGS } from "@/lib/gameStateEngine";

interface GameStateSelectorProps {
  value: GameState | null;
  onChange: (state: GameState | null) => void;
  showDetails?: boolean;
}

const GAME_STATE_CATEGORIES = {
  Core: ["menu", "exploration", "ambient"] as GameState[],
  Action: ["combat", "boss", "chase", "stealth"] as GameState[],
  Narrative: ["cutscene", "victory", "defeat", "credits"] as GameState[],
  Special: ["tension"] as GameState[],
};

export function GameStateSelector({
  value,
  onChange,
  showDetails = true,
}: GameStateSelectorProps) {
  const selectedConfig = value ? GAME_STATE_CONFIGS[value] : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-gray-500">Game State</p>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="text-body-sm text-gray-500 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* State Grid by Category */}
      <div className="mt-3 space-y-3">
        {Object.entries(GAME_STATE_CATEGORIES).map(([category, states]) => (
          <div key={category}>
            <p className="text-body-sm text-gray-500/60">{category}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {states.map((state) => (
                <button
                  key={state}
                  onClick={() => onChange(value === state ? null : state)}
                  className={`px-3 py-1.5 text-xs transition ${
                    value === state
                      ? "border border-white bg-white text-black"
                      : "border border-[#1a1a1a] text-gray-400 hover:border-[#333] hover:text-white"
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected State Details */}
      {showDetails && selectedConfig && value && (
        <div className="mt-4 border border-[#1a1a1a] bg-black p-3">
          <div>
            <p className="text-body-lg font-medium capitalize text-white">{value}</p>
            <p className="text-body-sm text-gray-500">{selectedConfig.description}</p>
          </div>

          {/* Modifiers */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-body-sm">
            <ModifierBadge
              label="Energy"
              value={selectedConfig.modifiers.energyOffset}
              suffix="%"
            />
            <ModifierBadge
              label="Texture"
              value={selectedConfig.modifiers.textureOffset}
              suffix="%"
            />
            <ModifierBadge
              label="BPM"
              value={selectedConfig.modifiers.bpmOffset}
              suffix=""
            />
            <ModifierBadge
              label="Brightness"
              value={selectedConfig.modifiers.brightnessOffset}
              suffix="%"
            />
          </div>

          {/* Keywords */}
          <div className="mt-3 flex flex-wrap gap-1">
            {selectedConfig.promptKeywords.map((keyword) => (
              <span
                key={keyword}
                className="bg-[#1a1a1a] px-2 py-0.5 text-body-sm text-white"
              >
                {keyword}
              </span>
            ))}
          </div>

          {/* Default Stems */}
          <div className="mt-3">
            <p className="text-body-sm text-gray-500">
              Default Stems
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(selectedConfig.stemDefaults)
                .filter(([_, volume]) => volume > 0.1)
                .map(([stem, volume]) => (
                  <span
                    key={stem}
                    className="bg-white px-2 py-0.5 text-body-sm text-black"
                  >
                    {stem} ({Math.round(volume * 100)}%)
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ModifierBadgeProps {
  label: string;
  value: number;
  suffix: string;
}

function ModifierBadge({ label, value, suffix }: ModifierBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <div className="flex items-center justify-between bg-black px-2 py-1 border border-[#1a1a1a]">
      <span className="text-gray-500">{label}</span>
      <span
        className={
          isPositive
            ? "text-white font-medium"
            : isNegative
            ? "text-red-400"
            : "text-gray-500"
        }
      >
        {isPositive ? "+" : ""}
        {value}
        {suffix}
      </span>
    </div>
  );
}

/**
 * Compact version for inline use
 */
export function GameStateBadge({
  state,
  onClick,
}: {
  state: GameState;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white px-2 py-0.5 text-body-sm text-black hover:bg-[#66023C]"
    >
      {state}
    </button>
  );
}
