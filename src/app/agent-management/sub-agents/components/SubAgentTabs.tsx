"use client";

import { useState, useEffect } from "react";

// Dedicated Sub-Agent Tab Components
import SubAgentBasicInfoTab from "./tabs/SubAgentBasicInfoTab";
import SubAgentWalletTab from "./tabs/SubAgentWalletTab";
import SubAgentRevenueTab from "./tabs/SubAgentRevenueTab";
import SubAgentDownlineTab from "./tabs/SubAgentDownlineTab";

const TABS = ["Basic Info", "Wallet", "Revenue", "Downline"] as const;
type TabType = (typeof TABS)[number];

const STORAGE_KEY = (id: string) => `sub-agent-tabs-active-${id}`;

interface SubAgentUser {
  id: string;
  username: string;
  name?: string;
  displayName?: string;
  email?: string;
  isActive: boolean;
  referralCode?: string;
  commissionPercentage?: number;
  joinedAt?: string;
  totalEarnings?: number;
  availableBalance?: number;
  freezePending?: number;
  // Consumed by the Basic Info / Wallet tabs.
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  isBlocked?: boolean;
  isFrozen?: boolean;
}

export default function SubAgentTabs({ user }: { user: SubAgentUser }) {
  const [active, setActive] = useState<TabType>(() => {
    if (typeof window === "undefined") return "Basic Info";
    const stored = localStorage.getItem(STORAGE_KEY(user.id));
    return (stored as TabType) || "Basic Info";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY(user.id), active);
  }, [active, user.id]);

  return (
    <div className="bg-[#161A21] rounded-xl p-3 sm:p-6">
      {/* TAB HEADERS */}
      <div className="flex gap-4 sm:gap-6 border-b border-white/10 pb-3 overflow-x-auto scrollbar-hide agent-x-scroll">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`relative pb-2 text-sm font-medium transition whitespace-nowrap
              ${active === tab ? "text-[#B93DEB]" : "text-white/70 hover:text-white"}
            `}
          >
            {tab}
            {active === tab && (
              <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#B93DEB]" />
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="pt-4 sm:pt-6">
        {active === "Basic Info" && (
          <SubAgentBasicInfoTab user={user} />
        )}
        {active === "Wallet" && (
          <SubAgentWalletTab user={user} />
        )}
        {active === "Revenue" && (
          <SubAgentRevenueTab subAgentId={user.id} />
        )}
        {active === "Downline" && (
          <SubAgentDownlineTab subAgentId={user.id} />
        )}
      </div>
    </div>
  );
}
