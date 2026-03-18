"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function ProfileDropdown() {
  const { user, profile, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleSignOut = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      setOpen(false);
      await signOut();
    },
    [signOut]
  );

  // Derive initial from profile name, user email, or fallback
  const initial = profile?.name
    ? profile.name.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : "?";

  const displayName = profile?.name || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "";

  if (loading) {
    return (
      <div className="w-8 h-8 bg-black border border-white/[0.06] flex items-center justify-center">
        <div className="w-3 h-3 border border-gray-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 bg-black border border-white/[0.06] flex items-center justify-center text-sm text-gray-400 hover:text-white hover:border-white/[0.12] transition-all duration-200"
        title={displayName}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-black border border-white/[0.06] shadow-lg z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-sm text-white truncate">{displayName}</p>
            {displayEmail && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {displayEmail}
              </p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            <a
              href="/member"
              className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              onClick={() => setOpen(false)}
            >
              Profile
            </a>
          </div>

          {/* Divider + Sign Out */}
          <div className="border-t border-white/[0.06] py-1">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
