"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";

const SLOGANS = [
  "Diamonds or Silence",
  "Swans Only",
  "Not for Everyone",
];


interface Frame2147241533Props {
  className?: string;
  children?: ReactNode;
}

export function Frame2147241533({ className, children }: Frame2147241533Props) {
  const [sloganIndex, setSloganIndex] = useState(0);

  const cycleSlogan = () => {
    setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
  };

  return (
    <div
      className={`absolute inset-0 flex flex-col pointer-events-none ${className ?? ""}`}
    >
      {/* Top Navigation */}
      <header className="pointer-events-auto">
        <div className="flex items-center justify-between px-8 py-6">
          <Link href="/" className="text-white/60 text-sm font-mono tracking-wider hover:text-white transition">
            SB
          </Link>
          <nav className="flex items-center gap-10">
            <Link
              href="/features"
              className="text-white/40 hover:text-white text-sm tracking-wide transition"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-white/40 hover:text-white text-sm tracking-wide transition"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className="text-white/40 hover:text-white text-sm tracking-wide transition"
            >
              About
            </Link>
            <Link
              href="/apply"
              className="shrink-0 border border-white/30 text-white px-5 py-2 text-sm tracking-wide hover:bg-white hover:text-black transition"
            >
              Join
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="text-center max-w-2xl pointer-events-auto">
          <h1 className="text-6xl md:text-7xl text-white leading-tight mb-8 font-display font-light tracking-tight">
            Swanblade
          </h1>
          <button
            onClick={cycleSlogan}
            className="block italic text-white/50 mb-12 max-w-md mx-auto text-2xl font-display tracking-wide hover:text-white/70 transition-all duration-300 cursor-pointer select-none"
          >
            {SLOGANS[sloganIndex]}
          </button>
          <Link
            href="/apply"
            className="inline-block border border-white/30 text-white px-8 py-4 text-sm tracking-wide hover:bg-white hover:text-black transition"
           
          >
            Apply
          </Link>
        </div>
        {children}
      </main>

      {/* Footer */}
      <footer className="pointer-events-auto px-8 py-6">
        <p
          className="text-center text-xs text-white/20 tracking-wide"
         
        >
          Not for everyone
        </p>
      </footer>
    </div>
  );
}

export default Frame2147241533;
