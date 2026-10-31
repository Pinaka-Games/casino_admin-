"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useRouter, useSearchParams } from "next/navigation";
import { connectSocket } from "@/lib/socket";
import PageLoader from "@/components/PageLoader";
import { AgentStats } from "./components/AgentStats";
import AgentDateFilters, {
  AgentDateRange,
  resolvePreset,
} from "./components/AgentDateFilters";
import { ReferralPromotion } from "./components/ReferralPromotion";
import { EarningsChart } from "./components/EarningsChart";
import { DownlineTable } from "./components/DownlineTable";
import { MyRewards } from "./components/MyRewards";
// Retained for the commented-out Dashboard tab below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AgentOverview } from "./components/AgentOverview";
import { WalletOverview } from "./components/WalletOverview";
import Tabs, { TabKey } from "./components/Tabs";
import { profileApi } from "@/api/users/users";
import AgentPackageHistory from "./agent-package-history/page";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { ReferralStats, EarningRecord } from "@/types/profile.type";
import toast from "react-hot-toast";
import DownloadBanners from "./components/DownloadBanners";
import { ClaimHistory } from "./components/ClaimHistory";
import { MyPayoutRequests } from "./components/MyPayoutRequests";
import { CommissionCalculator } from "./components/CommissionCalculator";
import { PlatformFeeTransparency } from "./components/PlatformFeeTransparency";
import { InfoTip } from "./components/InfoTip";
import { CheckCircle2, PartyPopper, X } from "lucide-react";
import { FeatureGate, FeatureBadge } from "./components/FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAuth } from "@/context/AuthContext";
import { PaymentDetailsModal } from "./components/PaymentDetailsModal";
import { RequestPayoutModal } from "./components/RequestPayoutModal";
import { CoinflowLinkWaiter } from "./components/CoinflowLinkWaiter";
import {
  agentPaymentApi,
  AgentPaymentRequest,
  AgentPaymentStatus,
} from "@/api/agent-payment/agent-payment.api";
import { agentBreezeApi } from "@/api/agent-payment/agent-breeze.api";
import { agentCoinflowApi } from "@/api/agent-payment/agent-coinflow.api";
import { AlertCircle, Clock, Percent } from "lucide-react";
import { commissionChangeRequestApi } from "@/api/commission-change-request/commission-change-request.api";

/**
 * True when a payout request has no real destination linked yet.
 *
 * `paymentDetails` being present is NOT enough: a sub-agent request can be
 * created with `{ provider }` already stamped on it, before the hosted page is
 * finished. The server answers this properly on every request it returns
 * (`payoutReady` — a destination the requester CONFIRMED, on a provider payout
 * that hasn't failed); the id checks below are only a fallback for a response
 * that predates the flag.
 */
const needsPayoutDetails = (r: AgentPaymentRequest): boolean => {
  if (
    ![
      AgentPaymentStatus.PENDING_AGENT,
      AgentPaymentStatus.AGENT_APPROVED,
      AgentPaymentStatus.PENDING_ADMIN,
    ].includes(r.status)
  ) {
    return false;
  }

  if (typeof r.payoutReady === "boolean") return !r.payoutReady;

  const details = (r as any).paymentDetails as Record<string, any> | null;
  if (!details) return true;

  if (details.provider === "BREEZE") return !details.agentBreezePageId;
  if (details.provider === "COINFLOW") return !details.coinflowPayoutId;
  return !(details.accountNumber || details.address);
};

/** Provider the requester already chose, from the note tag or paymentDetails. */
const resolveRequestProvider = (
  r: AgentPaymentRequest,
): "BREEZE" | "COINFLOW" | null => {
  const tag = /\[(BREEZE|COINFLOW)\]/i
    .exec(r.note ?? "")?.[1]
    ?.toUpperCase();
  if (tag === "BREEZE" || tag === "COINFLOW") return tag;
  const p = (r as any).paymentDetails?.provider;
  return p === "BREEZE" || p === "COINFLOW" ? p : null;
};

/**
 * Coinflow attaches the destination to our request only through
 * `POST payouts/:id/confirm` — no return bridge or webhook does it.
 *
 * This used to be a background poll that called confirm with an EMPTY body
 * every few seconds after the tab opened, letting the backend pick whichever
 * destination the withdrawer had on file. For anyone who had been paid before,
 * that fired within seconds of opening the page: close the tab without touching
 * the form and the request was still "confirmed" and queued for admin approval.
 * The requester now picks the destination themselves in CoinflowLinkWaiter,
 * which is the only thing that submits — and the endpoint refuses a confirm
 * that names no destination.
 */

