"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
const TABS = [
  { href: "/wallet/rollover-calculator", label: "Current (our backend)" },
  { href: "/wallet/rollover-calculator/stake", label: "Stake" },
];

/**
 * Switch between the two rollover simulators. They are separate pages with
 * separate engines on purpose — the current one is a strict mirror of the
 * backend and must not pick up "what if" rules from the other.
 */
export default function ModelTabs() {
  const pathname = usePathname() ?? "";
  return (
    <div className="flex w-fit rounded-md bg-[#191D24] p-1">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded px-4 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-[#7C3AED] text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
