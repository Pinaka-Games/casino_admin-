"use client";

import { useState, useEffect } from "react";
import { referralApi } from "@/api/referral/referral.api";
import { UserWithProfile } from "@/types/profile.type";
import { useAgentPackagingEnabled } from "@/hooks/use-agent-packaging";

// Tabs
import BasicInfoTab from "./tabs/BasicInfoTab";
import WalletTab from "./tabs/WalletTab";
import SubscriptionTab from "./tabs/SubscriptionTab";
import RevenueTab from "./tabs/RevenueTab";
import DownlineTab from "./tabs/DownlineTab";
import PayoutRequestTab from "./tabs/PayoutRequestTab";
import CommissionLedgerTab from "./tabs/CommissionLedgerTab";
import SubAgentTab from "./tabs/SubAgentTab";

const TABS = [
  "Basic Info",
  "Wallet",
  "Agent Plan",
  "Sub Agents",
  "Revenue",
  // Per-round commission ledger — the same view the agent has in their own
  // portal, so support can answer "why did this round pay that" without
  // asking the agent to read it out.
  "Commission Ledger",
  "Downline",
  "Payout Request",
] as const;

type TabType = (typeof TABS)[number];

const STORAGE_KEY = (userId: string) => `agent-tabs-active-${userId}`;

export default function AgentTabs({
  user,
  onViewSubAgent,
  isSubAgentView,
}: {
  user: UserWithProfile;
  onViewSubAgent?: (id: string) => void;
  isSubAgentView?: boolean;
}) {
  const [active, setActive] = useState<TabType>(() => {
    if (typeof window === "undefined") return "Basic Info";
    const stored = localStorage.getItem(STORAGE_KEY(user.id));
    return (stored as TabType) || "Basic Info";
  });
  const agentLookupId = user.agent?.id || (user as any).agentRecordId || user.id;
  const [subAgentCount, setSubAgentCount] = useState<number>(
    user.subAgentsCount ?? 0,
  );

  // With the package catalog switched off there is no plan in force — the
  // agent's subscription grants nothing and every feature gate is lifted — so
  // the tab was showing an "Agent Plan" the platform is not actually applying.
  // `null` (still loading / lookup failed) keeps the tab, so a hiccup never
  // hides a working screen.
  const packagingEnabled = useAgentPackagingEnabled();
  const hidePlanTab = packagingEnabled === false;

  const isHidden = (tab: TabType) =>
    (hidePlanTab && tab === "Agent Plan") ||
    (!!isSubAgentView && (tab === "Agent Plan" || tab === "Sub Agents"));

  // The selected tab is remembered per agent, so an admin who was last on
  // "Agent Plan" (or on "Sub Agents" before opening a sub-agent) could restore
  // a tab that is no longer in the header and land on an empty panel with
  // nothing selected. Derive the effective tab rather than correcting state.
  const activeTab: TabType = isHidden(active) ? "Basic Info" : active;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY(user.id), activeTab);
  }, [activeTab, user.id]);

  useEffect(() => {
    let mounted = true;

    const fetchSubAgentCount = async () => {
      try {
        const response = await referralApi.getSubAgents(agentLookupId);
        if (!mounted) return;
        setSubAgentCount(Array.isArray(response.data) ? response.data.length : 0);
      } catch {
        if (!mounted) return;
        setSubAgentCount(user.subAgentsCount ?? 0);
      }
    };

    fetchSubAgentCount();

    return () => {
      mounted = false;
    };
  }, [agentLookupId, user.subAgentsCount]);

  return (
    <div className="bg-[#161A21] rounded-xl p-3 md:p-6">
      {/* TAB HEADERS */}
      <div className="-mx-3 flex gap-4 border-b border-white/10 px-3 pb-3 overflow-x-auto scrollbar-hide md:mx-0 md:gap-6 md:px-0">
        {TABS.filter((tab) => !isHidden(tab)).map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`relative pb-2 text-sm font-medium transition whitespace-nowrap
              ${
                activeTab === tab
                  ? "text-[#B93DEB]"
                  : "text-white/70 hover:text-white"
              }
            `}
          >
            {tab}
            {tab === "Sub Agents" && (
              <span className=" rounded-full bg-[#B93DEB]/20 text-[#B93DEB]">
                {/* {subAgentCount} */}
              </span>
            )}

            {activeTab === tab && (
              <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#B93DEB]" />
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="pt-4 md:pt-6">
        {activeTab === "Basic Info" && <BasicInfoTab user={user} />}
        {activeTab === "Wallet" && <WalletTab agent={user} />}
        {activeTab === "Agent Plan" && <SubscriptionTab userId={user.id} />}
        {activeTab === "Revenue" && <RevenueTab agent={user} />}
        {activeTab === "Commission Ledger" && (
          <CommissionLedgerTab agent={user} />
        )}
        {activeTab === "Downline" && <DownlineTab userId={user.id} />}
        {activeTab === "Payout Request" && <PayoutRequestTab agent={user} />}
        {activeTab === "Sub Agents" && (
          <SubAgentTab agent={user} onViewSubAgent={onViewSubAgent} />
        )}
      </div>
    </div>
  );
}
