"use client";

import { useEffect, useState } from "react";
import {
  ActivePlatformFee,
  platformFeeApi,
} from "@/api/platform-fee/platform-fee.api";
import { InfoTip } from "./InfoTip";

const TYPE_LABELS: Record<string, string> = {
  PLATFORM: "Platform Fee",
  GAME: "Game Fee",
  PROMOTION: "Promotion Charge",
  OTHER: "Other Charge",
};

/**
 * Agent/sub-agent transparency card (TC4): every active platform fee with its
 * percentage and reason. Commissions shown across the portal are NET of these
 * deductions; each earning row also stores its own immutable breakdown.
 */
export function PlatformFeeTransparency() {
  const [fees, setFees] = useState<ActivePlatformFee[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    platformFeeApi
      .listActive()
      .then((res) => setFees(res.data || []))
      .catch(() => setFees([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || fees.length === 0) return null;

  const globalTotal = fees
    .filter((f) => !f.appliesTo)
    .reduce((s, f) => s + Number(f.percent), 0);

  return (
    <div className="bg-[#11141D] p-4 rounded-lg border border-white/5 relative overflow-hidden shadow-2xl mt-8">
      <h3 className="text-purple-500 font-bold text-sm uppercase rounded mb-2 tracking-wider flex items-center gap-2">
        Platform Fee Deductions
        <InfoTip
          title="Platform Fee Deductions"
          description="How platform charges apply to your commissions."
        >
          <p>
            Platform fees are the platform&apos;s share of the GGR (the house
            result on your players) — they cover game provider, licensing and
            infrastructure costs.
          </p>
          <p>
            <span className="text-white font-bold">They apply automatically</span>{" "}
            the moment a commission is earned. The fee percentage is charged on
            the GGR, not on your commission. Fees marked with a game category
            (e.g. &quot;Slots only&quot;) are charged only on rounds from that
            category; all other fees apply to every round.
          </p>
          <p>
            <span className="text-white font-bold">Worked example:</span> your
            player loses 100 (GGR = 100), your rate is 15% → commission before
            fees = <span className="text-white">15.00</span>. A 10% platform fee
            is 10% of the GGR = <span className="text-white">10.00</span>, so{" "}
            <span className="text-green-400 font-bold">5.00</span> is credited to
            your wallet.
          </p>
          <p className="text-gray-500">
            Fees are charged only on positive commissions and are capped at the
            commission (your payout never goes below 0). Every earning keeps a
            permanent record of exactly what was deducted and why.
          </p>
        </InfoTip>
      </h3>
      <p className="text-gray-400 text-sm leading-relaxed mb-4">
        The following platform charges are calculated on the GGR (house result)
        and deducted from your commission before it reaches your wallet. Your
        earnings and dashboard figures are shown{" "}
        <span className="text-white font-bold">after</span> these deductions.
      </p>

      <div className="space-y-2">
        {fees.map((fee) => (
          <div
            key={fee.code}
            className="flex items-start justify-between p-3 rounded-lg bg-[#1A1F2B] border border-white/5"
          >
            <div className="pr-3 sm:pr-4 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-gray-200 font-bold text-sm">{fee.name}</span>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                  {TYPE_LABELS[fee.feeType] || fee.feeType}
                  {fee.appliesTo ? ` · ${fee.appliesTo} only` : ""}
                </span>
              </div>
              {fee.reason && (
                <p className="text-[11px] text-gray-500 mt-1">{fee.reason}</p>
              )}
            </div>
            <span className="text-red-400 font-semibold italic tracking-tight whitespace-nowrap">
              −{Number(fee.percent).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-500 mt-4 flex items-start gap-2">
        <span className="text-[#B93DEB] font-bold text-xs">*</span>
        Total platform deduction on all games: {globalTotal.toFixed(1)}%
        {fees.some((f) => f.appliesTo)
          ? " (category-specific game fees apply on top for matching games)."
          : "."}{" "}
        Every earning record keeps its own fee breakdown for full transparency.
      </p>
    </div>
  );
}
