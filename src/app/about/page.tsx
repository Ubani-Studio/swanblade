"use client";

import MarketingLayout from "@/components/MarketingLayout";

export default function AboutPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-display font-light mb-8">
            Only what cuts through.
          </h1>
          <p className="text-white/50 leading-relaxed">
            We built Swanblade for people who ship. Not for hobbyists tinkering on weekends.
            Not for experimenters chasing trends. For the ones who put sound in front of
            millions and refuse to compromise on any of it.
          </p>
        </div>
      </section>

      {/* Belief */}
      <section className="py-16 px-6 border-t border-white/10">
        <div className="max-w-2xl mx-auto space-y-12">
          <div>
            <h2 className="text-sm text-white mb-4">Diamonds or nothing</h2>
            <p className="text-white/50 text-sm">
              If it&apos;s not ready for broadcast, it doesn&apos;t leave. We don&apos;t do
              &quot;interesting experiments.&quot; We do audio that belongs in the final cut,
              first try, every time.
            </p>
          </div>
          <div>
            <h2 className="text-sm text-white mb-4">Your sound. Finally.</h2>
            <p className="text-white/50 text-sm">
              You&apos;ve spent years compromising. Settling for close enough. Swanblade
              is the sound you&apos;ve always heard in your head, finally real.
              The search is over.
            </p>
          </div>
          <div>
            <h2 className="text-sm text-white mb-4">Not for everyone</h2>
            <p className="text-white/50 text-sm">
              We charge what we&apos;re worth. We build for people who know what they want.
              If that&apos;s not you, there are cheaper options. We won&apos;t be offended.
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-24 px-6 border-t border-white/10">
        <div className="max-w-2xl mx-auto">
          <p className="text-white/50 text-sm mb-4">
            For enterprise inquiries and partnerships:
          </p>
          <a
            href="mailto:studio@swanblade.com"
            className="text-white hover:text-white/60 transition text-sm"
          >
            studio@swanblade.com
          </a>
        </div>
      </section>
    </MarketingLayout>
  );
}
