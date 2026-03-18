import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center">
        <p className="font-mono text-xs text-white/20 mb-8">
          404
        </p>
        <h1 className="text-3xl font-display font-light mb-4">Nothing here.</h1>
        <p className="text-white/40 mb-12">
          The path you followed doesn&apos;t lead anywhere.
        </p>
        <Link
          href="/"
          className="text-sm text-white/40 hover:text-white transition"
        >
          Return
        </Link>
      </div>
    </div>
  );
}