const DashboardContent = () => {
  const { isLoading: authLoading, isAuthenticated, user } = useAuthStore();
  const { hasRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCommissionCount, setPendingCommissionCount] = useState(0);

  // Sub-agents: surface pending commission-change requests to review.
  useEffect(() => {
    commissionChangeRequestApi
      .inbox("PENDING")
      .then((r) => setPendingCommissionCount(r.data?.length ?? 0))
      .catch(() => setPendingCommissionCount(0));
  }, []);
  const [isClaiming, setIsClaiming] = useState(false);
  // "dashboard" tab is commented out for now — Rewards is the landing tab.
  const [activeTab, setActiveTab] = useState<TabKey>("rewards");
  const [claimHistoryKey, setClaimHistoryKey] = useState(0);
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  const [claimSuccessAmount, setClaimSuccessAmount] = useState(0);
  const [claimSuccessTitle, setClaimSuccessTitle] = useState("Wallet Credited!");
  const [claimSuccessMessage, setClaimSuccessMessage] = useState(
    "Your commission has been instantly transferred to your main wallet balance.",
  );
  const [showClaimAmount, setShowClaimAmount] = useState(true);

  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();
  const access = useFeatureAccess();
  const [period, setPeriod] = useState("W");

  // Agent-payment requests requiring payment details from sub-agent
  const [myPaymentRequests, setMyPaymentRequests] = useState<AgentPaymentRequest[]>([]);
  const [detailsModalRequest, setDetailsModalRequest] = useState<AgentPaymentRequest | null>(null);
  const [requestPayoutOpen, setRequestPayoutOpen] = useState(false);
  // Coinflow "Add Details": the hosted page is in another tab and only a
  // deliberate pick in the waiter submits the destination, so the picker has to
  // stay on screen until the requester finishes or walks away.
  const [coinflowDetails, setCoinflowDetails] = useState<{
    requestId: string;
    payoutId: string;
    url: string;
  } | null>(null);

  const DISMISSED_KEY = "agent_payment_dismissed_detail_ids";
  const [dismissedDetailIds, setDismissedDetailIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(DISMISSED_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });
  const persistDismissed = (s: Set<string>) => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
    } catch {
      // ignore quota / disabled storage
    }
  };
  // Banner = still missing a payout destination. Once the destination is linked
  // the request moves on to approval and this pair of actions disappears; from
  // then on it's only visible (read-only) under Payout Requests.
  const showDetailsBanner = (r: AgentPaymentRequest) => needsPayoutDetails(r);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const cancelRequest = async (id: string) => {
    setCancellingId(id);
    try {
      await agentPaymentApi.cancelMyRequest(id);
      toast.success("Request cancelled. Your balance is available again.");
      await Promise.all([fetchMyPaymentRequests(), fetchData()]);
      // Signal the history lists to refetch so the cancelled request shows its new state
      // instead of the copy they loaded when the tab first opened.
      setClaimHistoryKey((k) => k + 1);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not cancel this request",
      );
    } finally {
      setCancellingId(null);
    }
  };

  // Rejected-request banners the sub-agent has acknowledged (so they don't linger
  // forever after a new request is made).
  const DISMISSED_REJECTED_KEY = "agent_payment_dismissed_rejected_ids";
  const [dismissedRejectedIds, setDismissedRejectedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(DISMISSED_REJECTED_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });
  const dismissRejected = (id: string) => {
    // Server-side so the banner stays closed in every browser; the local set
    // just hides it immediately.
    void agentPaymentApi.dismissMyRequest(id).catch(() => undefined);
    setDismissedRejectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        window.localStorage.setItem(
          DISMISSED_REJECTED_KEY,
          JSON.stringify([...next]),
        );
      } catch {
        // ignore quota / disabled storage
      }
      return next;
    });
  };

  const fetchMyPaymentRequests = async () => {
    try {
      const res = await agentPaymentApi.myRequests();
      setMyPaymentRequests(res.data || []);
    } catch (err) {
      console.error("Failed to fetch agent-payment requests:", err);
    }
  };

  useEffect(() => {
    setMounted(true);
    // Initialize tab from URL
    const tabParam = searchParams.get("tab") as TabKey;
    const validTabs: TabKey[] = ["rewards", "team", "earnings", "rules", "claimhistory", "payoutrequests", "downloadbanner"];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // Back from the Breeze hosted page (`?breeze=success|failed`). Breeze often
  // still reports the page unconfirmed at the moment it redirects, so the
  // request showed "Awaiting Payment Details" until the 5-min reconcile. Ask
  // the server to re-pull it a few times now, refreshing after each.
  useEffect(() => {
    if (!mounted || isAuthenticated !== "authenticated") return;
    if (!searchParams.get("breeze")) return;
    let cancelled = false;
    const timers = [0, 4000, 10000, 20000, 40000].map((ms) =>
      setTimeout(async () => {
        if (cancelled) return;
        try {
          await agentBreezeApi.syncMine();
        } catch {
          // best effort — the reconcile cron is still the backstop
        }
        if (cancelled) return;
        void fetchMyPaymentRequests();
        void fetchData(undefined, { silent: true });
      }, ms),
    );
    // The param is left in place (the tab effect rewrites the URL from the
    // same searchParams); a reload just syncs again, which is harmless.
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuthenticated]);

  // Update URL when tab changes
  useEffect(() => {
    if (mounted) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", activeTab);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [activeTab, mounted]);

  // Auth Protection Logic
  useEffect(() => {
    if (mounted && !authLoading) {
      if (isAuthenticated === "unauthenticated") {
        router.replace("/login?callbackUrl=/agent-management");
      } else if (user) {
        const isAffiliate = user.roles?.some((role) => {
          const name = role.name.toLowerCase();
          return (
            name === "agent" || name === "subagent" || name === "sub_agent"
          );
        });
        const isSuperAdmin = user.roles?.some(
          (role) => role.name.toLowerCase() === "superadmin",
        );

        if (!isAffiliate && !isSuperAdmin) {
          router.replace("/dashboard");
        }
      }
    }
  }, [mounted, authLoading, isAuthenticated, user, router]);

  // Date range for the KPI cards. Opens on "All", like the admin Dashboard
  // whose filter bar this one mirrors.
  const [dateRange, setDateRange] = useState<AgentDateRange>(() => {
    const [from, to] = resolvePreset("All");
    return { activeFilter: "All", fromDate: from, toDate: to };
  });

  // Fetch Dashboard Data
  // `silent`: background refresh (socket event, Breeze re-sync) — keep the
  // current cards on screen instead of flipping them to the loading state,
  // which read as the whole page refreshing on every event.
  const fetchData = async (
    range: AgentDateRange = dateRange,
    { silent = false }: { silent?: boolean } = {},
  ) => {
    const currentUser = useAuthStore.getState().user;
    const isAffiliate = currentUser?.roles?.some((role) => {
      const name = role.name.toLowerCase();
      return name === "agent" || name === "subagent" || name === "sub_agent";
    });
    if (!isAffiliate) return; // Only fetch for confirmed affiliates

    try {
      if (!silent) setIsLoading(true);
      const [statsRes, earningsRes] = await Promise.all([
        profileApi.getReferralStats({
          startDate: range.fromDate?.toISOString(),
          endDate: range.toDate?.toISOString(),
        }),
        profileApi.getEarningHistory(period),
      ]);
      setStats(statsRes.data);
      setEarnings(earningsRes.data);
    } catch (error) {
      console.error("Failed to fetch agent data:", error);
      if (!silent) toast.error("Failed to load dashboard data");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && isAuthenticated === "authenticated" && user) {
      fetchCurrentPackage();
      const isAffiliate = user.roles?.some((role) => {
        const name = role.name.toLowerCase();
        return name === "agent" || name === "subagent" || name === "sub_agent";
      });
      if (isAffiliate) {
        fetchData();
        fetchMyPaymentRequests();
      }
    }
  }, [mounted, authLoading, period]);

  /**
   * "Add Details" — go straight to the provider's hosted page in a new tab.
   *
   * The provider was already chosen when the request was created, so a modal in
   * between only adds a click. The tab is claimed synchronously here, inside the
   * click gesture: opening it after the awaits below would lose the gesture and
   * the browser would block it. Only requests with no recorded provider still
   * fall back to the picker modal.
   */
  const openPayoutPage = async (r: AgentPaymentRequest) => {
    const provider = resolveRequestProvider(r);
    if (!provider) {
      setDetailsModalRequest(r);
      return;
    }

    const popup = window.open("about:blank", "_blank");
    try {
      const payout =
        provider === "BREEZE"
          ? (await agentBreezeApi.createPage(r.id)).data
          : (await agentCoinflowApi.createPayout(r.id)).data;
      const url = payout?.url;

      if (!url) {
        if (popup && !popup.closed) popup.close();
        toast.error(`${provider} payout page could not be opened.`);
        return;
      }

      if (popup && !popup.closed) popup.location.href = url;
      else window.open(url, "_blank");

      // Breeze links the destination itself via its return bridge / webhook.
      // Coinflow has neither: the requester has to come back and choose which
      // destination gets paid, so keep the picker on screen for them. Nothing
      // is submitted until they do — closing this leaves the request exactly as
      // it was, still showing "Add Payment Details".
      if (provider === "COINFLOW" && payout?.id) {
        setCoinflowDetails({ requestId: r.id, payoutId: payout.id, url });
      }
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      toast.error(
        err?.response?.data?.message || "Failed to open the payout page",
      );
    }
  };

  // Auto-open modal when an agent-approved request needs payment details.
  // Skip when the note already carries a provider tag (`[BREEZE]` /
  // `[COINFLOW]`) — the requester already picked the provider at request time, so
  // we don't pop an unsolicited modal; they use the "Add Details" banner button,
  // which opens the modal straight on the chosen provider's payout page.
  useEffect(() => {
    if (detailsModalRequest) return;
    const PROVIDER_TAG_RX = /\[(BREEZE|COINFLOW)\]/i;
    const needsDetails = myPaymentRequests.find(
      (r) =>
        // Sub-agent: parent approved, awaiting payout details.
        // Agent: routed straight to admin, still needs to add provider details.
        (r.status === AgentPaymentStatus.AGENT_APPROVED ||
          (r.status === AgentPaymentStatus.PENDING_ADMIN &&
            !(r as any).paymentDetails)) &&
        !dismissedDetailIds.has(r.id) &&
        !PROVIDER_TAG_RX.test(r.note ?? ""),
    );
    if (needsDetails) setDetailsModalRequest(needsDetails);
  }, [myPaymentRequests, detailsModalRequest, dismissedDetailIds]);

  // Live earning updates via socket
  useEffect(() => {
    if (!mounted || isAuthenticated !== "authenticated") return;
    const socket = connectSocket();
    // One action fans out into a burst of events (an auto-approved payout
    // emits created + approved + the wallet/stats updates, some to more than
    // one room). Coalesce the burst into a single silent refetch.
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let paymentsDirty = false;
    const schedule = (payments: boolean) => {
      paymentsDirty ||= payments;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        void fetchData(undefined, { silent: true });
        if (paymentsDirty) void fetchMyPaymentRequests();
        paymentsDirty = false;
      }, 600);
    };
    const refresh = () => schedule(false);
    // Payout-request transitions (parent agent approved/rejected, admin released)
    // move money, so refresh the stats AND the request banners together.
    const onPaymentUpdated = () => schedule(true);

    socket.on("affiliate.earning.created", refresh);
    socket.on("affiliate.stats.updated", refresh);
    socket.on("agent-payment:updated", onPaymentUpdated);
    return () => {
      socket.off("affiliate.earning.created", refresh);
      socket.off("affiliate.stats.updated", refresh);
      socket.off("agent-payment:updated", onPaymentUpdated);
      clearTimeout(debounce);
    };
  }, [mounted, isAuthenticated]);

  // Both agents and sub-agents go through the same payout flow now:
  // request -> approval -> Breeze payment details. (Agents route straight to
  // admin; sub-agents go to their parent agent first — handled server-side.)
  const handleClaim = async () => {
    // Admin wallet controls. The server refuses these requests on both payout
    // paths, so this is purely so the agent gets a clear reason instead of a
    // raw 403 after filling in the payout form.
    if (stats?.isBlocked) {
      toast.error("Your account is blocked. Contact support.");
      return;
    }
    if (stats?.isFrozen) {
      toast.error(
        "Your wallet is frozen by admin — payouts are on hold. Contact support.",
      );
      return;
    }
    const openStatuses: AgentPaymentStatus[] = [
      AgentPaymentStatus.PENDING_AGENT,
      AgentPaymentStatus.AGENT_APPROVED,
      AgentPaymentStatus.PENDING_ADMIN,
      AgentPaymentStatus.ADMIN_APPROVED,
    ];
    // Refetch first: the list in state can lag the last claim by a socket
    // round-trip, which let a second claim through. The server refuses it too.
    let latest = myPaymentRequests;
    try {
      latest = (await agentPaymentApi.myRequests()).data || latest;
      setMyPaymentRequests(latest);
    } catch {
      // fall back to the list we have
    }
    const open = latest.find((r) => openStatuses.includes(r.status));
    if (open) {
      toast.error(
        needsPayoutDetails(open)
          ? `You already have a payout request of ${Number(open.amount).toFixed(2)} waiting for payment details. Add its details or cancel it before requesting again.`
          : "You already have a pending payout request. Wait for it to be processed before requesting again.",
      );
      return;
    }
    setRequestPayoutOpen(true);
  };

  if (
    !mounted ||
    authLoading ||
    (isAuthenticated === "authenticated" && !user)
  ) {
    return <PageLoader />;
  }

  // A request is "open" while it moves through the approval/payout pipeline.
  const hasOpenRequest = myPaymentRequests.some((r) =>
    [
      AgentPaymentStatus.PENDING_AGENT,
      AgentPaymentStatus.AGENT_APPROVED,
      AgentPaymentStatus.PENDING_ADMIN,
      AgentPaymentStatus.ADMIN_APPROVED,
    ].includes(r.status),
  );
  // Surface the most recent rejection (once, until dismissed or re-requested) so
  // the "Add Details" banner doesn't reappear and the user knows they can retry.
  // REJECTED_BY_AGENT is also how the server stores the requester's own cancel,
  // a superseded claim and an unfinished claim returned by the timeout — none
  // of those were rejected by anyone, so they must not raise this banner
  // ("rejected by your agent" on a request the agent never saw).
  const closedWithoutRejection = (r: AgentPaymentRequest) => {
    const reason = (r.rejectionReason ?? "").toLowerCase();
    return (
      r.status === AgentPaymentStatus.REJECTED_BY_AGENT &&
      (reason.startsWith("cancelled by the requester") ||
        reason.startsWith("superseded") ||
        reason.startsWith("payout form was not completed") ||
        reason.startsWith("duplicate request") ||
        reason.includes("could not be opened") ||
        reason.startsWith("payout too small"))
    );
  };
  const latestRejected = !hasOpenRequest
    ? myPaymentRequests.find(
        (r) =>
          (r.status === AgentPaymentStatus.REJECTED_BY_ADMIN ||
            r.status === AgentPaymentStatus.REJECTED_BY_AGENT) &&
          !closedWithoutRejection(r) &&
          !r.requesterDismissedAt &&
          !dismissedRejectedIds.has(r.id),
      )
    : undefined;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 animate-in fade-in duration-500">
      {/* Header — page title (right-aligned) + plan badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-start gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white md:order-last">
          Affiliate Dashboard
        </h1>

        {currentPackage?.package && (
            <div className="flex items-center gap-2 bg-[#242B35] border border-white/10 rounded-xl p-3 shadow-lg hover:border-[#B93DEB]/30 transition-colors cursor-pointer"
                 onClick={() => router.push("/agent-management/agent-package-mgt")}
            >
               <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-[#B93DEB]/20 flex items-center justify-center border border-purple-500/30">
                  <span className="text-purple-400 font-bold text-lg">{currentPackage.package.name?.charAt(0)}</span>
               </div>
               <div className="px-1">
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5"> Your Current Plan</p>
                 <p className="text-sm text-white font-bold uppercase tracking-tight leading-none bg-gradient-to-r from-purple-400 to-[#B93DEB] bg-clip-text text-transparent">
                    {currentPackage.package.name}
                 </p>
               </div>
            </div>
        )}
      </div>

      <AgentDateFilters
        value={dateRange}
        onChange={setDateRange}
        onApply={(range) => {
          setDateRange(range);
          fetchData(range);
        }}
      />

      {/* Banner: pending commission-change requests for the sub-agent to review. */}
      {pendingCommissionCount > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl border border-purple-500/40 bg-purple-500/10">
          <div className="flex items-start gap-3">
            <Percent className="text-purple-400 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-white">
                {pendingCommissionCount} Commission Change Request
                {pendingCommissionCount > 1 ? "s" : ""} to review
              </p>
              <p className="text-xs text-gray-400">
                Your agent proposed a new commission rate. Approve or reject it.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/agent-management/commission-requests")}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shrink-0"
          >
            Review
          </button>
        </div>
      )}

      {/* Banner: most recent payout request was rejected — let the user retry. */}
      {latestRejected && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl border border-red-500/40 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-white">
                Payout Request Rejected
              </p>
              <p className="text-xs text-gray-400">
                Your payout request for{" "}
                <span className="text-white font-semibold">
                  {Number(latestRejected.amount).toFixed(2)}
                </span>{" "}
                was rejected
                {latestRejected.status === AgentPaymentStatus.REJECTED_BY_ADMIN
                  ? " by admin"
                  : " by your agent"}
                . The funds were returned to your withdrawable balance — you can
                submit a new request.
                {latestRejected.rejectionReason ? (
                  <>
                    {" "}
                    <span className="text-red-300">
                      {latestRejected.rejectionReason}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClaim}
              className="px-4 py-2 rounded-lg bg-[#B93DEB] hover:bg-[#A32DD4] text-white text-xs font-bold uppercase tracking-wider whitespace-nowrap"
            >
              Request Again
            </button>
            <button
              onClick={() => dismissRejected(latestRejected.id)}
              className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Banner: requests that still need payout details linked at the provider.
          Details are now collected right after the claim, so this covers anyone
          who closed the hosted page before finishing — at ANY pre-release status,
          including PENDING_AGENT. `paymentDetails` alone isn't proof: a sub-agent
          request is created with `{ provider }` already set, so check for the
          real destination (page id / payout id / bank / wallet). */}
      {myPaymentRequests.filter(showDetailsBanner).length > 0 && (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-[#B93DEB]/40 bg-[#B93DEB]/10">
          {myPaymentRequests
            .filter(showDetailsBanner)
            .map((r) => (
              <div
                key={r.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-[#B93DEB] mt-0.5 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-white">
                      Action Required — Add Payment Details
                    </p>
                    <p className="text-xs text-gray-400">
                      Your payout request for{" "}
                      <span className="text-white font-semibold">
                        {Number(r.amount).toFixed(2)}
                      </span>{" "}
                      has no payout destination yet. Add it to send the request
                      on for approval.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => void openPayoutPage(r)}
                    className="px-4 py-2 rounded-lg bg-[#B93DEB] hover:bg-[#A32DD4] text-white text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                  >
                    Add Details
                  </button>
                  {/* Cancels for real: the funds are frozen from the moment of
                      the claim, so merely hiding this banner would strand them
                      (a new claim is refused while a request is open). */}
                  <button
                    onClick={() => void cancelRequest(r.id)}
                    disabled={cancellingId === r.id}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Cancel this request and return the funds"
                  >
                    {cancellingId === r.id ? "Cancelling" : "Cancel Request"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Status: details are linked, now waiting on the parent agent. Requests
          still missing a destination show in the "Add Payment Details" banner
          above instead, so the two never both claim the same request. */}
      {myPaymentRequests.filter(
        (r) =>
          r.status === AgentPaymentStatus.PENDING_AGENT && !needsPayoutDetails(r),
      ).length > 0 && (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10">
          {myPaymentRequests
            .filter(
              (r) =>
                r.status === AgentPaymentStatus.PENDING_AGENT &&
                !needsPayoutDetails(r),
            )
            .map((r) => (
              <div key={r.id} className="flex items-start gap-3">
                <Clock className="text-yellow-400 mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-bold text-white">
                    Awaiting Agent Approval
                  </p>
                  <p className="text-xs text-gray-400">
                    Payout details added. Your request for{" "}
                    <span className="text-white font-semibold">
                      {Number(r.amount).toFixed(2)}
                    </span>{" "}
                    is with your parent agent — once they approve, an admin
                    releases the payment.
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Status: pending-admin requests whose payout details are CONFIRMED.
          `paymentDetails` is set the moment the Breeze/Coinflow page opens, so
          checking it alone showed "Awaiting Admin Approval" right beside the
          "Add Payment Details" banner for the same unfinished request. */}
      {myPaymentRequests.filter((r) => r.status === AgentPaymentStatus.PENDING_ADMIN && !needsPayoutDetails(r)).length > 0 && (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-blue-500/40 bg-blue-500/10">
          {myPaymentRequests
            .filter((r) => r.status === AgentPaymentStatus.PENDING_ADMIN && !needsPayoutDetails(r))
            .map((r) => (
              <div key={r.id} className="flex items-start gap-3">
                <Clock className="text-blue-400 mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-bold text-white">
                    Awaiting Admin Approval
                  </p>
                  <p className="text-xs text-gray-400">
                    Payment details submitted for{" "}
                    <span className="text-white font-semibold">
                      {Number(r.amount).toFixed(2)}
                    </span>
                    . Admin will process payout.
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Status: admin approved — payout is being released */}
      {myPaymentRequests.filter((r) => r.status === AgentPaymentStatus.ADMIN_APPROVED).length > 0 && (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-green-500/40 bg-green-500/10">
          {myPaymentRequests
            .filter((r) => r.status === AgentPaymentStatus.ADMIN_APPROVED)
            .map((r) => (
              <div key={r.id} className="flex items-start gap-3">
                <CheckCircle2 className="text-green-400 mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-bold text-white">
                    Payout Approved
                  </p>
                  <p className="text-xs text-gray-400">
                    Your payout for{" "}
                    <span className="text-white font-semibold">
                      {Number(r.amount).toFixed(2)}
                    </span>{" "}
                    has been approved by admin and is being released to your
                    selected payout method.
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Primary Stats section */}
      <AgentStats
        stats={stats}
        isLoading={isLoading}
        onClaim={handleClaim}
        isClaiming={isClaiming}
      />

      {/* Tabs Navigation */}
      <Tabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        lockedKeys={[]}
      />

      {/* Tab Content */}
      {/* Keyed on the range so tabs that fetch their own data (rewards,
          settlements) reload when the date filter changes. */}
      <div
        key={`${dateRange.fromDate?.getTime() ?? ""}-${dateRange.toDate?.getTime() ?? ""}`}
        className="space-y-6 md:space-y-8 lg:min-h-[400px]"
      >
        {/* Dashboard tab (Growth Velocity chart) — hidden for now.
        {activeTab === "dashboard" && (
          <AgentOverview
            stats={stats}
            earnings={earnings}
            isLoading={isLoading}
            activePeriod={period}
            onPeriodChange={setPeriod}
          />
        )}
        */}

        {activeTab === "rewards" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Wallet split: Withdrawable + Frozen + Settlement History */}
            <WalletOverview
              stats={stats}
              isLoading={isLoading}
              onClaim={handleClaim}
              isClaiming={isClaiming}
            />

            {/* Earnings transaction table (Daily Earnings Overview) — hidden per request.
                Re-enable by uncommenting; data pipeline (earnings) still loads. */}
            {/* <MyRewards
              stats={stats}
              isLoading={isLoading}
              earnings={earnings}
            /> */}
          </div>
        )}


        {activeTab === "team" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ReferralPromotion agentCode={stats?.referralCode || ""} />
            <div className="space-y-4">
              <DownlineTable
                heading={
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white pl-1">
                      Recent Referrals
                    </h3>
                    {!access.canCreateSubAgent && <FeatureBadge />}
                  </div>
                }
                referrals={stats?.referrals || []}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}

        {activeTab === "earnings" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#191D24] p-4 sm:p-6 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Detailed Revenue Analysis
                  </h3>
                </div>
                <div className="h-60 sm:h-[300px]">
                  <EarningsChart earnings={earnings} isLoading={isLoading} />
                </div>
              </div>
            </div>
        )}

        {activeTab === "rules" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <CommissionCalculator stats={stats} />
              <PlatformFeeTransparency />
            </div>

            <div className="bg-[#191D24] p-4 rounded-lg border border-white/5 h-fit relative overflow-hidden shadow-2xl">
              {/* Decorative Purple Blob */}
              <div className="absolute top-0 right-0 w-80 h-80  -mr-40 -mt-40" />

              <div className="relative z-10">
                <h3 className="text-purple-500 font-bold text-sm uppercase rounded mb-2 tracking-wider flex items-center gap-2">
                  My Commission Rates
                  <InfoTip
                    title="My Commission Rates"
                    description="What NGR means and how your commission is paid."
                  >
                    <p>
                      <span className="text-white font-bold">NGR (Net Gaming Revenue)</span>{" "}
                      is what the casino actually keeps from your referred
                      players: their losses minus their wins. Your commission
                      is a percentage of this — not of the amount wagered.
                    </p>
                    <p>
                      <span className="text-white font-bold">Per category:</span>{" "}
                      each game category below has its own rate. A package
                      plan can add a bonus percentage on top of your base rate.
                    </p>
                    <p>
                      <span className="text-white font-bold">Platform fees</span>{" "}
                      are then deducted from that commission (see the Platform
                      Fee Deductions card) — all amounts you see in the portal
                      are already NET of fees.
                    </p>
                    <p className="text-gray-500">
                      If your players win overall in a period, there is no NGR
                      — so no commission accrues for those rounds.
                    </p>
                  </InfoTip>
                </h3>
                {(stats as any)?.commissionMode === "FLAT" ? (
                  <>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4 max-w-sm">
                      You are on a <span className="text-purple-400 font-bold">flat commission</span> —
                      one rate on every game, regardless of category.
                    </p>
                    <div className="mb-6 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                      <span className="text-sm text-gray-300 font-bold uppercase tracking-wider">
                        Flat rate — all games
                      </span>
                      <span className="text-2xl font-semibold text-[#B93DEB] italic tracking-tight">
                        {Number((stats as any)?.flatCommissionRate || 0).toFixed(1)}%
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm">
                    You earn the following percentages from the net losses of your
                    referred players, based on game category.
                  </p>
                )}

                <div className="mb-6 rounded-lg border border-white/5 bg-[#242B35] p-4 space-y-3">
                  <p className="text-[11px] text-gray-300 leading-tight flex items-start gap-2">
                    <span className="text-[#B93DEB] font-bold text-xs">
                      *
                    </span>
                    Sub-agent network earnings remain frozen for 7 days before
                    becoming withdrawable.
                  </p>
                  <p className="text-[11px] text-gray-300 leading-tight flex items-start gap-2">
                    <span className="text-[#B93DEB] font-bold text-xs">
                      *
                    </span>
                    Approved payout requests move into processing and are
                    completed after a 45-day lock period.
                  </p>
                </div>

                <div className="space-y-2">
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-16 bg-white/5 animate-pulse rounded-2xl"
                        />
                      ))}
                    </div>
                  ) : stats?.commissions && stats.commissions.length > 0 ? (
                    <div className="space-y-2">
                      {stats.commissions.map((comm) => {
                        // FLAT mode: single rate everywhere, package plan bonuses do not apply.
                        const isFlatMode =
                          (stats as any)?.commissionMode === "FLAT" || (comm as any)?.isFlat;
                        const pkgRates = isFlatMode
                          ? {}
                          : currentPackage?.package?.features?.ggrRates || {};
                        const commSlugUnderscore = comm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                        const commSlugDash = comm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

                        const pkgRate =
                          pkgRates[comm.name] ||
                          pkgRates[comm.name.toLowerCase()] ||
                          pkgRates[commSlugUnderscore] ||
                          pkgRates[commSlugDash] ||
                          0;

                        const totalRate = Number(comm.rate || 0) + Number(pkgRate);
                        
                        return (
                        <div
                          key={comm.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#242B35] border border-white/5 group hover:border-[#B93DEB]/30 transition-all shadow-lg active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg text-gray-200 font-bold group-hover:text-white transition-colors">
                              {comm.name}
                            </span>
                            {pkgRate > 0 && (
                              <span className="text-[11px] text-gray-500 font-medium tracking-tight bg-white/5 px-2 py-0.5 rounded-full">
                                {Number(comm.rate || 0).toFixed(1)}% base + <span className="text-green-500">{Number(pkgRate).toFixed(1)}% plan</span>
                              </span>
                            )}
                            {/* Sub-agents: the rate on their account is not always
                                what they earn — it is capped at what their agent is
                                entitled to on this category. Saying so is the
                                difference between a rate that looks wrong and one
                                that is explained. */}
                            {comm.cappedByParent && (
                              <span className="text-[11px] text-amber-400/90 font-medium tracking-tight bg-amber-500/10 px-2 py-0.5 rounded-full">
                                {Number(comm.assignedRate || 0).toFixed(1)}% assigned — capped by your agent
                              </span>
                            )}
                          </div>
                          <span className="text-lg font-bold text-[#B93DEB] tracking-tight">
                            {totalRate.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-white/5 rounded-[32px] border border-dashed border-white/10">
                      <p className="text-sm text-gray-500">
                        Commission structure not yet assigned.
                      </p>
                    </div>
                  )}

                  <div className="mt-5 pt-2 border-t border-white/5">
                    <p className="text-[11px] text-gray-500 leading-tight flex items-start gap-2">
                      <span className="text-[#B93DEB] font-bold text-xs">
                        *
                      </span>
                      Commissions are calculated based on Net Profit (Losses)
                      and updated in real-time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "claimhistory" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ClaimHistory refreshSignal={claimHistoryKey} range={dateRange} />
          </div>
        )}

        {activeTab === "payoutrequests" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Keyed off the same counter as Claim History so raising or
                cancelling a request refetches the list instead of showing a
                stale one. */}
            <MyPayoutRequests refreshSignal={claimHistoryKey} range={dateRange} />
          </div>
        )}

        {activeTab === "downloadbanner" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DownloadBanners />
          </div>
        )}
      </div>

      <RequestPayoutModal
        isOpen={requestPayoutOpen}
        onClose={() => setRequestPayoutOpen(false)}
        onCreated={() => {
          // Balance moved to hold and a request now exists — refresh both now,
          // silently: the socket events that follow (auto-approval) refresh
          // again, and a loader each time read as the screen reloading.
          void fetchMyPaymentRequests();
          void fetchData(undefined, { silent: true });
          setClaimHistoryKey((k) => k + 1);
        }}
        maxAmount={stats?.availableBalance ?? undefined}
      />

      {/* Coinflow destination picker for an existing request. Closing it submits
          nothing — the request keeps its "Add Payment Details" banner. */}
      {coinflowDetails && (
        <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-[#191D24] w-full max-w-md rounded-lg border border-white/5 shadow-2xl relative animate-in zoom-in-90 duration-300 max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
            <button
              onClick={() => setCoinflowDetails(null)}
              className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <CoinflowLinkWaiter
              payoutId={coinflowDetails.payoutId}
              url={coinflowDetails.url}
              amount={Number(
                myPaymentRequests.find(
                  (r) => r.id === coinflowDetails.requestId,
                )?.amount ?? 0,
              )}
              openedAutomatically
              onConfirmed={() => {
                setCoinflowDetails(null);
                void fetchMyPaymentRequests();
                setClaimHistoryKey((k) => k + 1);
              }}
              onClose={() => setCoinflowDetails(null)}
            />
          </div>
        </div>
      )}

      {detailsModalRequest && (
        <PaymentDetailsModal
          request={detailsModalRequest}
          isOpen={!!detailsModalRequest}
          onClose={() => {
            const id = detailsModalRequest.id;
            setDismissedDetailIds((prev) => {
              const next = new Set(prev);
              next.add(id);
              persistDismissed(next);
              return next;
            });
            setDetailsModalRequest(null);
          }}
          onSubmitted={() => {
            setDetailsModalRequest(null);
            fetchMyPaymentRequests();
          }}
        />
      )}

      {showClaimSuccess && (
        <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
          {/* max-h + scroll: the celebration card is tall enough on a phone that
              its close button used to sit past the bottom of the viewport. */}
          <div className="bg-[#191D24] w-full max-w-md rounded-lg border border-white/5 shadow-2xl overflow-hidden relative animate-in zoom-in-90 duration-500 max-h-[92dvh] overflow-y-auto">
            {/* Decorative blobs */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-600/20 blur-[80px] -mt-32 pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-green-500/10 blur-[60px] pointer-events-none" />

            {/* Close button */}
            <button
              onClick={() => setShowClaimSuccess(false)}
              className="absolute top-5 right-5 z-20 p-2 rounded-2xl bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center text-center px-5 py-8 sm:px-10 sm:py-14 gap-5 sm:gap-6">
              {/* Icon ring */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                  <CheckCircle2 size={48} className="text-green-400" />
                </div>
                {/* Sparkle dots */}
                <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-bounce" />
                <div className="absolute -bottom-1 -left-3 w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse" />
              </div>

              {/* Title */}
              <div>
                <p className="text-[10px] font-bold uppercase text-green-500 mb-2">
                  Claim Successful
                </p>
                <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center justify-center gap-2">
                  <PartyPopper size={28} className="text-yellow-400" />
                  {claimSuccessTitle}
                </h3>
              </div>

              {/* Amount */}
              {showClaimAmount && (
                <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-6 px-8">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">
                    Amount Settled
                  </p>
                  <p className="text-xl font-bold text-white tracking-tight">
                    {(claimSuccessAmount || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-2 uppercase font-bold">
                    WulfCash
                  </p>
                </div>
              )}

              {/* Info */}
              <p className="text-gray-500 text-xs leading-relaxed max-w-xs">
                {claimSuccessMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Page = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardContent />
    </Suspense>
  );
};

export default Page;
