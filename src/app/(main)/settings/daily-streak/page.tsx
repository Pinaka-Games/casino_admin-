"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Save, Plus, Trash2, Sprout, ChevronDown, ChevronRight, Info } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import Image from "next/image";
import { dailyStreakAdminApi, MilestoneBonusCashConfig, MilestoneBonusFreeSpinConfig, StreakRewardConfig } from "@/api/daily-streak/daily-streak";
import { FreeSpinConfigSelect } from "@/components/free-spin/FreeSpinConfigSelect";
import crownIcon from "@/assets/images/daily-streak/crown.svg";
import spinWheelIcon from "@/assets/images/daily-streak/spin-wheel.svg";
import cashIcon from "@/assets/images/daily-streak/coingreen.svg";
import coinIcon from "@/assets/images/daily-streak/coingold.svg";
import { useFreeSpinConfigStore } from "@/store/free-spin-config-store";
import { useFreeSpinWiringsStore } from "@/store/free-spin-wirings-store";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";

const VIP_TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Immortal"] as const;


export default function DailyStreakSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [totalDays, setTotalDays] = useState(14);
  const [milestoneDays, setMilestoneDays] = useState<number[]>([]);
  const [milestoneBonusCash, setMilestoneBonusCash] = useState<MilestoneBonusCashConfig[]>([]);
  const [milestoneBonusCoin, setMilestoneBonusCoin] = useState<MilestoneBonusCashConfig[]>([]);
  const [milestoneBonusFreeSpin, setMilestoneBonusFreeSpin] = useState<MilestoneBonusFreeSpinConfig[]>([]);
  // Single master toggle for the whole "Milestone Bonus (per day)" list.
  const [milestonesListOpen, setMilestonesListOpen] = useState(false);
  const [rewards, setRewards] = useState<StreakRewardConfig[]>([]);
  const [hasRewards, setHasRewards] = useState(false);
  const [cashWageringEnabled, setCashWageringEnabled] = useState(false);
  const [cashWageringMultiplier, setCashWageringMultiplier] = useState(1);
  const [expandedTierRows, setExpandedTierRows] = useState<Set<number>>(new Set());

  // Template-as-grant model: each FREE_SPIN row picks its own template,
  // and that template's `numberOfFreeSpins` is what gets granted on claim.
  // This lets admins vary the spin count across days (e.g. 5 on Day 2,
  // 25 on Day 10) by picking different templates per day.

  // Subscribe to the FreeSpin templates store so we can resolve the picked
  // template's spin count for the per-row inline display. The store is
  // hydrated by FreeSpinConfigSelect on first mount.
  const freeSpinTemplates = useFreeSpinConfigStore((s) => s.configs);
  const templatesById = useMemo(() => {
    const map = new Map<string, (typeof freeSpinTemplates)[number]>();
    for (const t of freeSpinTemplates) map.set(t.id, t);
    return map;
  }, [freeSpinTemplates]);

  // All template IDs picked by FREE_SPIN rows in the current form state.
  // Each row's picker hides every entry in this set EXCEPT the row's own
  // value, so a template can't be wired to two streak days at once even
  // before saving.
  const pickedFreeSpinIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rewards) {
      if (r.freeSpinConfigId) ids.add(r.freeSpinConfigId);
    }
    return ids;
  }, [rewards]);

  // Snapshot of each row's server-side template ID at load time. Used by
  // the per-row picker so admins can switch back to the original wiring
  // even after moving away from it (without it, the global wirings cache
  // would hide the row's own server value).
  const [originalRowConfigIds, setOriginalRowConfigIds] = useState<
    Map<number, string>
  >(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dailyStreakAdminApi.getConfig();
      const cfg = res.data;
      setIsEnabled(cfg.isEnabled);
      setTotalDays(cfg.totalDays);
      setMilestoneDays(cfg.milestoneDays || []);
      setMilestoneBonusCash(cfg.milestoneBonusCash || []);
      setMilestoneBonusCoin(cfg.milestoneBonusCoin || []);
      setMilestoneBonusFreeSpin(cfg.milestoneBonusFreeSpin || []);
      setCashWageringEnabled(Boolean(cfg.cashWageringEnabled));
      setCashWageringMultiplier(Number(cfg.cashWageringMultiplier) || 1);
      // Multi-reward rows already carry cashAmount/coinAmount/freeSpinConfigId.
      const hydratedRewards = cfg.rewards;
      setRewards(hydratedRewards);
      setHasRewards(hydratedRewards.length > 0);
      // Snapshot each row's server template so its picker can surface the
      // original even after the admin swaps it.
      const originals = new Map<number, string>();
      for (const r of hydratedRewards) {
        if (r.freeSpinConfigId) originals.set(r.day, r.freeSpinConfigId);
      }
      setOriginalRowConfigIds(originals);
    } catch {
      toast.error("Failed to load daily streak config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ─── Toggle ────────────────────────────────────────── */
  const handleToggle = async () => {
    try {
      const res = await dailyStreakAdminApi.toggleFeature(!isEnabled);
      setIsEnabled(res.data.isEnabled);
      toast.success(`Daily Streak ${res.data.isEnabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to toggle feature");
    }
  };

  /* ─── Seed ──────────────────────────────────────────── */
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await dailyStreakAdminApi.seedRewards();
      toast.success(res.data.message);
      await load();
    } catch {
      toast.error("Failed to seed rewards");
    } finally {
      setSeeding(false);
    }
  };

  /* ─── Save ──────────────────────────────────────────── */
  const handleSave = async () => {
    if (rewards.length === 0) {
      toast.error("Add at least one reward day");
      return;
    }
    // Multi-reward: every day must grant at least one of cash / coin / free-spin.
    for (const r of rewards) {
      const hasAny = (r.cashAmount ?? 0) > 0 || (r.coinAmount ?? 0) > 0 || !!r.freeSpinConfigId;
      if (!hasAny) {
        toast.error(`Day ${r.day}: set at least one reward (cash, coin or free spin)`);
        return;
      }
    }

    const normalizedRewards = rewards.map((r) => ({
      day: r.day,
      cashAmount: Number(r.cashAmount ?? 0),
      coinAmount: Number(r.coinAmount ?? 0),
      freeSpinConfigId: r.freeSpinConfigId ?? null,
      tierRewards: r.tierRewards ?? [],
    }));

    if (cashWageringEnabled && cashWageringMultiplier < 1) {
      toast.error("Cash wagering multiplier must be at least 1 when enabled");
      return;
    }

    setSaving(true);
    try {
      await dailyStreakAdminApi.updateConfig({
        totalDays,
        milestoneDays,
        milestoneBonusCash,
        milestoneBonusCoin,
        milestoneBonusFreeSpin,
        // Streak-level template is deprecated in favor of per-row pickers.
        // Send null so any legacy value on the row is overwritten and the
        // backend stops using it as a fallback for new claims.
        freeSpinConfigId: null,
        cashWageringEnabled,
        cashWageringMultiplier: cashWageringEnabled ? cashWageringMultiplier : 1,
        rewards: normalizedRewards,
      });
      // Refresh the cross-module wirings cache so other pages' pickers
      // immediately reflect templates we just wired here.
      void useFreeSpinWiringsStore.getState().loadWirings(true);
      toast.success("Configuration saved successfully");
      await load();
    } catch {
      toast.error("Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  /* ─── Row helpers ───────────────────────────────────── */
  const addDay = () => {
    const nextDay = rewards.length > 0 ? rewards[rewards.length - 1].day + 1 : 1;
    setRewards([...rewards, { day: nextDay, cashAmount: 0, coinAmount: 10000, freeSpinConfigId: null, tierRewards: [] }]);
    setTotalDays(Math.max(totalDays, nextDay));
  };

  const removeDay = (index: number) => {
    const updated = rewards.filter((_, i) => i !== index).map((r, i) => ({ ...r, day: i + 1 }));
    setRewards(updated);
    if (updated.length < totalDays) {
      setTotalDays(updated.length);
      setMilestoneDays((prev) => prev.filter((day) => day <= updated.length));
      setMilestoneBonusCash((prev) => prev.filter((item) => item.day <= updated.length));
    }
  };

  const updateReward = (index: number, field: "cashAmount" | "coinAmount" | "freeSpinConfigId", value: any) => {
    setRewards((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const syncRewardsToTotalDays = (nextTotalDays: number) => {
    const safeTotalDays = Math.min(30, Math.max(1, nextTotalDays || 1));

    setTotalDays(safeTotalDays);
    setRewards((prev) => {
      if (prev.length === safeTotalDays) return prev;

      if (prev.length > safeTotalDays) {
        return prev.slice(0, safeTotalDays).map((reward, index) => ({
          ...reward,
          day: index + 1,
        }));
      }

      const nextRewards = [...prev];
      for (let day = prev.length + 1; day <= safeTotalDays; day += 1) {
        nextRewards.push({ day, cashAmount: 0, coinAmount: 10000, freeSpinConfigId: null, tierRewards: [] });
      }
      return nextRewards;
    });

    setMilestoneDays((prev) => prev.filter((day) => day <= safeTotalDays));
    setMilestoneBonusCash((prev) => prev.filter((item) => item.day <= safeTotalDays));
  };

  // Per-tier overrides carry a cash + coin amount (free spins are template-based).
  const updateTierField = (
    rowIndex: number,
    tierName: string,
    field: "cashAmount" | "coinAmount",
    amount: number,
  ) => {
    setRewards((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r;
        const existing = r.tierRewards ?? [];
        const current = existing.find((t) => t.tierName === tierName);
        if (!current) return r; // only editable when the tier override is enabled
        return {
          ...r,
          tierRewards: existing.map((t) =>
            t.tierName === tierName ? { ...t, [field]: amount } : t,
          ),
        };
      })
    );
  };

  const toggleTierRow = (index: number) => {
    setExpandedTierRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const toggleTierEnabled = (rowIndex: number, tierName: string) => {
    setRewards((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r;
        const existing = r.tierRewards ?? [];
        const entry = existing.find((t) => t.tierName === tierName);
        if (entry) {
          // Turn OFF — remove the entry
          return { ...r, tierRewards: existing.filter((t) => t.tierName !== tierName) };
        } else {
          // Turn ON — seed with the day's default cash/coin amounts.
          return { ...r, tierRewards: [...existing, { tierName, cashAmount: r.cashAmount ?? 0, coinAmount: r.coinAmount ?? 0 }] };
        }
      })
    );
  };

  

  const toggleMilestoneDay = (day: number) => {
    setMilestoneDays((prev) => {
      const nextMilestones = prev.includes(day)
        ? prev.filter((item) => item !== day)
        : [...prev, day].sort((a, b) => a - b);

      if (!nextMilestones.includes(day)) {
        // Deselected — drop all three bonus types for that day.
        setMilestoneBonusCash((current) => current.filter((item) => item.day !== day));
        setMilestoneBonusCoin((current) => current.filter((item) => item.day !== day));
        setMilestoneBonusFreeSpin((current) => current.filter((item) => item.day !== day));
      } else {
        setMilestoneBonusCash((current) => {
          if (current.some((item) => item.day === day)) {
            return current;
          }
          return [...current, { day, amount: 5 }].sort((a, b) => a.day - b.day);
        });
        // Reveal the list so the newly-marked day's config is visible.
        setMilestonesListOpen(true);
      }

      return nextMilestones;
    });
  };

  const updateMilestoneBonusCash = (day: number, amount: number) => {
    setMilestoneBonusCash((prev) => {
      const filtered = prev.filter((item) => item.day !== day);
      if (!amount || amount <= 0) {
        return filtered.sort((a, b) => a.day - b.day);
      }
      return [...filtered, { day, amount }].sort((a, b) => a.day - b.day);
    });
  };

  const updateMilestoneBonusCoin = (day: number, amount: number) => {
    setMilestoneBonusCoin((prev) => {
      const filtered = prev.filter((item) => item.day !== day);
      if (!amount || amount <= 0) {
        return filtered.sort((a, b) => a.day - b.day);
      }
      return [...filtered, { day, amount }].sort((a, b) => a.day - b.day);
    });
  };

  const updateMilestoneBonusFreeSpin = (day: number, freeSpinConfigId: string | null) => {
    setMilestoneBonusFreeSpin((prev) => {
      const filtered = prev.filter((item) => item.day !== day);
      if (!freeSpinConfigId) {
        return filtered.sort((a, b) => a.day - b.day);
      }
      return [...filtered, { day, freeSpinConfigId }].sort((a, b) => a.day - b.day);
    });
  };

  return (
    <div className="w-full p-3 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Daily Streak Configuration</h1>
        </div>        
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[#191D24] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6 rounded-xl border border-gray-800 bg-[#191D24] p-3 md:p-6">

          {/* Feature toggle + Total days — side by side (50/50) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Enable / Disable Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#141821] p-3 md:p-4">
              <div>
                <h3 className="text-white font-semibold">Daily streak toggler</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Toggle the daily streak feature on or off for all users.
                </p>
              </div>
              <button
                onClick={handleToggle}
                className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors ${
                  isEnabled ? "bg-purple-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    isEnabled ? "translate-x-8" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Total Days */}
            <div className="space-y-2 rounded-lg border border-gray-800 bg-[#141821] p-3 md:p-4">
              <Label className="text-white">Total Streak Days</Label>
              <p className="text-xs text-gray-500">
                Number of days in a full streak cycle before it resets.
              </p>
              <Input
                type="number"
                min={1}
                max={30}
                value={totalDays}
                onChange={(e) => syncRewardsToTotalDays(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#0E1117] text-white border-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Cash reward wagering */}
          <div className="space-y-3 rounded-lg border border-gray-800 bg-[#141821] p-3 md:p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cashWageringEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setCashWageringEnabled(enabled);
                  if (enabled && cashWageringMultiplier <= 1) setCashWageringMultiplier(20);
                  if (!enabled) setCashWageringMultiplier(1);
                }}
                className="h-4 w-4 accent-purple-600"
              />
              <span className="text-sm font-medium text-white">Enable Wagering on WULF CASH rewards and milestone bonuses</span>
            </label>
            {cashWageringEnabled && (
              <div className="space-y-1">
                <Label className="text-white">Wagering Multiplier</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step="1"
                  value={cashWageringMultiplier}
                  onChange={(e) => setCashWageringMultiplier(parseInt(e.target.value, 10) || 1)}
                  className="w-48 bg-[#0E1117] text-white border-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="e.g. 20"
                />
                <p className="text-xs text-gray-500">
                  Rollover required = reward amount × multiplier (e.g. 20 = 20x).
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-white">Milestone Days</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex cursor-help text-gray-400 hover:text-gray-200 transition-colors">
                    <Info className="h-4 w-4 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left leading-relaxed">
                  Click days to mark them as milestone rewards. Each milestone day can grant extra WULF CASH, WULF COIN and FREE SPIN on top of that day&apos;s base reward — expand a day below to configure all three.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {Array.from({ length: totalDays }, (_, index) => {
                const day = index + 1;
                const active = milestoneDays.includes(day);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleMilestoneDay(day)}
                    className={`relative min-w-[44px] rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-purple-500 bg-purple-600 text-white"
                        : "border-gray-700 bg-[#0E1117] text-gray-300 hover:border-purple-500 hover:text-white"
                    }`}
                  >
                    {active && (
                      <Image
                        src={crownIcon}
                        alt="milestone"
                        width={20}
                        height={20}
                        className="pointer-events-none absolute -top-3 -right-2 h-5 w-5 drop-shadow"
                      />
                    )}
                    {day}
                  </button>
                );
              })}

              {/* Single master toggle — opens/closes the whole milestone list */}
              {milestoneDays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMilestonesListOpen((v) => !v)}
                  title={milestonesListOpen ? "Collapse milestone bonuses" : "Expand milestone bonuses"}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 bg-[#0E1117] text-purple-400 transition-colors hover:border-purple-500 hover:text-purple-300"
                >
                  {milestonesListOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              )}
            </div>

            {milestoneDays.length > 0 && milestonesListOpen && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-white">Milestone Bonus (per day)</p>
                {milestoneDays.map((day) => {
                  const cashAmount = milestoneBonusCash.find((i) => i.day === day)?.amount ?? 0;
                  const coinAmount = milestoneBonusCoin.find((i) => i.day === day)?.amount ?? 0;
                  const fsConfigId = milestoneBonusFreeSpin.find((i) => i.day === day)?.freeSpinConfigId ?? null;

                  return (
                    <div key={day} className="rounded-lg border border-gray-800 bg-[#141821] p-3 md:p-4">
                      <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
                      {/* Day label — inline with the three inputs */}
                      <span className="flex items-center gap-2 text-sm font-semibold text-gray-100 shrink-0 md:w-24 md:pt-6">
                        <Image src={crownIcon} alt="" width={20} height={20} className="h-5 w-5" />
                        Day {day}
                      </span>

                      {/* Three reward types — side by side */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                        {/* WULF CASH */}
                        <div className="space-y-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"><Image src={cashIcon} alt="" width={16} height={16} className="h-4 w-4" />WULF CASH</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={cashAmount}
                            onChange={(e) => updateMilestoneBonusCash(day, parseFloat(e.target.value) || 0)}
                            className="bg-[#0E1117] text-white border-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </div>
                        {/* WULF COIN */}
                        <div className="space-y-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"><Image src={coinIcon} alt="" width={16} height={16} className="h-4 w-4" />WULF COIN</span>
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            value={coinAmount}
                            onChange={(e) => updateMilestoneBonusCoin(day, parseFloat(e.target.value) || 0)}
                            className="bg-[#0E1117] text-white border-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </div>
                        {/* FREE SPIN */}
                        <div className="space-y-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            <Image src={spinWheelIcon} alt="" width={16} height={16} className="h-4 w-4" />
                            FREE SPIN
                          </span>
                          <FreeSpinConfigSelect
                            value={fsConfigId}
                            onChange={(id) => updateMilestoneBonusFreeSpin(day, id)}
                            triggerClassName="w-full h-9 bg-[#0E1117] text-white border-gray-700 text-sm"
                            placeholder="Pick template (optional)"
                            hideInactiveWarning
                          />
                          {fsConfigId && templatesById.get(fsConfigId) && (
                            <p className="text-[10px] text-gray-500 leading-none pt-0.5">
                              Grants{" "}
                              <span className="text-purple-300 font-semibold">
                                {templatesById.get(fsConfigId)!.numberOfFreeSpins}
                              </span>{" "}
                              spin{templatesById.get(fsConfigId)!.numberOfFreeSpins === 1 ? "" : "s"} on claim
                            </p>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* Seed Button — only visible when no rewards exist */}
          {!hasRewards && !loading && (
            <div className="flex items-center gap-4 rounded-lg border border-amber-700/40 bg-amber-900/20 p-4">
              <Sprout className="h-6 w-6 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-white font-medium">No rewards configured</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Seed the default 14-day reward schedule to get started.
                </p>
              </div>
              <Button
                onClick={() => setSeedConfirmOpen(true)}
                disabled={seeding}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                {seeding ? "Seeding..." : "Seed Default Data"}
              </Button>
            </div>
          )}

          <ConfirmSeedDialog
            open={seedConfirmOpen}
            title="Seed default streak rewards?"
            description="This adds the default 14-day reward schedule. It only runs when no reward days exist yet."
            effects={[
              "Reward days 1–14 are created with the default rewards",
              "Streak settings, player streaks and past claims are not touched",
            ]}
            onCancel={() => setSeedConfirmOpen(false)}
            onConfirm={() => {
              setSeedConfirmOpen(false);
              handleSeed();
            }}
          />

          {/* Rewards Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
                Reward Schedule ({rewards.length} days)
              </h3>
              <Button variant="outline" size="sm" onClick={addDay}>
                <Plus className="mr-1 h-4 w-4" />
                Add Day
              </Button>
            </div>

            {/* Table Header */}
            {rewards.length > 0 && (
              <div className="grid grid-cols-[64px_1fr_40px] gap-2 md:gap-3 px-3 md:px-4 text-xs font-semibold text-gray-400 uppercase">
                <span>Day</span>
                <span>Rewards — Cash · Coin · Free Spin</span>
                {/* Tiers column commented out for now */}
                <span></span>
              </div>
            )}

            {/* Rows */}
            {rewards.map((reward, index) => {
              const isTierOpen = expandedTierRows.has(index);
              return (
                <div key={index} className="rounded-lg border border-gray-800 bg-[#141821] overflow-hidden">
                  {/* Main row */}
                  <div className="grid grid-cols-[64px_1fr_40px] gap-2 md:gap-3 items-start p-3 md:p-4">
                    <span className="text-sm font-semibold text-gray-100 pt-6">Day {reward.day}</span>

                    {/* Three reward types side by side — set any/all */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><Image src={cashIcon} alt="" width={14} height={14} className="h-3.5 w-3.5" />WULF CASH</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={reward.cashAmount ?? 0}
                          onChange={(e) => updateReward(index, "cashAmount", parseFloat(e.target.value) || 0)}
                          className="bg-[#0E1117] text-white border-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><Image src={coinIcon} alt="" width={14} height={14} className="h-3.5 w-3.5" />WULF COIN</span>
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={reward.coinAmount ?? 0}
                          onChange={(e) => updateReward(index, "coinAmount", parseFloat(e.target.value) || 0)}
                          className="bg-[#0E1117] text-white border-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><Image src={spinWheelIcon} alt="" width={14} height={14} className="h-3.5 w-3.5" />FREE SPIN</span>
                        <FreeSpinConfigSelect
                          value={reward.freeSpinConfigId ?? null}
                          onChange={(id) => updateReward(index, "freeSpinConfigId", id)}
                          triggerClassName="w-full h-9 bg-[#0E1117] text-white border-gray-700 text-sm"
                          placeholder="None"
                          hideInactiveWarning
                          excludeIds={pickedFreeSpinIds}
                          includeIds={
                            originalRowConfigIds.get(reward.day)
                              ? [originalRowConfigIds.get(reward.day)!]
                              : undefined
                          }
                        />
                        {reward.freeSpinConfigId && templatesById.get(reward.freeSpinConfigId) && (
                          <p className="text-[10px] text-gray-500 leading-none pl-1">
                            Grants{" "}
                            <span className="text-purple-300 font-semibold">
                              {templatesById.get(reward.freeSpinConfigId)!.numberOfFreeSpins}
                            </span>{" "}
                            spin{templatesById.get(reward.freeSpinConfigId)!.numberOfFreeSpins === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tiers toggle commented out for now
                    <button
                      onClick={() => toggleTierRow(index)}
                      className="text-purple-400 hover:text-purple-300 transition-colors p-1 flex items-center justify-center pt-6"
                      title="VIP tier rewards"
                    >
                      {isTierOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    */}

                    <button
                      onClick={() => removeDay(index)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1 pt-6"
                      title="Remove day"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* VIP tier sub‑panel */}
                  {isTierOpen && (
                    <div className="border-t border-gray-800 bg-[#0E1117] px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold uppercase text-purple-400 mb-2">VIP Tier Overrides (Cash / Coin)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {VIP_TIERS.map((tier) => {
                          const entry = (reward.tierRewards ?? []).find((t) => t.tierName === tier);
                          const isEnabled = !!entry;
                          return (
                            <div key={tier} className="space-y-1.5 rounded-md border border-gray-800 bg-[#0E1117] p-2">
                              <div className="flex items-center justify-between">
                                <label className={`text-xs ${isEnabled ? "text-white font-semibold" : "text-gray-500"}`}>{tier}</label>
                                <button
                                  type="button"
                                  onClick={() => toggleTierEnabled(index, tier)}
                                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                                    isEnabled ? "bg-purple-600" : "bg-gray-700"
                                  }`}
                                  title={isEnabled ? "Disable tier override" : "Enable tier override"}
                                >
                                  <span
                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                      isEnabled ? "translate-x-4" : "translate-x-0.5"
                                    }`}
                                  />
                                </button>
                              </div>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={isEnabled ? (entry?.cashAmount ?? 0) : ""}
                                disabled={!isEnabled}
                                onChange={(e) => updateTierField(index, tier, "cashAmount", parseFloat(e.target.value) || 0)}
                                className={`h-8 text-sm border-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isEnabled ? "bg-[#0E1117] text-white" : "bg-[#0E1117] text-gray-600 opacity-40 cursor-not-allowed"}`}
                                placeholder={isEnabled ? "Cash" : "Default"}
                              />
                              <Input
                                type="number"
                                min={0}
                                step="1"
                                value={isEnabled ? (entry?.coinAmount ?? 0) : ""}
                                disabled={!isEnabled}
                                onChange={(e) => updateTierField(index, tier, "coinAmount", parseFloat(e.target.value) || 0)}
                                className={`h-8 text-sm border-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isEnabled ? "bg-[#0E1117] text-white" : "bg-[#0E1117] text-gray-600 opacity-40 cursor-not-allowed"}`}
                                placeholder={isEnabled ? "Coin" : "Default"}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
