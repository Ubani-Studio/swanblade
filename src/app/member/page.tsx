"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface MemberData {
  id: string;
  name: string;
  email: string;
  membership_tier: string;
  membership_status: string;
  invite_code: string | null;
  invites_remaining: number;
  created_at: string;
  stripe_subscription_id: string | null;
}

interface UsageStats {
  sounds_generated: number;
  total_duration_ms: number;
}

export default function MemberPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/40">Loading...</div>
      </div>
    }>
      <MemberPageContent />
    </Suspense>
  );
}

function MemberPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const [member, setMember] = useState<MemberData | null>(null);
  const [usage, setUsage] = useState<UsageStats>({ sounds_generated: 0, total_duration_ms: 0 });
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadMemberData();
  }, []);

  const loadMemberData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/member");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setMember({
          id: user.id,
          name: profile.name || user.email?.split("@")[0] || "Member",
          email: user.email || "",
          membership_tier: profile.membership_tier || "pending",
          membership_status: profile.membership_status || "pending",
          invite_code: profile.invite_code,
          invites_remaining: profile.invites_remaining || 0,
          created_at: profile.created_at,
          stripe_subscription_id: profile.stripe_subscription_id,
        });
      } else {
        setMember({
          id: user.id,
          name: user.email?.split("@")[0] || "Member",
          email: user.email || "",
          membership_tier: "pending",
          membership_status: "pending",
          invite_code: null,
          invites_remaining: 0,
          created_at: new Date().toISOString(),
          stripe_subscription_id: null,
        });
      }

      try {
        const { data: usageData } = await supabase
          .from("sounds")
          .select("id, duration_ms")
          .eq("user_id", user.id);

        if (usageData) {
          setUsage({
            sounds_generated: usageData.length,
            total_duration_ms: usageData.reduce((sum: number, s: { duration_ms?: number }) => sum + (s.duration_ms || 0), 0),
          });
        }
      } catch {
        // Table might not exist yet
      }
    } catch (error) {
      console.error("Error loading member data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal");
      }
    } catch (error) {
      console.error("Error opening billing portal:", error);
      alert("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCopyInviteCode = () => {
    if (member?.invite_code) {
      navigator.clipboard.writeText(member.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getTierDisplay = (tier: string) => {
    switch (tier) {
      case "professional": return "Professional";
      case "studio": return "Studio";
      case "enterprise": return "Enterprise";
      default: return "Pending";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-400";
      case "past_due": return "text-yellow-400";
      case "cancelled": return "text-red-400";
      default: return "text-white/40";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/40">Loading...</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 mb-4">Not authenticated</p>
          <Link href="/login" className="text-white/70 hover:text-white underline">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-display font-light text-sm tracking-wide">
            Swanblade
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/studio"
              className="text-sm text-white/40 hover:text-white transition"
            >
              Enter Studio
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-white/30 hover:text-white/60 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Success Message */}
      {success && (
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <div className="border border-green-500/30 bg-green-500/10 p-4 text-center">
            <p className="text-green-400 text-sm">
              Welcome to Swanblade. Your membership is now active.
            </p>
          </div>
        </div>
      )}

      {/* Member Info */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-16">
          <h1 className="text-4xl font-display font-light">{member.name}</h1>
          <p className="text-white/40 text-sm mt-1">
            {member.email}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-16">
          <div className="border border-white/10 p-5">
            <p className="text-xs text-white/30 mb-2">Membership</p>
            <p className="text-base">{getTierDisplay(member.membership_tier)}</p>
            <p className={`text-xs mt-1 ${getStatusColor(member.membership_status)}`}>
              {member.membership_status}
            </p>
          </div>
          <div className="border border-white/10 p-5">
            <p className="text-xs text-white/30 mb-2">Sounds generated</p>
            <p className="text-base">{usage.sounds_generated.toLocaleString()}</p>
            <p className="text-xs text-white/30 mt-1">
              {formatDuration(usage.total_duration_ms)} total
            </p>
          </div>
          <div className="border border-white/10 p-5">
            <p className="text-xs text-white/30 mb-2">Invites left</p>
            <p className="text-base">{member.invites_remaining}</p>
          </div>
        </div>

        {/* Invite Code */}
        {member.invite_code && (
          <div className="border border-white/10 p-6 mb-6">
            <p className="text-xs text-white/30 mb-3">Your invite code</p>
            <div className="flex items-center gap-4">
              <p className="font-mono text-base tracking-wider text-white/70">
                {member.invite_code}
              </p>
              <button
                onClick={handleCopyInviteCode}
                className="text-xs text-white/40 hover:text-white transition border border-white/20 px-3 py-1"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-white/30 text-xs mt-3">
              Referred members receive priority review.
            </p>
          </div>
        )}

        {/* Membership Actions */}
        <div className="border border-white/10 p-6 mb-16">
          {member.membership_status === "active" && member.stripe_subscription_id ? (
            <div className="space-y-4">
              <p className="text-white/50 text-sm">
                Manage your subscription, update payment method, or view invoices.
              </p>
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="border border-white/30 text-white py-2.5 px-5 text-sm tracking-wide hover:bg-white hover:text-black transition disabled:opacity-50"
              >
                {portalLoading ? "..." : "Manage billing"}
              </button>
            </div>
          ) : member.membership_status === "pending" ? (
            <div className="space-y-4">
              <p className="text-white/50 text-sm">
                Upgrade to unlock the full Swanblade studio.
              </p>
              <Link
                href="/pricing"
                className="inline-block border border-white/30 text-white py-2.5 px-5 text-sm tracking-wide hover:bg-white hover:text-black transition"
              >
                View plans
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-white/50 text-sm">
                Your membership is {member.membership_status}. Reactivate to continue.
              </p>
              <Link
                href="/pricing"
                className="inline-block border border-white/30 text-white py-2.5 px-5 text-sm tracking-wide hover:bg-white hover:text-black transition"
              >
                Reactivate
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
