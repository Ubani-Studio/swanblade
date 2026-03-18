"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-white/40">Loading...</p>
        </div>
      }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/studio";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Check your email for the confirmation link.");
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-8">
      <div className="w-full max-w-xs mx-auto">
        {/* Logo */}
        <Link href="/" className="block mb-16">
          <span className="text-2xl font-display font-light text-white">
            Swanblade
          </span>
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-display font-light text-white">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
        </div>

        {/* Message */}
        {message && (
          <div className="border border-white/10 p-4 mb-8">
            <p className="text-sm text-white/50">{message}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 mb-6">{error}</p>
        )}

        {/* Form */}
        <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-6">
          {mode === "signup" && (
            <div>
              <label className="block text-xs text-white/40 mb-2">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white transition"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-white/40 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent border-b border-white/20 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white transition"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent border-b border-white/20 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white transition"
              disabled={loading}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 text-sm text-black bg-white hover:bg-white/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "..." : mode === "login" ? "Enter" : "Create account"}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-black text-xs text-white/30">
              or
            </span>
          </div>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full px-6 py-3 text-sm text-white border border-white/20 hover:border-white/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue with Google
        </button>

        {/* Toggle mode */}
        <div className="mt-12 text-center">
          {mode === "login" ? (
            <div>
              <p className="text-xs text-white/30 mb-2">No account?</p>
              <button
                onClick={() => setMode("signup")}
                className="text-sm text-white hover:text-white/60 transition"
              >
                Create one
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-white/30 mb-2">Already a member?</p>
              <button
                onClick={() => setMode("login")}
                className="text-sm text-white hover:text-white/60 transition"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
