import { useAgentPackageStore } from "@/store/agent-package.store";
import { useMemo } from "react";

// Normalize a key: lowercase, strip spaces/dashes/underscores
const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

/**
 * Fuzzy-lookup a feature value from the features object.
 * Tries exact match first, then normalized match.
 */
function getFeature(features: Record<string, any>, key: string): any {
  // Exact match
  if (key in features) return features[key];
  // Normalized match
  const nk = norm(key);
  for (const k of Object.keys(features)) {
    if (norm(k) === nk) return features[k];
  }
  return undefined;
}

export function useFeatureAccess() {
  const { currentPackage, packagingDisabled, packageFetched, packageUnavailable } =
    useAgentPackageStore();

  const features: Record<string, any> = currentPackage?.package?.features
    ? (currentPackage.package.features as any)
    : {};

  const f = (key: string) => getFeature(features, key);

  const rawSubAgents = currentPackage?.package?.subAgents;
  // "No package" (null after fetch) is a valid final state — e.g. when the
  // admin disabled all packages — so loading completes on fetch, not on
  // a non-null package.
  //
  // But when the package request FAILED (API down / 5xx) we know nothing about
  // the plan. Reporting "loaded" there would let every gate fall through to its
  // locked state and show a paying agent the "update your plan" upsell just
  // because the backend was unreachable. Stay unloaded so gates render their
  // loading state instead.
  const isLoaded =
    !packageUnavailable &&
    (packageFetched || (currentPackage !== null && currentPackage !== undefined));

  return useMemo(() => {
    // Packaging globally disabled by admin → NO package rules apply.
    // Every feature is open and no limits are enforced (mirrors the backend:
    // checkFeatureAccess/enforceSubAgentLimit return "allowed" in this state).
    if (packagingDisabled) {
      return {
        isLoaded: true,
        planName: "No Plan (packages disabled)",
        isStarter: false,
        isPremium: false,
        isSignature: true,
        canCreateSubAgent: true,
        subAgentLimit: Infinity,
        isUnlimitedSubAgents: true,
        dashboardLevel: "Full",
        canViewReferralLink: true,
        canViewClaimHistory: true,
        canViewWalletTransactions: true,
        canViewSettlementHistory: true,
        canViewPayoutHistory: true,
        canWithdraw: true,
        withdrawalsPriority: true,
        canViewDailyEarnings: true,
        dailyEarningsAdvanced: true,
        canCreateBonusCampaign: true,
        canViewAnalytics: true,
        analyticsLevel: "Full",
        canExportReports: true,
        canViewWinLoss: true,
        canManagePromoCodes: true,
      };
    }
    // ── Plan Helpers ─────────────────────────────────────────────
    const planName = currentPackage?.package?.name || "Starter"; // Default to Starter if no plan
    const isStarter = planName.includes("Starter");
    const isPremium = planName.includes("Premium");
    const isSignature = planName.includes("Signature");

    // ── Sub-Agents ──────────────────────────────────────────────
    const subAgentFeature = f("Sub-Agent Creation") ?? f("Sub Agent Creation");
    const isSubAgentFeatureDisabled = subAgentFeature === false;

    const limitStr = rawSubAgents ?? (isStarter ? "1" : isPremium ? "5" : isSignature ? "unlimited" : "0");
    const isUnlimitedSubAgents =
      limitStr === "unlimited" ||
      limitStr === "-1" ||
      (typeof limitStr === "number" && (limitStr === -1 || limitStr === 0));
    const limitNum = parseInt(String(limitStr), 10);
    
    // Check both the explicitly disabled toggle AND the sub-agent limit
    const canCreateSubAgent = isSubAgentFeatureDisabled ? false : (isUnlimitedSubAgents || (!isNaN(limitNum) && limitNum > 0));
    const subAgentLimit = isSubAgentFeatureDisabled ? 0 : (isUnlimitedSubAgents ? Infinity : (isNaN(limitNum) ? 0 : limitNum));

    // ── Dashboard level ──────────────────────────────────────────
    const dashboardRaw = f("Dashboard");
    const dashboardLevel: string =
      typeof dashboardRaw === "string" ? dashboardRaw
      : isSignature ? "Full"
      : isPremium ? "Advanced"
      : "Basic";

    // ── Referral Link ────────────────────────────────────────────
    const referralRaw = f("Referral Link") ?? f("Player Referral Tracking");
    const canViewReferralLink: boolean = referralRaw !== false; // Active for all by default

    // ── Claim History ────────────────────────────────────────────
    const claimRaw = f("Claim History");
    const canViewClaimHistory: boolean = claimRaw !== false; // Active for all by default

    // ── Wallet Transactions (Commission Deposits) ────────────────
    const walletRaw = f("Wallet Transactions") ?? f("Wallet Transaction") ?? f("Commission Deposit");
    const canViewWalletTransactions: boolean = walletRaw !== undefined ? (walletRaw === true || walletRaw === "Full") : (isPremium || isSignature);
    
    const settlementRaw = f("Settlement History") ?? f("Wallet History");
    const canViewSettlementHistory: boolean = settlementRaw !== undefined ? (settlementRaw === true || settlementRaw === "Full") : isSignature;

    // ── Withdrawals (Payout Requests) ───────────────────────────
    const withdrawalsRaw = f("Withdrawals") ?? f("Withdrawal") ?? f("Payout Requests");
    const canWithdraw: boolean = withdrawalsRaw !== undefined ? (withdrawalsRaw === true || withdrawalsRaw === "Enabled") : (isPremium || isSignature);
    
    const payoutHistoryRaw = f("Payout History") ?? f("Settlement Records");
    const canViewPayoutHistory: boolean = payoutHistoryRaw !== undefined ? (payoutHistoryRaw === true || payoutHistoryRaw === "Full") : isSignature;
    
    const withdrawalsPriority: boolean = withdrawalsRaw === "Priority" || isSignature;

    // ── Daily Earnings ───────────────────────────────────────────
    const dailyEarningsRaw = f("Daily Earnings") ?? f("DailyEarnings");
    const canViewDailyEarnings: boolean = dailyEarningsRaw !== undefined ? (dailyEarningsRaw === true || dailyEarningsRaw === "Full") : isSignature;
    const dailyEarningsAdvanced: boolean = dailyEarningsRaw === "Advanced" || isSignature;

    // ── Bonus Campaign ───────────────────────────────────────────
    const bonusRaw = f("Bonus Campaign") ?? f("BonusCampaign");
    const canCreateBonusCampaign: boolean = bonusRaw !== undefined ? (bonusRaw === true) : isSignature;

    // ── Analytics ────────────────────────────────────────────────
    const analyticsRaw = f("Analytics");
    const canViewAnalytics: boolean = analyticsRaw !== undefined ? (analyticsRaw === "Full" || analyticsRaw === "Limited") : isSignature;
    const analyticsLevel: string =
      analyticsRaw === "Full" || isSignature ? "Full"
      : analyticsRaw === "Limited" || isPremium ? "Limited"
      : "None";

    // ── Export Reports ───────────────────────────────────────────
    const exportRaw = f("Export Reports") ?? f("ExportReports");
    const canExportReports: boolean = exportRaw !== undefined ? (exportRaw === true) : isSignature;

    // ── Promo Codes ──────────────────────────────────────────────
    const promoRaw = f("Promo Codes") ?? f("Agent Promo Code") ?? f("Standard Promo Codes");
    const canManagePromoCodes: boolean = promoRaw !== undefined ? (promoRaw === true) : (isPremium || isSignature);

    // ── Legacy ───────────────────────────────────────────────────
    const canViewWinLoss = canViewAnalytics;

    return {
      isLoaded,
      planName,
      isStarter,
      isPremium,
      isSignature,
      canCreateSubAgent,
      subAgentLimit,
      isUnlimitedSubAgents,
      dashboardLevel,
      canViewReferralLink,
      canViewClaimHistory,
      canViewWalletTransactions,
      canViewSettlementHistory,
      canViewPayoutHistory,
      canWithdraw,
      withdrawalsPriority,
      canViewDailyEarnings,
      dailyEarningsAdvanced,
      canCreateBonusCampaign,
      canViewAnalytics,
      analyticsLevel,
      canExportReports,
      canViewWinLoss,
      canManagePromoCodes,
    };
  }, [features, rawSubAgents, isLoaded, packagingDisabled, packageUnavailable]);
}
