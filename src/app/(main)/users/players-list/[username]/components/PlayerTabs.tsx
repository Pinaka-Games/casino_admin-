"use client";

import { useState, useEffect } from "react";
import { useDeepLinkParam } from "@/hooks/use-deep-link-param";
// import { useAuth } from "@/context/AuthContext";

// Tabs
import BasicInfoTab from "./tabs/BasicInfoTab";
import RewardsTab from "./tabs/RewardsTab";
import WalletTab from "./tabs/WalletTab";
import SubscriptionTab from "./tabs/SubscriptionTab";
import DepositsTab from "./tabs/DepositsTab";
import WithdrawalsTab from "./tabs/WithdrawalsTab";
import ActivityTab from "./tabs/ActivityTab";
import SeonTab from "./tabs/SeonTab";
import TicketsTab from "./tabs/TicketsTab";
import ResponsibleGamingTab from "./tabs/ResponsibleGamingTab";
import RevenueTab from "./tabs/RevenueTab";
import DownlineTab from "./tabs/DownlineTab";
import ReferralCode from "./tabs/ReferralCode";
import RolloverTab from "./tabs/RolloverTab";
// import PerformanceTab from "./tabs/PerformanceTab";

/**
 * The player detail tabs, in the order they are drawn.
 *
 * Exported because the player list's action menu offers one "View …" entry per
 * tab and deep-links to it by name — keeping that list here means a tab added,
 * removed or renamed never leaves the menu pointing at something that no longer
 * exists.
 */
export const TABS = [
  "Basic Info",
  // Performance is hidden for now — the standalone page at
  // /users/player-performance still covers it. Uncomment this, the import,
  // and the panel below to bring the tab back.
  // "Performance",
  "Rewards",
  "Wallet",
  "Subscription",
  "Deposits",
  "Withdrawals",
  "Rollover",
  "SEON",
  // KYC and Devices now live under Basic Info — they are read while looking at
  // the profile, not as destinations of their own.
  "Referral Code",
  "Activity",
  "Tickets",
  "Responsible Gaming",
  // "Revenue",
  // "Downline",
] as const;

type TabType = (typeof TABS)[number];

const STORAGE_KEY = (username: string) =>
  `agent-tabs-active-${username}`;

/** Matches `?tab=` loosely — "Responsible Gaming", "responsible-gaming" and
 *  "responsiblegaming" all name the same tab, so a link can be typed by hand. */
const matchTab = (value: string | null): TabType | null => {
  if (!value) return null;
  const wanted = value.toLowerCase().replace(/[^a-z]/g, "");
  return (
    TABS.find((tab) => tab.toLowerCase().replace(/[^a-z]/g, "") === wanted) ??
    null
  );
};

/** Role names an affiliate (agent / sub-agent) session carries. */
// const AFFILIATE_ROLES = new Set(["agent", "subagent", "sub_agent", "sub-agent", "sub agent"]);

export default function PlayerTabs({ username }: { username: string }) {
  // Performance is staff-only (its endpoint refuses affiliates), so agent and
  // sub-agent sessions never see the tab. Read from the account's DB roles —
  // the JWT role claim says "admin" for every staff account and proves nothing.
  // No superadmin exception: the endpoint refuses any account with an agent /
  // sub-agent record whatever its other roles, so the tab would only 403.
  // const { user } = useAuth();
  // const roleNames = (user?.roles ?? []).map((r) => r.name?.toLowerCase() ?? "");
  // const hidePerformance = roleNames.some((name) => AFFILIATE_ROLES.has(name));
  // const visibleTabs = TABS.filter((tab) => tab !== "Performance" || !hidePerformance);
  const visibleTabs = TABS;

  const [active, setActive] = useState<TabType>(() => {
    if (typeof window === "undefined") return "Basic Info";
    const stored = localStorage.getItem(STORAGE_KEY(username));
    return (stored as TabType) || "Basic Info";
  });

  /**
   * `?tab=Activity` wins over the remembered tab.
   *
   * Arriving from "View Activity Log" has to land on Activity even though this
   * player's last-visited tab is stored — the link states an intent, the
   * storage only guesses one. Applied in an effect rather than the initial
   * state because the hook reads nothing on the first render by design.
   */
  const requestedTab = useDeepLinkParam("tab");
  useEffect(() => {
    const tab = matchTab(requestedTab);
    if (tab) setActive(tab);
  }, [requestedTab]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY(username), active);
  }, [active, username]);

  // A remembered tab or a ?tab= link can still name a tab that is no longer
  // drawn (Performance, and anything else commented out of TABS); those land
  // on Basic Info instead of an empty panel.
  const shownTab: TabType = (TABS as readonly string[]).includes(active)
    ? active
    : "Basic Info";

  return (
    <div className="bg-[#161A21] rounded-xl p-3 md:p-6">
      {/* TAB HEADERS */}
      <div className="-mx-3 flex gap-4 border-b border-white/10 px-3 pb-3 overflow-x-auto scrollbar-hide md:mx-0 md:gap-6 md:px-0">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`relative pb-2 text-sm font-medium transition whitespace-nowrap
              ${
                shownTab === tab
                  ? "text-[#B93DEB]"
                  : "text-white/70 hover:text-white"
              }
            `}
          >
            {tab}

            {shownTab === tab && (
              <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#B93DEB]" />
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="pt-4 md:pt-6">
        {shownTab === "Basic Info" && <BasicInfoTab username={username} />}
        {/* {shownTab === "Performance" && <PerformanceTab username={username} />} */}
        {shownTab === "Rewards" && <RewardsTab username={username} />}
        {shownTab === "Wallet" && <WalletTab />}
        {shownTab === "Subscription" && <SubscriptionTab username={username} />}
        {shownTab === "Deposits" && <DepositsTab username={username} />}
        {shownTab === "Withdrawals" && <WithdrawalsTab username={username} />}
        {shownTab === "Rollover" && <RolloverTab username={username} />}
        {shownTab === "Activity" && <ActivityTab username={username} />}
        {shownTab === "SEON" && <SeonTab username={username} />}
        {shownTab === "Referral Code" && <ReferralCode username={username} />}
        {shownTab === "Tickets" && <TicketsTab username={username} />}
        {shownTab === "Responsible Gaming" && (
          <ResponsibleGamingTab username={username} />
        )}
        {/* {active === "Revenue" && <RevenueTab />}
        {active === "Downline" && <DownlineTab />} */}
      </div>
    </div>
  );
}
