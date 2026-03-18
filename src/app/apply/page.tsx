"use client";

import { useState } from "react";
import Link from "next/link";

export default function ApplyPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    project: "",
    website: "",
    referral: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would submit to an API
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-display font-light mb-6">We&apos;ll be in touch.</h1>
          <p className="text-white/50 text-sm mb-8">
            We review applications weekly. If it&apos;s a fit,
            you&apos;ll hear from us with next steps.
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="px-6 py-6">
        <Link href="/" className="font-display font-light text-sm tracking-wide">
          Swanblade
        </Link>
      </header>

      {/* Form */}
      <main className="max-w-lg mx-auto px-6 py-16">
        <h1 className="text-4xl font-display font-light mb-4">Apply</h1>
        <p className="text-white/50 text-sm mb-12">
          Tell us what you&apos;re working on and why Swanblade belongs in your workflow.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-xs text-white/40 mb-2">
              Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-transparent border-b border-white/20 py-3 text-white focus:border-white focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-transparent border-b border-white/20 py-3 text-white focus:border-white focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-2">
              Role
            </label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-transparent border-b border-white/20 py-3 text-white focus:border-white focus:outline-none transition appearance-none"
            >
              <option value="" className="bg-black">Select</option>
              <option value="sound-designer" className="bg-black">Sound Designer</option>
              <option value="composer" className="bg-black">Composer</option>
              <option value="audio-director" className="bg-black">Audio Director</option>
              <option value="game-developer" className="bg-black">Game Developer</option>
              <option value="post-production" className="bg-black">Post-Production</option>
              <option value="other" className="bg-black">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-2">
              What are you working on?
            </label>
            <textarea
              required
              rows={3}
              value={formData.project}
              onChange={(e) => setFormData({ ...formData, project: e.target.value })}
              placeholder="Current project, studio, or context"
              className="w-full bg-transparent border-b border-white/20 py-3 text-white focus:border-white focus:outline-none transition resize-none placeholder:text-white/20"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-2">
              Portfolio / Website
              <span className="text-white/20 ml-2">Optional</span>
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://"
              className="w-full bg-transparent border-b border-white/20 py-3 text-white focus:border-white focus:outline-none transition placeholder:text-white/20"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-2">
              Invite code
              <span className="text-white/20 ml-2">If you have one</span>
            </label>
            <input
              type="text"
              value={formData.referral}
              onChange={(e) => setFormData({ ...formData, referral: e.target.value.toUpperCase() })}
              placeholder="SB-XXXX-XXXX"
              className="w-full bg-transparent border-b border-white/20 py-3 text-white focus:border-white focus:outline-none transition placeholder:text-white/20 font-mono"
            />
          </div>

          <div className="pt-8">
            <button
              type="submit"
              className="w-full border border-white/30 text-white py-4 text-sm tracking-wide hover:bg-white hover:text-black transition"
            >
              Submit application
            </button>
          </div>
        </form>

        <p className="mt-8 text-xs text-white/20 text-center">
          Invite codes receive priority.
        </p>
      </main>
    </div>
  );
}
