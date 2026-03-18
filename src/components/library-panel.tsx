"use client";

import { useCallback, useEffect, useRef, useState, useId, useMemo } from "react";
import { LibrarySound } from "@/lib/libraryStorage";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, secondsToTimecode } from "@/lib/utils";
import { ProvenanceLookup } from "./provenance-lookup";

type SortBy = "date" | "name" | "liked" | "type" | "group";
type FilterBy = "all" | "liked" | "category" | "group";

// Waveform component that displays actual audio data with smooth curves
function AudioWaveform({
  progress,
  peaks,
  onSeek
}: {
  progress: number;
  peaks: number[];
  onSeek: (percent: number) => void;
}) {
  // Build smooth SVG path from peaks using bezier curves
  const waveformPath = useMemo(() => {
    if (peaks.length === 0) return '';

    // Helper to create smooth curve through points
    const smoothPath = (points: { x: number; y: number }[]) => {
      if (points.length < 2) return '';

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        // Catmull-Rom to Bezier conversion
        const tension = 0.3;
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;

        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }

      return path;
    };

    // Create top and bottom point arrays
    const topPoints = peaks.map((amp, i) => ({
      x: (i / (peaks.length - 1)) * 100,
      y: 50 - amp * 42
    }));

    const bottomPoints = [...peaks].reverse().map((amp, i) => ({
      x: 100 - (i / (peaks.length - 1)) * 100,
      y: 50 + amp * 42
    }));

    // Combine into closed path
    const topPath = smoothPath(topPoints);
    const bottomPath = smoothPath(bottomPoints).replace('M', 'L');

    return `${topPath} ${bottomPath} Z`;
  }, [peaks]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, percent)));
  };

  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Show loading state if no peaks yet
  if (peaks.length === 0) {
    return (
      <div className="h-12 w-full bg-transparent border border-white/[0.06] flex items-center justify-center">
        <span className="text-body-sm text-gray-500">Loading waveform...</span>
      </div>
    );
  }

  return (
    <div
      className="h-14 w-full bg-transparent border border-white/[0.06] cursor-pointer relative overflow-hidden"
      onClick={handleClick}
    >
      {/* Full waveform in light gray */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-white"
      >
        <path d={waveformPath} fill="currentColor" opacity="0.2" />
      </svg>

      {/* Played portion overlay - amber accent */}
      <div
        className="absolute inset-0 overflow-hidden transition-all"
        style={{ width: `${clampedProgress}%` }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full"
          style={{ width: `${100 / (clampedProgress / 100 || 1)}%` }}
        >
          <path d={waveformPath} fill="#66023C" />
        </svg>
      </div>

      {/* Playhead - accent color */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm"
        style={{ left: `${clampedProgress}%` }}
      />
    </div>
  );
}

// Extract waveform peaks from audio buffer
async function extractWaveformPeaks(audioUrl: string, numPeaks: number = 100): Promise<number[]> {
  try {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();

    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get the audio data from the first channel
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPeak = Math.floor(channelData.length / numPeaks);

    const peaks: number[] = [];
    for (let i = 0; i < numPeaks; i++) {
      const start = i * samplesPerPeak;
      const end = start + samplesPerPeak;

      // Find the max absolute value in this chunk
      let max = 0;
      for (let j = start; j < end && j < channelData.length; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }
      peaks.push(max);
    }

    // Normalize peaks to 0-1 range
    const maxPeak = Math.max(...peaks, 0.01);
    return peaks.map(p => p / maxPeak);
  } catch (error) {
    console.error('Failed to extract waveform:', error);
    return [];
  }
}

export function LibraryPanel() {
  const [sounds, setSounds] = useState<LibrarySound[]>([]);
  const [filteredSounds, setFilteredSounds] = useState<LibrarySound[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clear any browser autofill on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.value = "";
        setSearchQuery("");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadLibrary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/library");
      const data = await response.json();
      setSounds(data.sounds || []);
    } catch (error) {
      console.error("Failed to load library:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    let filtered = [...sounds];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (sound) =>
          sound.name.toLowerCase().includes(query) ||
          sound.prompt.toLowerCase().includes(query) ||
          sound.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (filterBy === "liked") {
      filtered = filtered.filter((sound) => sound.liked);
    } else if (filterBy === "group" && selectedGroup) {
      filtered = filtered.filter((sound) => sound.group === selectedGroup);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime();
        case "name":
          return a.name.localeCompare(b.name);
        case "liked":
          return (b.liked ? 1 : 0) - (a.liked ? 1 : 0);
        case "type":
          return a.type.localeCompare(b.type);
        case "group":
          return (a.group || "").localeCompare(b.group || "");
        default:
          return 0;
      }
    });

    setFilteredSounds(filtered);
  }, [sounds, searchQuery, sortBy, filterBy, selectedGroup]);

  const handleToggleLike = async (id: string, currentLiked: boolean) => {
    try {
      const response = await fetch(`/api/library?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: !currentLiked }),
      });

      if (response.ok) {
        setSounds((prev) => prev.map((s) => (s.id === id ? { ...s, liked: !currentLiked } : s)));
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;

    try {
      const response = await fetch(`/api/library?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (response.ok) {
        setSounds((prev) => prev.map((s) => (s.id === id ? { ...s, name: editName.trim() } : s)));
        setEditingId(null);
        setEditName("");
      }
    } catch (error) {
      console.error("Failed to rename:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sound from your library?")) return;

    try {
      const response = await fetch(`/api/library?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSounds((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleDownload = (id: string) => {
    window.open(`/api/library/download?id=${id}`, "_blank");
  };

  const startEditing = (sound: LibrarySound) => {
    setEditingId(sound.id);
    setEditName(sound.name);
  };

  const handlePlayPause = useCallback(async (sound: LibrarySound) => {
    // If this sound is already playing, pause it
    if (playingId === sound.id && isPlaying) {
      audioRef.current?.pause();
      return;
    }

    // If this sound is paused, resume it
    if (playingId === sound.id && !isPlaying) {
      audioRef.current?.play().catch(console.error);
      return;
    }

    // Different sound - load and play
    setPlayingId(sound.id);
    setCurrentTime(0);
    setDuration(0);
    setWaveformPeaks([]); // Clear old waveform

    const audioUrl = `/api/library/audio?id=${sound.id}`;

    // Load waveform data
    extractWaveformPeaks(audioUrl, 80).then(peaks => {
      setWaveformPeaks(peaks);
    });

    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(console.error);
    }
  }, [playingId, isPlaying]);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((percent: number) => {
    if (audioRef.current && duration > 0) {
      const newTime = (percent / 100) * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

  const handleAudioTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleAudioLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleAudioPlay = useCallback(() => setIsPlaying(true), []);
  const handleAudioPause = useCallback(() => setIsPlaying(false), []);

  const groups = Array.from(new Set(sounds.map((s) => s.group).filter(Boolean))) as string[];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-body text-gray-500">Loading library...</p>
      </div>
    );
  }

  if (sounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-body text-gray-500">Your library is empty</p>
        <p className="text-body-sm text-gray-500/60">Generate sounds and save them to build your collection</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        {/* Form to isolate autofill + hidden decoys */}
        <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <input type="text" name="fake-email" autoComplete="username" style={{ position: 'absolute', left: '-9999px' }} tabIndex={-1} aria-hidden="true" />
          <input type="password" name="fake-pass" autoComplete="current-password" style={{ position: 'absolute', left: '-9999px' }} tabIndex={-1} aria-hidden="true" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Search sounds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="q"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            aria-autocomplete="none"
          />
        </form>

        <div className="flex flex-wrap gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="border border-white/[0.06] bg-black px-3 py-1.5 text-body text-gray-500"
          >
            <option value="date">Newest First</option>
            <option value="name">Name A-Z</option>
            <option value="liked">Liked First</option>
            <option value="type">By Type</option>
            <option value="group">By Group</option>
          </select>

          <button
            onClick={() => setFilterBy("all")}
            className={`px-3 py-1.5 text-body-sm transition ${
              filterBy === "all" ? "border border-white bg-white text-black" : "border border-white/[0.06] text-gray-500 hover:text-white"
            }`}
          >
            All ({sounds.length})
          </button>

          <button
            onClick={() => setFilterBy("liked")}
            className={`px-3 py-1.5 text-body-sm transition ${
              filterBy === "liked" ? "border border-white bg-white text-black" : "border border-white/[0.06] text-gray-500 hover:text-white"
            }`}
          >
            Liked ({sounds.filter((s) => s.liked).length})
          </button>

          {groups.length > 0 && (
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setFilterBy("group");
              }}
              className="border border-white/[0.06] bg-black px-3 py-1.5 text-body text-gray-500"
            >
              <option value="">All Groups</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Provenance Verification */}
        <ProvenanceLookup className="mt-2" />
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        hidden
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onEnded={handleAudioEnded}
      />

      {/* Sound List - Compact Stacked */}
      <div className="flex flex-col gap-3 max-w-2xl">
        {filteredSounds.map((sound) => (
          <div
            key={sound.id}
            className={cn(
              "border border-white/[0.06] bg-black transition",
              playingId === sound.id && "border-white"
            )}
          >
            {/* Main row - always visible */}
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Play button - always shows play icon to start/select this sound */}
              <button
                onClick={() => handlePlayPause(sound)}
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/[0.06] bg-transparent hover:border-white"
                title="Play"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M6 4l14 8-14 8z" />
                </svg>
              </button>

              {/* Name and prompt */}
              <div className="flex-1 min-w-0">
                {editingId === sound.id ? (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(sound.id)}
                      className="h-6 text-body-sm"
                      autoFocus
                    />
                    <button onClick={() => handleRename(sound.id)} className="text-caption text-white">✓</button>
                    <button onClick={() => setEditingId(null)} className="text-caption text-gray-500">×</button>
                  </div>
                ) : (
                  <p
                    className="text-body-sm font-medium text-white truncate cursor-pointer hover:text-[#66023C]"
                    onClick={() => startEditing(sound)}
                    title={sound.name}
                  >
                    {sound.name}
                  </p>
                )}
              </div>

              {/* Type badge */}
              <Badge className="shrink-0 text-[10px] px-1.5 py-0.5">{sound.type}</Badge>

              {/* Like button */}
              <button
                onClick={() => handleToggleLike(sound.id, sound.liked)}
                className={cn(
                  "text-sm shrink-0",
                  sound.liked ? "text-white" : "text-gray-500 hover:text-white"
                )}
              >
                {sound.liked ? "★" : "☆"}
              </button>

              {/* Download */}
              <button
                onClick={() => handleDownload(sound.id)}
                className="text-sm text-gray-500 hover:text-white"
              >
                ↓
              </button>

              {/* Delete */}
              <button
                onClick={() => handleDelete(sound.id)}
                className="text-sm text-gray-500 hover:text-white"
              >
                ×
              </button>
            </div>

            {/* Expanded player row - shows when this sound is selected */}
            {playingId === sound.id && (
              <div className="border-t border-white/[0.06] px-3 py-2">
                <div className="flex items-center gap-2">
                  {/* Play/Pause button */}
                  <button
                    onClick={() => handlePlayPause(sound)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/[0.06] bg-transparent hover:border-white"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                        <rect x="6" y="5" width="4" height="14" />
                        <rect x="14" y="5" width="4" height="14" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                        <path d="M6 4l14 8-14 8z" />
                      </svg>
                    )}
                  </button>

                  {/* Stop button */}
                  <button
                    onClick={handleStop}
                    className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/[0.06] bg-transparent hover:border-white"
                    title="Stop"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                      <rect x="5" y="5" width="14" height="14" />
                    </svg>
                  </button>

                  <span className="text-body-sm text-gray-500 w-10 text-right shrink-0">
                    {secondsToTimecode(currentTime)}
                  </span>

                  <div className="flex-1">
                    <AudioWaveform
                      progress={duration > 0 ? (currentTime / duration) * 100 : 0}
                      peaks={waveformPeaks}
                      onSeek={handleSeek}
                    />
                  </div>

                  <span className="text-body-sm text-gray-500 w-8 shrink-0">
                    {secondsToTimecode(duration)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredSounds.length === 0 && (
        <div className="flex items-center justify-center p-8">
          <p className="text-body text-gray-500">No sounds match your filters</p>
        </div>
      )}
    </div>
  );
}
