"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MarketingLayout from "@/components/MarketingLayout";

type Currency = "USD" | "GBP" | "EUR";
type Billing = "monthly" | "annual";

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
};

const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
};

const PLANS = [
  {
    id: "professional",
    name: "Professional",
    monthlyUSD: 299,
    annualUSD: 2999,
    description: "For those who ship. Individual membership.",
    features: [
      "Unlimited sound generation",
      "Full studio access",
      "Provenance tracking",
      "2 invite codes",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    monthlyUSD: 999,
    annualUSD: 9999,
    description: "For teams who don't compromise. 5 seats.",
    highlighted: true,
    features: [
      "Everything in Professional",
      "5 team seats",
      "Game State Engine",
      "Stem bundles",
      "Twin OS integration",
      "5 invite codes",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyUSD: null,
    annualUSD: 25000,
    description: "Custom terms. Minimum commitment.",
    features: [
      "Everything in Studio",
      "Unlimited seats",
      "Custom API access",
      "Dedicated support",
      "White-label options",
      "Priority processing",
    ],
  },
];

function formatPrice(priceUSD: number | null, currency: Currency): string {
  if (priceUSD === null) return "Custom";
  const converted = Math.round(priceUSD * EXCHANGE_RATES[currency]);
  return `${CURRENCY_SYMBOLS[currency]}${converted.toLocaleString()}`;
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <p className="text-white/40">Loading...</p>
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled");

  const [currency, setCurrency] = useState<Currency>("USD");
  const [billing, setBilling] = useState<Billing>("annual");
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (planId === "enterprise") {
      // Redirect to contact/apply for enterprise
      router.push("/apply?tier=enterprise");
      return;
    }

    setLoading(planId);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: planId,
          interval: billing === "annual" ? "yearly" : "monthly",
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === "Not authenticated") {
        // Redirect to login, then back to pricing
        router.push(`/login?redirect=/pricing`);
      } else {
        alert(data.error || "Failed to start checkout");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout");
    } finally {
      setLoading(null);
    }
  };

  return (
    <MarketingLayout>
      {/* Cancelled Message */}
      {cancelled && (
        <div className="max-w-2xl mx-auto px-6 pt-8">
          <div className="border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
            <p className="text-yellow-400 text-sm">
              Checkout was cancelled. Ready when you are.
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-display font-light mb-12">
            Membership
          </h1>

          {/* Toggles */}
          <div className="flex flex-wrap gap-4">
            {/* Billing Toggle */}
            <div className="inline-flex border border-white/10">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-4 py-2 text-xs tracking-wide transition ${
                  billing === "monthly"
                    ? "bg-white/10 text-white"
                    : "text-white/30 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`px-4 py-2 text-xs tracking-wide transition ${
                  billing === "annual"
                    ? "bg-white/10 text-white"
                    : "text-white/30 hover:text-white"
                }`}
              >
                Annual
              </button>
            </div>

            {/* Currency Toggle */}
            <div className="inline-flex border border-white/10">
              {(["USD", "GBP", "EUR"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-2 text-xs tracking-wide transition ${
                    currency === c
                      ? "bg-white/10 text-white"
                      : "text-white/30 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-12 px-6 border-t border-white/10">
        <div className="max-w-2xl mx-auto space-y-4">
          {PLANS.map((plan) => {
            const price = billing === "annual" ? plan.annualUSD : plan.monthlyUSD;
            const isLoading = loading === plan.id;

            return (
              <div
                key={plan.name}
                className={`p-6 border ${
                  plan.highlighted
                    ? "border-[#66023C]"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-display">{plan.name}</h2>
                    <p className="text-white/40 text-xs mt-0.5">
                      {plan.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-2xl font-display font-light">
                      {formatPrice(price, currency)}
                    </span>
                    {price && (
                      <span className="text-white/30 text-xs ml-1">
                        /{billing === "annual" ? "yr" : "mo"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between gap-6">
                  {/* Features */}
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="text-white/40 text-xs"
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isLoading}
                    className={`shrink-0 border px-6 py-2 text-xs tracking-wide transition disabled:opacity-50 ${
                      plan.highlighted
                        ? "border-[#66023C] text-white hover:bg-[#66023C]"
                        : "border-white/30 text-white hover:bg-white hover:text-black"
                    }`}
                  >
                    {isLoading
                      ? "..."
                      : plan.id === "enterprise"
                      ? "Contact"
                      : "Subscribe"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {billing === "annual" && (
          <div className="max-w-2xl mx-auto mt-4">
            <p className="text-white/30 text-xs">
              Annual includes two months free.
            </p>
          </div>
        )}
      </section>

      {/* Footer */}
      <section className="py-20 px-6 border-t border-white/10">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-white/50 text-sm">
            <span className="text-white font-display font-light text-xl">12</span> seats remaining
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
