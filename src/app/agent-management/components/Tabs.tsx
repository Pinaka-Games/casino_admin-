"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  BookOpen,
  Wallet,
  ShieldCheck,
  Download,
  History,
  Banknote
} from "lucide-react";

export type TabKey =
  | "dashboard"
  | "rewards"
  | "team"
  | "earnings"
  | "rules"
  | "claimhistory"
  | "payoutrequests"
  | "downloadbanner";

const tabs: {
  key: TabKey;
  label: string;
  icon: any;
}[] = [
  // { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "rewards", label: "My Rewards", icon: Wallet },
  { key: "team", label: "My Downline", icon: Users },
  { key: "claimhistory", label: "Claim History", icon: History },
  { key: "payoutrequests", label: "Payout Requests", icon: Banknote },
  { key: "rules", label: "Rules & Tips", icon: BookOpen },
  { key: "downloadbanner", label: "Download Banner", icon: Download },
];

export default function Tabs({
  activeTab,
  setActiveTab,
  lockedKeys = [],
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  lockedKeys?: TabKey[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ width: 0, left: 0 });

  useEffect(() => {
    const measure = () => {
      const index = tabs.findIndex(t => t.key === activeTab);
      const tab = tabRefs.current[index];
      const container = containerRef.current;

      if (tab && container) {
        setIndicator({
          width: tab.offsetWidth,
          left: tab.offsetLeft,
        });
      }
    };

    measure();

    // Tab padding and font size now change at `md`, so the measured pill has to
    // be re-read when the viewport crosses that boundary — otherwise the
    // highlight keeps the width it had at the previous breakpoint.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTab]);

  return (
    <section className="w-full">
      {/* Negative margin + matching padding lets the tab strip bleed to the
          screen edge on phones, so the last tab scrolls fully into view instead
          of being clipped mid-label by the page gutter. */}
      <div className="overflow-x-auto scrollbar-hide agent-x-scroll -mx-3 px-3 sm:mx-0 sm:px-0">
        <div
          ref={containerRef}
          className="relative inline-flex items-center gap-1 rounded-lg bg-[#191D24] p-1 min-w-max border border-gray-800"
        >
          {/* Active Tab Highlight */}
          <motion.div
            className="absolute top-1 bottom-1 rounded-lg bg-purple-600"
            animate={indicator}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />

          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              onClick={() => setActiveTab(tab.key)}
              className={`relative z-10 flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <tab.icon
                size={16}
                className={`shrink-0 transition-colors ${
                  activeTab === tab.key ? "text-white" : "text-gray-500"
                }`}
              />
              <span>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
