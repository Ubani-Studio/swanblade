"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MarketingLayoutProps {
  children: ReactNode;
}

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-display text-lg tracking-wide">
            Swanblade
          </Link>

          <nav className="flex items-center gap-10">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm tracking-wide transition ${
                  pathname === link.href
                    ? "text-white"
                    : "text-white/40 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
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
      <main className="pt-20">{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          <span className="text-xs text-white/30 tracking-wide">
            Not for everyone
          </span>
          <div className="flex items-center gap-8">
            <span className="text-xs text-white/20 tracking-wide">
              &copy; {new Date().getFullYear()} Swanblade
            </span>
            <a
              href="mailto:studio@swanblade.com"
              className="text-xs text-white/20 tracking-wide hover:text-white transition"
            >
              studio@swanblade.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default MarketingLayout;
