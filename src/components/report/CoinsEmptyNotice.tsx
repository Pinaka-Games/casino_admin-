"use client";

import { Coins } from "lucide-react";

/**
 * Shown on the "Wulf Coins" tab of reports that are inherently real-money
 * (bonuses, cashback rebates, agent commissions, redemptions). These economic
 * events never happen in virtual coins, so instead of a confusingly empty table
 * we state plainly that all the records live under Wulf Cash.
 */
export default function CoinsEmptyNotice({
  label = "records",
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#242B35] bg-[#191D24] px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#242B35] text-[#F59E0B]">
        <Coins size={22} />
      </div>
      <p className="text-sm font-medium text-gray-200">
        No Wulf Coins {label}
      </p>
      <p className="max-w-md text-xs leading-relaxed text-gray-500">
        These are real-money transactions and only ever occur in Wulf Cash.
        Switch to the <span className="text-[#03B739]">Wulf Cash</span> tab to
        see the actual figures.
      </p>
    </div>
  );
}
