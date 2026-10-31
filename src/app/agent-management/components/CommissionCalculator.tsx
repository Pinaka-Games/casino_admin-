"use client";

import { useState, useMemo, useEffect } from "react";
import { ReferralStats } from "@/types/profile.type";
import { useAgentPackageStore } from "@/store/agent-package.store";
import {
  ActivePlatformFee,
  platformFeeApi,
} from "@/api/platform-fee/platform-fee.api";
import { InfoTip } from "./InfoTip";

// Same normalization the backend uses to match category-scoped fees.
const normalizeCategory = (v: string | null | undefined) =>
  (v || "").toLowerCase().replace(/[\s_-]/g, "");

interface CommissionCalculatorProps {
  stats: ReferralStats | null;
}

export function CommissionCalculator({ stats }: CommissionCalculatorProps) {
  const [wager, setWager] = useState<string>("1000");
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [activeFees, setActiveFees] = useState<ActivePlatformFee[]>([]);
  // Editable rate — seeded from the selected category but the user can type any
  // % to model a custom share (agent or sub-agent).
  const [rateInput, setRateInput] = useState<string>("");

  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();

  useEffect(() => {
    if (!currentPackage) {
      fetchCurrentPackage();
    }
  }, [currentPackage, fetchCurrentPackage]);

  useEffect(() => {
    platformFeeApi
      .listActive()
      .then((res) => setActiveFees(res.data || []))
      .catch(() => setActiveFees([]));
  }, []);

  const commissions = stats?.commissions || [];
  
  // Set default selection if none
  if (!selectedGameId && commissions.length > 0) {
    setSelectedGameId(commissions[0].id);
  }

  const selectedComm = commissions.find(c => c.id === selectedGameId);
  const baseRate = selectedComm?.rate || 0;

  // FLAT mode: one rate on every game; package plan bonuses do not apply.
  const isFlatMode = (stats as any)?.commissionMode === "FLAT";

  // Additive logic for package bonus
  const pkgRates = isFlatMode
    ? ({} as Record<string, number>)
    : currentPackage?.package?.features?.ggrRates || {};
  let pkgRate = 0;

  if (selectedComm) {
    const slugUnderscore = selectedComm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const slugDash = selectedComm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    pkgRate = 
      pkgRates[selectedComm.name] || 
      pkgRates[selectedComm.name.toLowerCase()] || 
      pkgRates[slugUnderscore] || 
      pkgRates[slugDash] || 
      0;
  }
  
  const totalRate = Number(baseRate) + Number(pkgRate);

  // Re-seed the editable rate whenever the category (or its resolved rate)
  // changes; the field stays fully editable afterwards.
  useEffect(() => {
    setRateInput(totalRate.toFixed(1));
  }, [selectedGameId, totalRate]);

  // Rate actually used in the estimate — the typed value when present, else the
  // category rate.
  const parsedRate = parseFloat(rateInput);
  const usedRate = Number.isFinite(parsedRate) ? parsedRate : totalRate;
  const isCustomRate = Number.isFinite(parsedRate) && parsedRate !== totalRate;

  // Wager * 1% = house GGR; commission = GGR * rate.
  const numericWager = parseFloat(wager) || 0;
  const ggr = numericWager * 0.01;
  const grossCommission = ggr * (usedRate / 100);

  // Mirror the backend fee engine: the fee % is charged on GGR (not on the
  // commission), then capped at the commission so net never goes negative.
  // Global fees always apply; category-scoped fees only when the category matches.
  const applicableFees = activeFees.filter(
    (f) =>
      !f.appliesTo ||
      normalizeCategory(f.appliesTo) === normalizeCategory(selectedComm?.name),
  );
  const feePercent = applicableFees.reduce((s, f) => s + Number(f.percent), 0);
  const feeAmount = Math.min(ggr * (feePercent / 100), grossCommission);
  // Floor at 0 — fee is capped at the commission, and this also avoids a
  // floating-point "-0.00" when the fee exactly consumes the commission.
  const netCommission = Math.max(0, grossCommission - feeAmount);

  const gross = grossCommission.toFixed(2);
  const feeCut = feeAmount.toFixed(2);
  const result = netCommission.toFixed(2);

  return (
    <div className="bg-[#191D24] rounded-2xl p-4 sm:p-6 border border-white/5 space-y-5 sm:space-y-6 shadow-2xl relative overflow-hidden group">
      {/* Decorative pulse background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-purple-600/10 transition-colors" />

      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-purple-400 flex items-center gap-2">
          {/* <div className="w-1.5 h-6 bg-purple-500 rounded-full" /> */}
          Revenue Forecaster
          <InfoTip
            title="Revenue Forecaster"
            description="How your commission estimate is calculated."
          >
            <p>
              <span className="text-white font-bold">Step 1 — House result (NGR):</span>{" "}
              on average the casino keeps about 1% of everything your players
              wager. That 1% is the Net Gaming Revenue your commission is paid
              from — you earn from what players lose, not from what they bet.
            </p>
            <p>
              <span className="text-white font-bold">Step 2 — Your rate:</span>{" "}
              your commission rate for the chosen game category is applied to
              that house result.
            </p>
            <p>
              <span className="text-white font-bold">Step 3 — Platform fees:</span>{" "}
              active platform charges are deducted before the money reaches
              your wallet. The figure below is your final NET estimate.
            </p>
            <p className="text-gray-500">
              Example: 1,000 wagered → ~10 house result → × your rate → −
              platform fees = what lands in your wallet.
            </p>
          </InfoTip>
        </h3>
        {/* Sentence case at 12px: the old all-caps 10px strapline was the hardest
            line in the card to read, and it is the one that explains the card. */}
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
          Estimate your potential earnings based on player activity.
        </p>
      </div>

      <div className="space-y-5">
        {/* INPUTS — wager and rate are peers, so they get equal billing and each
            its own label. They stack on phones instead of sharing one cramped row. */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4">
          <div className="space-y-1.5 min-w-0">
            <label className="block text-[10px] text-gray-500 uppercase font-semibold tracking-wider">
              Expected Wager
            </label>
            <input
              type="number"
              value={wager}
              placeholder="0.00"
              onChange={(e) => setWager(e.target.value)}
              className="w-full bg-black/40 text-white px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 focus:outline-none font-semibold text-lg tabular-nums shadow-inner transition-all"
            />
          </div>

          <div className="space-y-1.5 sm:w-[124px]">
            <label className="block text-[10px] text-gray-500 uppercase font-semibold tracking-wider">
              Your Rate
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                title="Type any % to model a custom share"
                className="w-full bg-black/40 text-purple-300 pl-4 pr-8 py-3 rounded-xl border border-purple-500/25 focus:border-purple-500 focus:outline-none font-semibold text-lg tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400/70 font-semibold text-sm pointer-events-none">
                %
              </span>
            </div>
            {(isCustomRate || isFlatMode || pkgRate > 0) && (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                  isCustomRate
                    ? "bg-yellow-500/10 text-yellow-400"
                    : isFlatMode
                      ? "bg-purple-500/10 text-purple-300"
                      : "bg-green-500/10 text-green-400"
                }`}
              >
                {isCustomRate ? "Custom" : isFlatMode ? "Flat rate" : "Incl. bonus"}
              </span>
            )}
          </div>
        </div>

        {/* The working, spelled out. This replaces a vertical "X 1% X" glyph that
            sat between the two inputs and explained nothing — the 1% house-result
            step is the part users miss, so it says so in words. */}
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-[11px] text-gray-500">
          <span className="font-semibold tabular-nums text-gray-300">
            {numericWager.toLocaleString()}
          </span>
          wagered
          <span className="text-gray-600">×</span>
          <span className="font-semibold text-gray-300">1%</span>
          house result
          <span className="text-gray-600">×</span>
          <span className="font-semibold tabular-nums text-purple-300">
            {usedRate.toFixed(1)}%
          </span>
          your rate
          <span className="text-gray-600">=</span>
          <span className="font-bold tabular-nums text-gray-200">{gross}</span>
        </p>

        {/* GAMES DROPDOWN */}
        <div className="space-y-1.5">
          <label className="block text-[10px] text-gray-500 uppercase font-semibold tracking-wider">
            Game Category
          </label>
          <div className="relative">
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              className="w-full appearance-none bg-black/40 text-white pl-4 pr-11 py-3 rounded-xl border border-white/10 focus:border-purple-500 focus:outline-none font-semibold transition-all cursor-pointer text-sm"
            >
              {commissions.length > 0 ? (
                commissions.map((comm) => {
                  let pRate = 0;
                  const slugU = comm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                  const slugD = comm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  pRate = pkgRates[comm.name] || pkgRates[comm.name.toLowerCase()] || pkgRates[slugU] || pkgRates[slugD] || 0;
                  const tRate = Number(comm.rate || 0) + Number(pRate);
                  
                  return (
                    <option key={comm.id} value={comm.id} className="bg-[#191D24]">
                      {comm.name} ({tRate.toFixed(1)}%)
                    </option>
                  );
                })
              ) : (
                <option value="">No rates assigned</option>
              )}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* RESULT DISPLAY */}
        <div className="pt-5 border-t border-white/5 space-y-4">
          {feePercent > 0 && (
            <div className="rounded-xl bg-black/30 border border-white/5 divide-y divide-white/5 text-xs">
              <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5">
                <span className="text-gray-400">Commission before fees</span>
                <span className="text-gray-200 font-semibold tabular-nums">{gross}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5">
                <span className="text-gray-400">
                  Platform fees ({feePercent.toFixed(1)}%)
                </span>
                <span className="text-red-400 font-semibold tabular-nums">−{feeCut}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center text-center gap-2">
            {/* tabular-nums so the figure does not jog sideways as you type, and
                no italic — it was the only italic number in the portal. */}
            <span className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-white">
              {result}
            </span>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
              Estimated net reward · after platform fees
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
