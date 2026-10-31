"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { ArrowLeft, Copy, Mail, Hash, AtSign } from "lucide-react";
import SubAgentTabs from "../components/SubAgentTabs";
import { getAvatarColor, getInitials } from "@/utils/defaultimgbg";
import { referralApi } from "@/api/referral/referral.api";
import { profileApi } from "@/api/users/users";
import { getApiErrorMessage } from "@/lib/api-error";
import toast from "react-hot-toast";

/** Shape this page maps the sub-agent + stats responses into. */
interface SubAgentDetail {
  id: string;
  username: string;
  email: string;
  name: string;
  displayName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  avatar: string | null;
  joinedAt: string;
  commissionPercentage: number;
  totalEarnings: number;
  /** Wallet withdrawable — the "Available Balance" tile. */
  availableBalance: number;
  /** Wallet safety-hold + payout-requested — the "Freeze (Pending)" tile. */
  freezePending: number;
  isActive: boolean;
  isBlocked: boolean;
  isFrozen: boolean;
  referralCode: string;
}


export default function SubAgentDetailPage() {
  const { id: subAgentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SubAgentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubAgent = async () => {
      try {
        setLoading(true);
        const [res, statsRes] = await Promise.all([
            referralApi.getSubAgentById(subAgentId),
            profileApi.getAgentReferralStatsById(subAgentId)
        ]);
        const item = res.data;
        const stats = statsRes.data;
        
        // Map backend data to our UI needs
        const mappedUser: SubAgentDetail = {
          id: item.id,
          username: item.employee?.username || "N/A",
          email: item.profile?.email || item.employee?.email || "N/A",
          name: item.profile?.fullName || item.employee?.username || "SubAgent",
          displayName: item.profile?.displayName || "",
          gender: item.profile?.gender || "",
          dateOfBirth: item.profile?.dateOfBirth || "",
          phone: item.profile?.phone || "",
          avatar: null,
          joinedAt: item.createdAt,
          commissionPercentage: item.commissionPercentage || 0,
          // Ledger truth, NOT stats.totalEarnings (the affiliate wallet
          // balance). The two come from different systems and do not
          // reconcile, which is why this page's header tile and Wallet tab read
          // one number while the Downline tab and the sub-agent listing — both
          // ledger-based — read another. Falls back to the wallet figure only
          // if an older API build omits the field.
          totalEarnings: stats.totalEarnedAllTime ?? stats.totalEarnings ?? 0,
          // Balance tiles read the WALLET, the same basis the sub-agent listing
          // uses, so "Available Balance" and "Freeze (Pending)" carry the same
          // number in the table and on this page. They used to read the ledger
          // buckets (pendingIncome / requestedAmount), which count earning rows
          // by status and drift from the wallet across the release cron.
          availableBalance: stats.availableBalance || 0,
          freezePending: stats.freezePending || 0,
          isActive: item.employee?.isActive ?? true,
          isBlocked: item.isBlocked ?? false,
          isFrozen: item.isFrozen ?? false,
          referralCode: item.referralCode || "N/A",
        };
        
        setUser(mappedUser);
      } catch (error: unknown) {
        toast.error(
          getApiErrorMessage(error, "Failed to load sub-agent details"),
        );
      } finally {
        setLoading(false);
      }
    };

    if (subAgentId) {
      fetchSubAgent();
    }
  }, [subAgentId]);

  if (loading) {
    return (
      <div className="space-y-4 px-5 py-4 animate-pulse">
        {/* Breadcrumb */}
        <div className="bg-[#161A21] px-6 py-3 rounded-lg flex items-center gap-2">
          <div className="h-4 w-24 rounded bg-white/10" />
          <div className="h-4 w-40 rounded bg-white/5" />
        </div>

        {/* Header card */}
        <div className="bg-[#161A21] rounded-xl p-8 flex justify-between items-start">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/10 shrink-0" />
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-white/10" />
              <div className="h-3 w-24 rounded bg-white/5" />
              <div className="h-3 w-48 rounded bg-white/5" />
              <div className="h-3 w-32 rounded bg-white/5" />
              <div className="h-3 w-28 rounded bg-white/5" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="h-6 w-20 rounded-full bg-white/10" />
            <div className="h-8 w-24 rounded bg-white/5" />
            <div className="h-8 w-24 rounded bg-white/5" />
            <div className="h-8 w-24 rounded bg-white/5" />
          </div>
        </div>

        {/* Tabs + content */}
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-28 rounded-lg bg-white/10" />
          ))}
        </div>
        <div className="bg-[#161A21] rounded-xl p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-white">
        <p className="text-lg text-gray-400">Sub-Agent not found</p>
        <button
          onClick={() => router.push("/agent-management/sub-agents")}
          className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Sub-Agents
        </button>
      </div>
    );
  }

  // `name` falls back to username in the mapper, so the heading and the handle
  // were often the same string printed twice.
  const displayTitle = user.name || user.username;

  const copyValue = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-3 sm:space-y-4 px-3 py-3 sm:px-5 sm:py-4 text-white">
      {/* BREADCRUMB */}
      <div className="bg-[#161A21] px-3 sm:px-6 py-3 rounded-lg text-xs sm:text-sm font-mono font-semibold text-gray-100 flex flex-wrap items-center gap-2">
        <button
          onClick={() => router.push("/agent-management/sub-agents")}
          className="text-gray-300 hover:text-[#B93DEB] transition-colors duration-200 flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          Sub-Agents
        </button>
        <span className="text-gray-600">/</span>
        <span className="text-white">
          {user.name || user.username} (ID: {user.id.slice(0, 8)})
        </span>
      </div>

      {/* HEADER CARD */}
      <div className="bg-[#161A21] rounded-xl p-4 sm:p-6 border border-gray-800/60">
        <div className="flex flex-col xl:flex-row xl:items-center gap-6 xl:justify-between">
          {/* LEFT — Avatar + Identity */}
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt="Sub-Agent Avatar"
                className="w-16 h-16 rounded-2xl object-cover shrink-0"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shrink-0"
                style={{
                  backgroundColor: getAvatarColor(displayTitle),
                }}
              >
                {getInitials(displayTitle)}
              </div>
            )}

            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => copyValue(user.username, "Username")}
                  title="Copy username"
                  className="group px-2.5 py-1 rounded-lg bg-[#1C2128] border border-gray-800 hover:border-gray-700 flex items-center gap-2 text-xs transition-colors"
                >
                  <AtSign size={12} className="text-gray-500" />
                  <span className="text-gray-500">Username</span>
                  <span className="text-gray-200 font-semibold">
                    {user.username}
                  </span>
                  <Copy
                    size={11}
                    className="text-gray-600 group-hover:text-purple-400 transition-colors"
                  />
                </button>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-bold uppercase tracking-wider border border-purple-500/30">
                  Sub-Agent
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    user.isActive
                      ? "bg-green-500/10 text-green-400 border-green-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                  }`}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Meta chips — every value carries an explicit label so the
                  bare handle isn't mistaken for a display name. */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {user.email && user.email !== "N/A" && (
                  <button
                    onClick={() => copyValue(user.email, "Email")}
                    title="Copy email"
                    className="group px-2.5 py-1 rounded-lg bg-[#1C2128] text-gray-300 border border-gray-800 hover:border-gray-700 flex items-center gap-2 transition-colors"
                  >
                    <Mail size={12} className="text-gray-500" />
                    <span className="text-gray-500">Email</span>
                    <span className="truncate max-w-[140px] sm:max-w-[220px] text-gray-200">
                      {user.email}
                    </span>
                    <Copy
                      size={11}
                      className="text-gray-600 group-hover:text-purple-400 transition-colors"
                    />
                  </button>
                )}
                <button
                  onClick={() => copyValue(user.referralCode, "Referral code")}
                  title="Copy referral code"
                  className="group px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:border-purple-500/40 flex items-center gap-2 font-bold tracking-wide transition-colors"
                >
                  <Hash size={12} className="text-purple-400/70" />
                  <span className="text-purple-400/70 font-medium">
                    Referral
                  </span>
                  {user.referralCode}
                  <Copy
                    size={11}
                    className="text-purple-400/50 group-hover:text-purple-300 transition-colors"
                  />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT — Stat tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 sm:shrink-0">
            {[
              {
                label: "Total Earnings",
                value: user.totalEarnings,
                color: "text-green-400",
              },
              {
                label: "Available Balance",
                value: user.availableBalance,
                color: "text-blue-400",
              },
              {
                label: "Freeze (Pending)",
                value: user.freezePending,
                color: "text-orange-400",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-[#1C2128] border border-gray-800 rounded-xl px-3 sm:px-4 py-3 min-w-0 sm:min-w-[130px]"
              >
                <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">
                  {stat.label}
                </p>
                <p className={`${stat.color} font-bold text-lg mt-1`}>
                  {stat.value.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS — reuse same AgentTabs structure */}
      <SubAgentTabs user={user} />
    </div>
  );
}
