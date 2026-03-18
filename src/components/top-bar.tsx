interface TopBarProps {
  activeProvider: string;
}

export function TopBar({ activeProvider }: TopBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-[#1a1a1a] bg-black px-6 py-4">
      <div>
        <p className="text-overline uppercase tracking-widest text-gray-500">Swanblade</p>
        <p className="text-body-lg font-medium text-white">Sound Design Lab</p>
        <p className="text-body-sm font-light text-gray-500">Prompt-driven audio generation with game-state awareness.</p>
      </div>
      <div className="text-right">
        <p className="text-caption uppercase tracking-wider text-gray-500">Provider</p>
        <p className="text-body font-medium text-white">{activeProvider}</p>
      </div>
    </div>
  );
}
