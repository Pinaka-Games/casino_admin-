"use client";

import React, { useEffect, useState } from "react";
import { X, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TierRewardRateItem, TierRewards } from "@/types/vip.tier.types";

/** Benefits that can carry a playthrough. */
const WAGERABLE_ROWS: { key: keyof TierRewards; label: string; hint: string }[] = [
  { key: "hourlyCashback", label: "Hourly Cashback", hint: "applied on claim" },
  { key: "dailyCashback", label: "Daily Cashback", hint: "applied on claim" },
  { key: "weeklyCashback", label: "Weekly Cashback", hint: "applied on claim" },
  { key: "monthlyCashback", label: "Monthly Cashback", hint: "applied on claim" },
  // No Deposit Bonus row — deposit bonuses set their own wagering per bonus
  // record in Settings → Bonus Listing.
  {
    key: "instantRebate",
    label: "Instant Rebate",
    // It credits per wager, so a day's rebates roll up into one rollover entry
    // instead of one per bet.
    hint: "all of a day's rebates share one rollover",
  },
];

interface Props {
  open: boolean;
  rewards: TierRewards;
  tierLabel: string;
  onClose: () => void;
  onApply: (next: Record<string, number | null>) => void;
}

export default function TierWageringModal({
  open,
  rewards,
  tierLabel,
  onClose,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const row of WAGERABLE_ROWS) {
      const item = rewards[row.key] as TierRewardRateItem | undefined;
      next[row.key] = item?.wageringMultiplier != null
        ? String(item.wageringMultiplier)
        : "";
    }
    setDraft(next);
  }, [open, rewards]);

  if (!open) return null;

  const handleApply = () => {
    const parsed: Record<string, number | null> = {};
    for (const row of WAGERABLE_ROWS) {
      const raw = draft[row.key] ?? "";
      const num = raw === "" ? null : Number(raw);
      parsed[row.key] = num == null || !Number.isFinite(num) ? null : num;
    }
    onApply(parsed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#15181E] rounded-xl p-4 md:p-6 flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-white text-lg font-medium">Set Wagering Multiplier</h2>
            <p className="text-xs text-gray-400 mt-1">{tierLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex gap-2 rounded-md border border-amber-700/40 bg-amber-500/10 p-3">
          <TriangleAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-5">
            A multiplier above 1x changes how players are paid: the payout is
            credited as <span className="font-medium">locked bonus cash</span> with a
            rollover of amount x multiplier, instead of instantly withdrawable Wulf
            Cash. Leave blank or set 1x to keep the current behavior.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
          {WAGERABLE_ROWS.map((row) => {
            const item = rewards[row.key] as TierRewardRateItem | undefined;
            const disabled = !item?.enabled;
            return (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 rounded-md bg-[#191D24] px-3 py-3 md:gap-4 md:px-4"
              >
                <div>
                  <Label className="text-white text-sm">{row.label}</Label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {disabled ? "Benefit is disabled on this tier" : row.hint}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={draft[row.key] ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [row.key]: e.target.value }))
                    }
                    placeholder={disabled ? "—" : "No wagering"}
                    className="w-[100px] sm:w-[140px] bg-[#1a2030] border border-gray-700 text-white placeholder-gray-600 h-9 text-sm disabled:opacity-40"
                  />
                  <span className="text-sm text-gray-400 w-4">x</span>
                </div>
              </div>
            );
          })}

        </div>

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="outline" className="border-gray-600 text-white" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white px-6"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
        <p className="text-[11px] text-gray-500 text-right mt-2">
          Apply updates the table — press Save Changes to persist.
        </p>
      </div>
    </div>
  );
}
