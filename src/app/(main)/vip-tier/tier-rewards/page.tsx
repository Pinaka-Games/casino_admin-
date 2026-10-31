"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { vipTierApi } from "@/api/vip-tier/vip-tier-api";
import { adminListPlans } from "@/api/subscription/admin-subscription.api";
import { SubscriptionPlan } from "@/types/subscription.types";
import { FreeSpinConfigSelect } from "@/components/free-spin/FreeSpinConfigSelect";
import TierWageringModal from "../components/TierWageringModal";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";
import { VIP_FORCE_SEED_WARNING } from "../components/vip-seed-warning";
import { useFreeSpinWiringsStore } from "@/store/free-spin-wirings-store";
import {
  COMMUNITY_CHAT_LEVELS,
  DEFAULT_TIER_REWARDS,
  TierRewardChatItem,
  TierRewardLevelUpItem,
  TierRewardRateItem,
  TierRewardSpinItem,
  TierRewards,
  VipTier,
} from "@/types/vip.tier.types";

/* ==============================
   BENEFIT ROW DEFINITIONS
============================== */
const BENEFIT_ROWS: {
  key: keyof TierRewards;
  label: string;
  description: string;
  type: "rate" | "spin" | "levelup" | "chat";
  unit: string;
  /** Cycle the cap applies over. Undefined = benefit takes no cap. */
  capWindow?: string;
}[] = [
  {
    key: "hourlyCashback",
    label: "Hourly Cashback",
    description: "% of rake returned every hour",
    type: "rate",
    unit: "%",
    capWindow: "per hour",
  },
  {
    key: "dailyCashback",
    label: "Daily Cashback",
    description: "% of daily net rake returned",
    type: "rate",
    unit: "%",
    capWindow: "per day",
  },
  // Deposit bonuses are configured per bonus record in Settings → Bonus Listing,
  // where each one carries its own match %, Max Bonus and wagering. A single
  // tier-wide rate cannot express that, so the row is not shown here. The
  // `reloadDepositBonus` key still exists in tierRewards for stored data.
  {
    key: "instantRebate",
    label: "Instant Rebate",
    description: "% of each wager returned instantly",
    type: "rate",
    unit: "%",
    capWindow: "per wager",
  },
  {
    key: "communityChat",
    label: "Community Chat",
    description: "VIP chat room access level",
    type: "chat",
    unit: "",
  },
  {
    key: "vipSpin",
    label: "VIP Spin",
    description: "Free spins awarded once, when the player reaches this tier",
    type: "spin",
    unit: "x",
  },
  {
    key: "levelUpBonus",
    label: "Tier-Up Bonus",
    description: "GC + SC granted on tier-up (claimed by user)",
    type: "levelup",
    unit: "",
  },
  {
    key: "weeklyCashback",
    label: "Weekly Cashback",
    description: "% of weekly net rake returned",
    type: "rate",
    unit: "%",
    capWindow: "per week",
  },
  {
    key: "monthlyCashback",
    label: "Monthly Cashback",
    description: "% of monthly net rake returned",
    type: "rate",
    unit: "%",
    capWindow: "per month",
  },
];

/* ==============================
   COMMUNITY CHAT LEVEL INFO
   What each access level grants. Ordered lowest → highest; each level
   includes everything below it. Edit copy here to match final product spec.
============================== */
const COMMUNITY_CHAT_LEVEL_INFO: {
  level: string;
  summary: string;
  features: string[];
}[] = [
  {
    level: "Basic",
    summary: "Read-only entry access.",
    features: [
      "View the VIP community chat",
      "Read messages from other members",
      "No posting or reactions",
    ],
  },
  {
    level: "Standard",
    summary: "Full participation. Everything in Basic, plus:",
    features: [
      "Post messages and reactions",
      "Standard send rate limits",
      "Mention other members",
    ],
  },
  {
    level: "Priority",
    summary: "Faster, elevated access. Everything in Standard, plus:",
    features: [
      "Priority message placement",
      "Higher / relaxed rate limits",
      "Access to the priority support channel",
    ],
  },
  {
    level: "Featured",
    summary: "Top-tier VIP. Everything in Priority, plus:",
    features: [
      "Featured badge on messages",
      "Access to exclusive VIP-only channels",
      "Direct host / concierge access",
    ],
  },
];

function CommunityChatInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Community Chat access level details"
          className="ml-1.5 inline-flex items-center text-gray-400 hover:text-purple-400 transition-colors"
        >
          <Info size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 bg-[#1a2030] border border-gray-700 text-white p-4"
      >
        <p className="text-sm font-semibold mb-3">Community Chat access levels</p>
        <div className="space-y-3">
          {COMMUNITY_CHAT_LEVEL_INFO.map((lvl) => (
            <div key={lvl.level}>
              <p className="text-xs font-semibold text-purple-300">{lvl.level}</p>
              <p className="text-[11px] text-gray-400 mb-1">{lvl.summary}</p>
              <ul className="list-disc list-inside space-y-0.5">
                {lvl.features.map((f) => (
                  <li key={f} className="text-[11px] text-gray-300">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ==============================
   HELPERS
============================== */
function buildTierLabel(tier: VipTier): string {
  // Tier level is no longer surfaced anywhere — one row per tier means the name
  // identifies it on its own.
  return tier.name ?? "";
}

function getPlanBoostPercent(plan?: SubscriptionPlan | null): number {
  const raw = plan?.features?.increasedRewardsPercent;
  const value = typeof raw === "string" ? Number(raw) : Number(raw ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatValue(value: number, maxFraction = 4): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(maxFraction)).toString();
}

/* Map TierRewards enabled flags → VipTier benefits flags */
function deriveBenefits(r: TierRewards): VipTier['benefits'] {
  return {
    instantRebate: r.instantRebate.enabled,
    hourlyCashback: r.hourlyCashback.enabled,
    dailyCashback: r.dailyCashback.enabled,
    weeklyBonus: r.weeklyCashback.enabled,
    monthlyBonus: r.monthlyCashback.enabled,
    reloadDepositeBonus: r.reloadDepositBonus.enabled,
    levelUpBonus: r.levelUpBonus.enabled,
    vipSpin: r.vipSpin.enabled,
    communityChat: r.communityChat.enabled,
  };
}

function mergeTierRewards(partial?: TierRewards | null): TierRewards {
  if (!partial) return { ...DEFAULT_TIER_REWARDS };
  // Tiers saved before caps existed have no `cap` key — normalize it to null so the
  // input renders empty instead of undefined-controlled, and so a save round-trips it.
  const rate = (item?: TierRewardRateItem): TierRewardRateItem => ({
    enabled: item?.enabled ?? false,
    rate: item?.rate ?? null,
    cap: item?.cap ?? null,
    wageringMultiplier: item?.wageringMultiplier ?? null,
  });
  return {
    instantRebate: rate(partial.instantRebate),
    hourlyCashback: rate(partial.hourlyCashback),
    dailyCashback: rate(partial.dailyCashback),
    weeklyCashback: rate(partial.weeklyCashback),
    monthlyCashback: rate(partial.monthlyCashback),
    reloadDepositBonus: rate(partial.reloadDepositBonus),
    levelUpBonus: partial.levelUpBonus
      ? {
          enabled: partial.levelUpBonus.enabled,
          amount: partial.levelUpBonus.amount ?? null,
          gcAmount: partial.levelUpBonus.gcAmount ?? null,
          scAmount: partial.levelUpBonus.scAmount ?? null,
          wageringMultiplier: partial.levelUpBonus.wageringMultiplier ?? null,
        }
      : { enabled: false, amount: null, gcAmount: null, scAmount: null, wageringMultiplier: null },
    vipSpin: partial.vipSpin
      ? {
          enabled: partial.vipSpin.enabled,
          count: partial.vipSpin.count,
          freeSpinConfigId: partial.vipSpin.freeSpinConfigId ?? null,
        }
      : { enabled: false, count: null, freeSpinConfigId: null },
    communityChat: partial.communityChat ?? { enabled: false, level: null },
  };
}

/* ==============================
   MAIN PAGE
============================== */
export default function VipTierRewardsPage() {
  const [tiers, setTiers] = useState<VipTier[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>("none");
  const [rewards, setRewards] = useState<TierRewards>({ ...DEFAULT_TIER_REWARDS });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedJustApplied, setSeedJustApplied] = useState(false);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [wageringOpen, setWageringOpen] = useState(false);
  const hasFetched = useRef(false);

  /* ── Fetch all tiers (same pattern as tier management page) ── */
  const fetchVipTiers = async () => {
    setLoading(true);
    try {
      const { data } = await vipTierApi.getAll(null);
      if (data && data.length > 0) {
        const sorted = [...data].sort(
          (a, b) => (a.xp_required ?? 0) - (b.xp_required ?? 0)
        );
        setTiers(sorted);
        // Auto-select first tier if none selected
        setSelectedId((prev) => {
          if (!prev) {
            setRewards(mergeTierRewards(sorted[0].tierRewards));
            return sorted[0].id ?? "";
          }
          return prev;
        });
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load VIP tiers");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionPlans = async () => {
    try {
      const plans = await adminListPlans();
      const sorted = [...plans].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
      setSubscriptionPlans(sorted);
      const firstWithBoost = sorted.find((p) => getPlanBoostPercent(p) > 0);
      setSelectedSubscriptionId(firstWithBoost?.id ?? "none");
    } catch {
      setSubscriptionPlans([]);
      setSelectedSubscriptionId("none");
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchVipTiers();
    fetchSubscriptionPlans();
  }, []);

  /* ── When user picks a different tier ── */
  const handleTierChange = useCallback(
    (id: string) => {
      const tier = tiers.find((t) => t.id === id);
      if (!tier) return;
      setSelectedId(id);
      setRewards(mergeTierRewards(tier.tierRewards));
    },
    [tiers]
  );

  /* ── Toggle enabled ── */
  const handleToggle = useCallback(
    (key: keyof TierRewards, enabled: boolean) => {
      setRewards((prev) => ({
        ...prev,
        [key]: { ...prev[key], enabled },
      }));
    },
    []
  );

  /* ── Value change for rate / amount / count ── */
  const handleValueChange = useCallback(
    (key: keyof TierRewards, field: string, raw: string) => {
      const num = raw === "" ? null : parseFloat(raw);
      setRewards((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: num !== null && isNaN(num) ? null : num },
      }));
    },
    []
  );

  /* ── Bulk wagering multipliers from the modal ── */
  const handleApplyWagering = useCallback(
    (next: Record<string, number | null>) => {
      setRewards((prev) => {
        const updated = { ...prev };
        for (const [key, multiplier] of Object.entries(next)) {
          const item = updated[key as keyof TierRewards];
          if (!item) continue;
          updated[key as keyof TierRewards] = {
            ...item,
            wageringMultiplier: multiplier,
          } as any;
        }
        return updated;
      });
    },
    []
  );

  /* ── Community Chat level ── */
  const handleChatLevel = useCallback((level: string) => {
    setRewards((prev) => ({
      ...prev,
      communityChat: { ...prev.communityChat, level },
    }));
  }, []);

  /* ── VIP spin: pick FreeSpinConfig template ── */
  const handleVipSpinConfig = useCallback((freeSpinConfigId: string | null) => {
    setRewards((prev) => ({
      ...prev,
      vipSpin: { ...prev.vipSpin, freeSpinConfigId },
    }));
  }, []);

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    if (!selectedId) return;
    // Production-grade guard: if vipSpin is enabled, require a template.
    // Without one, the rank-up trigger has no AleaPlay payload to send and
    // will silently skip in `FreeSpinTriggerService` — bad UX for admins.
    if (rewards.vipSpin.enabled && !rewards.vipSpin.freeSpinConfigId) {
      toast.error("Pick a Free Spin template before enabling VIP Spin");
      return;
    }
    setSaving(true);
    try {
      const benefits = deriveBenefits(rewards);
      const res = await vipTierApi.updateTierRewards(selectedId, rewards, benefits);
      setTiers((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? { ...t, tierRewards: res.data.tierRewards ?? rewards }
            : t
        )
      );
      setRewards(res.data.tierRewards ?? rewards);
      // Refresh the cross-module wirings cache so other pages' template
      // pickers immediately exclude what this tier just wired.
      void useFreeSpinWiringsStore.getState().loadWirings(true);
      toast.success("Tier rewards saved successfully");
    } catch {
      toast.error("Failed to save tier rewards");
    } finally {
      setSaving(false);
    }
  }, [selectedId, rewards]);

  const handleSeedDefaults = useCallback(async () => {
    try {
      setSeeding(true);
      const { data } = await vipTierApi.seedDefaults(true);
      toast.success(data?.message || "VIP tiers seeded successfully");
      await fetchVipTiers();
      setSeedJustApplied(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to seed VIP tiers");
    } finally {
      setSeeding(false);
    }
  }, []);

  /* ── Selected tier ── */
  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === selectedId),
    [tiers, selectedId]
  );

  const selectedSubscriptionPlan = useMemo(
    () =>
      selectedSubscriptionId === "none"
        ? null
        : subscriptionPlans.find((p) => p.id === selectedSubscriptionId) ?? null,
    [subscriptionPlans, selectedSubscriptionId]
  );

  const subscriptionBoostPercent = useMemo(
    () => getPlanBoostPercent(selectedSubscriptionPlan),
    [selectedSubscriptionPlan]
  );

  const hasExistingSeedValues = useMemo(() => {
    return tiers.some((tier) => {
      const r = tier.tierRewards;
      if (!r) return false;
      return (
        (r.hourlyCashback?.enabled && r.hourlyCashback?.rate != null) ||
        (r.dailyCashback?.enabled && r.dailyCashback?.rate != null) ||
        (r.weeklyCashback?.enabled && r.weeklyCashback?.rate != null) ||
        (r.monthlyCashback?.enabled && r.monthlyCashback?.rate != null) ||
        (r.reloadDepositBonus?.enabled && r.reloadDepositBonus?.rate != null) ||
        (r.levelUpBonus?.enabled && r.levelUpBonus?.amount != null) ||
        (r.vipSpin?.enabled && r.vipSpin?.count != null) ||
        (r.communityChat?.enabled && !!r.communityChat?.level)
      );
    });
  }, [tiers]);

  const showSeedButton = !loading && !seedJustApplied && !hasExistingSeedValues;

  /* ==============================
     RENDER
  ============================== */
  return (
    <div className="h-screen w-full bg-[#0a0e1a] p-3 md:p-6 overflow-hidden flex flex-col">
      {/* HEADER */}
      <div className="bg-[#191D24] rounded-lg px-3 py-2 mb-3 flex flex-col items-stretch gap-2 md:mb-4 md:flex-row md:items-center md:justify-between md:gap-4 md:px-4">
        <h1 className="text-white text-base font-normal">VIP / Tier Rewards</h1>
        {/* Entered from Tier Management — this page is no longer in the sidebar,
            so it has to offer the way back. */}
        <Link href="/vip-tier/tier-management" className="shrink-0">
          <Button
            variant="outline"
            className="h-9 w-full border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white md:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tier Management
          </Button>
        </Link>
      </div>

      {/* FILTER BAR */}
      {/* Wraps on a phone: two fixed-width selects plus the action buttons ran
          ~700px on one row. */}
      <div className="bg-[#15181E] rounded-lg p-3 mb-3 flex flex-wrap items-center gap-3 md:mb-4 md:flex-nowrap md:gap-4">
        <Select value={selectedId} onValueChange={handleTierChange} disabled={loading}>
          <SelectTrigger className="w-full md:w-[200px] bg-[#1a2030] border border-gray-700 text-white">
            <SelectValue placeholder={loading ? "Loading tiers…" : "Select tier"} />
          </SelectTrigger>
          <SelectContent>
            {/* Radix throws if a SelectItem value is "" — skip id-less tiers
                instead of rendering value="" (the client-side crash source). */}
            {tiers
              .filter((t) => !!t.id)
              .map((t) => (
                <SelectItem key={t.id} value={t.id as string}>
                  {buildTierLabel(t)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedSubscriptionId}
          onValueChange={setSelectedSubscriptionId}
        >
          <SelectTrigger className="w-full md:w-[280px] bg-[#1a2030] border border-gray-700 text-white">
            <SelectValue placeholder="Subscription boost plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No subscription boost (0%)</SelectItem>
            {subscriptionPlans.map((plan) => {
              const boost = getPlanBoostPercent(plan);
              return (
                <SelectItem key={plan.id} value={plan.id}>
                  {`${plan.name} (+${formatValue(boost, 2)}%)`}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <div className="ml-auto flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap">
          {showSeedButton && (
            <Button
              onClick={() => setSeedConfirmOpen(true)}
              disabled={seeding || loading}
              variant="outline"
              className="flex-auto border-gray-700 text-gray-200 hover:text-white md:flex-none"
            >
              {seeding ? "Seeding..." : "Run Seed (Force)"}
            </Button>
          )}

          <Button
            onClick={() => setWageringOpen(true)}
            disabled={loading || !selectedId}
            variant="outline"
            className="flex-auto border-gray-700 text-gray-200 hover:text-white md:flex-none"
          >
            Set Wagering Multiplier
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !selectedId}
            className="flex-auto bg-purple-600 hover:bg-purple-700 text-white px-6 md:flex-none"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 bg-[#15181E] rounded-lg overflow-hidden">
        <div className="h-full overflow-x-auto overflow-y-auto scrollbar-hide">
          <table className="w-full min-w-[960px] border-collapse">
            <thead className="bg-[#242B35] sticky top-0 z-10">
              <tr className="border-b border-gray-700">
                <th className="px-6 py-3 text-left text-xs text-white w-[22%]">
                  Benefit
                </th>
                <th className="px-6 py-3 text-left text-xs text-white w-[26%]">
                  Description
                </th>
                <th className="px-6 py-3 text-center text-xs text-white w-[12%]">
                  Enabled
                </th>
                <th className="px-6 py-3 text-left text-xs text-white w-[16%]">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs text-white w-[14%]">
                  Max Payout
                  <span className="ml-2 text-[10px] text-gray-400">
                    (blank = uncapped)
                  </span>
                </th>
                <th className="px-6 py-3 text-left text-xs text-white w-[10%]">
                  Subscription %
                  <span className="ml-2 text-[10px] text-gray-400">
                    {`(${subscriptionBoostPercent > 0 ? "+" : ""}${formatValue(subscriptionBoostPercent, 2)}%)`}
                  </span>
                </th>
                <th className="px-6 py-3 text-left text-xs text-white w-[12%]">
                  Total Reward
                  <span className="ml-2 text-[10px] text-gray-400">
                    {`(+${formatValue(subscriptionBoostPercent, 2)}%)`}
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {BENEFIT_ROWS.map((row, index) => {
                const item = rewards[row.key];
                const isEnabled = item?.enabled ?? false;

                // Tier-Up Bonus used to be configurable only on a tier's
                // level-3 row; every tier is that single row now, so it is
                // always editable and there is nothing to lock.

                return (
                  <tr
                    key={row.key}
                    className={`${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    } hover:bg-[#1a2030] transition-colors`}
                  >
                    {/* Benefit Name */}
                    <td className="px-6 py-4 text-sm text-white font-medium">
                      <span className="inline-flex items-center">
                        {row.label}
                        {row.key === "communityChat" && <CommunityChatInfo />}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {row.description}
                    </td>

                    {/* Toggle */}
                    <td className="px-6 py-4 text-center">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(v) => handleToggle(row.key, v)}
                        className="data-[state=checked]:bg-purple-600"
                      />
                    </td>

                    {/* Value Input */}
                    <td className="px-6 py-4">
                      {row.type === "rate" && (
                        <RateInput
                          value={(item as TierRewardRateItem)?.rate}
                          unit={row.unit}
                          disabled={!isEnabled}
                          onChange={(v) => handleValueChange(row.key, "rate", v)}
                        />
                      )}
                      {row.type === "levelup" && (
                        <div className="flex flex-col gap-2">
                          <LabeledInput
                            label="GC"
                            value={(item as TierRewardLevelUpItem)?.gcAmount ?? (item as TierRewardLevelUpItem)?.amount}
                            disabled={!isEnabled}
                            onChange={(v) => handleValueChange(row.key, "gcAmount", v)}
                          />
                          <LabeledInput
                            label="SC"
                            value={(item as TierRewardLevelUpItem)?.scAmount}
                            disabled={!isEnabled}
                            onChange={(v) => handleValueChange(row.key, "scAmount", v)}
                          />
                          <LabeledInput
                            label="Wager"
                            unit="x"
                            value={(item as TierRewardLevelUpItem)?.wageringMultiplier}
                            disabled={!isEnabled}
                            onChange={(v) => handleValueChange(row.key, "wageringMultiplier", v)}
                          />
                        </div>
                      )}
                      {row.type === "spin" && (
                        <FreeSpinConfigSelect
                          value={(item as TierRewardSpinItem)?.freeSpinConfigId ?? null}
                          onChange={handleVipSpinConfig}
                          disabled={!isEnabled}
                          triggerClassName="w-full max-w-[220px] bg-[#1a2030] border border-gray-700 text-white text-xs h-8"
                          placeholder="Pick Free Spin template"
                          // Always keep this tier's saved template visible so
                          // admins can switch back to it after picking another.
                          includeIds={
                            selectedTier?.tierRewards?.vipSpin?.freeSpinConfigId
                              ? [selectedTier.tierRewards.vipSpin.freeSpinConfigId]
                              : undefined
                          }
                        />
                      )}
                      {row.type === "chat" && (
                        <ChatLevelSelect
                          value={(item as TierRewardChatItem)?.level}
                          disabled={!isEnabled}
                          onChange={handleChatLevel}
                        />
                      )}
                    </td>

                    {/* Max payout per cycle. Only rate benefits take a cap —
                        Tier-Up Bonus and VIP Spin are already fixed amounts. */}
                    <td className="px-6 py-4">
                      {row.type === "rate" ? (
                        <>
                          <CapInput
                            value={(item as TierRewardRateItem)?.cap}
                            window={row.capWindow}
                            disabled={!isEnabled}
                            onChange={(v) => handleValueChange(row.key, "cap", v)}
                          />
                          {isEnabled &&
                            Number((item as TierRewardRateItem)?.wageringMultiplier ?? 0) > 1 && (
                              <span className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                                {`${(item as TierRewardRateItem).wageringMultiplier}x wagering`}
                              </span>
                            )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <SubscriptionPercentCell
                        type={row.type}
                        item={item}
                        subscriptionBoostPercent={subscriptionBoostPercent}
                      />
                    </td>

                    <td className="px-6 py-4">
                      <TotalRewardCell
                        type={row.type}
                        item={item}
                        unit={row.unit}
                        subscriptionBoostPercent={subscriptionBoostPercent}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <TierWageringModal
        open={wageringOpen}
        rewards={rewards}
        tierLabel={selectedTier ? buildTierLabel(selectedTier) : ""}
        onClose={() => setWageringOpen(false)}
        onApply={handleApplyWagering}
      />

      <ConfirmSeedDialog
        {...VIP_FORCE_SEED_WARNING}
        open={seedConfirmOpen}
        onCancel={() => setSeedConfirmOpen(false)}
        onConfirm={() => {
          setSeedConfirmOpen(false);
          handleSeedDefaults();
        }}
      />
    </div>
  );
}

/* ==============================
   SUB-COMPONENTS
============================== */

function RateInput({
  value,
  unit,
  disabled,
  onChange,
  integer = false,
}: {
  value: number | null | undefined;
  unit: string;
  disabled: boolean;
  onChange: (v: string) => void;
  integer?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 max-w-[180px]">
      <Input
        type="number"
        min={0}
        step={integer ? 1 : 0.01}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? "—" : "0"}
        className="bg-[#1a2030] border border-gray-700 text-white placeholder-gray-600 h-8 text-sm disabled:opacity-40"
      />
      {unit && (
        <span
          className={`text-sm font-medium min-w-[20px] ${
            disabled ? "text-gray-600" : "text-gray-300"
          }`}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

function CapInput({
  value,
  window,
  disabled,
  onChange,
}: {
  value: number | null | undefined;
  window?: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="max-w-[160px]">
      <Input
        type="number"
        min={0}
        step={0.01}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? "—" : "No cap"}
        className="bg-[#1a2030] border border-gray-700 text-white placeholder-gray-600 h-8 text-sm disabled:opacity-40"
      />
      {window && !disabled && (
        <p className="mt-1 text-[10px] text-gray-500">{window}</p>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 max-w-[220px]">
      <span
        className={`text-xs font-medium min-w-[44px] ${
          disabled ? "text-gray-600" : "text-gray-300"
        }`}
      >
        {label}
      </span>
      <Input
        type="number"
        min={0}
        step={0.01}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? "—" : "0"}
        className="bg-[#1a2030] border border-gray-700 text-white placeholder-gray-600 h-8 text-sm disabled:opacity-40"
      />
      {unit && (
        <span
          className={`text-sm font-medium min-w-[16px] ${
            disabled ? "text-gray-600" : "text-gray-300"
          }`}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

function getNumericRewardValue(
  type: "rate" | "spin" | "levelup" | "chat",
  item: TierRewards[keyof TierRewards],
): number | null {
  if (type === "chat") return null;
  if (!Boolean((item as any)?.enabled)) return null;

  if (type === "rate") {
    const value = (item as TierRewardRateItem)?.rate;
    return value == null || !Number.isFinite(value) ? null : value;
  }
  if (type === "levelup") {
    const lvl = item as TierRewardLevelUpItem;
    const value = lvl?.gcAmount ?? lvl?.amount;
    return value == null || !Number.isFinite(value) ? null : value;
  }
  if (type === "spin") {
    const value = (item as TierRewardSpinItem)?.count;
    return value == null || !Number.isFinite(value) ? null : value;
  }
  return null;
}

function SubscriptionPercentCell({
  type,
  item,
  subscriptionBoostPercent,
}: {
  type: "rate" | "spin" | "levelup" | "chat";
  item: TierRewards[keyof TierRewards];
  subscriptionBoostPercent: number;
}) {
  const baseValue = getNumericRewardValue(type, item);
  if (baseValue == null) {
    return <span className="text-xs text-gray-600">-</span>;
  }

  const prefix = subscriptionBoostPercent > 0 ? "+" : "";
  return (
    <span className="text-xs text-[#8FA8C9] font-medium">
      {`${prefix}${formatValue(subscriptionBoostPercent, 2)}%`}
    </span>
  );
}

function TotalRewardCell({
  type,
  item,
  unit,
  subscriptionBoostPercent,
}: {
  type: "rate" | "spin" | "levelup" | "chat";
  item: TierRewards[keyof TierRewards];
  unit: string;
  subscriptionBoostPercent: number;
}) {
  const baseValue = getNumericRewardValue(type, item);
  if (baseValue == null) {
    return <span className="text-xs text-gray-600">-</span>;
  }

  // Tier-Up Bonus pays GC AND SC, and the claim (UserVipService.claimTierReward)
  // boosts BOTH by the subscription %. Previewing only the GC figure made it
  // look as if SC were never boosted.
  if (type === "levelup") {
    const lvl = item as TierRewardLevelUpItem;
    const lines = [
      { label: "GC", value: Number(lvl?.gcAmount ?? lvl?.amount ?? 0) },
      { label: "SC", value: Number(lvl?.scAmount ?? 0) },
    ].filter((l) => Number.isFinite(l.value) && l.value > 0);
    if (!lines.length) return <span className="text-xs text-gray-600">-</span>;
    return (
      <div className="text-xs text-gray-300 leading-5 whitespace-nowrap space-y-1">
        {lines.map((l) => (
          <div key={l.label}>
            <div className="text-gray-500">
              {`${l.label}: ${formatValue(l.value)} + (${formatValue(l.value)} * ${formatValue(subscriptionBoostPercent, 2)}%)`}
            </div>
            <div className="text-purple-300 font-medium">
              {`${formatValue(l.value + (l.value * subscriptionBoostPercent) / 100)} ${l.label}`}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const bonusFromSubscription = (baseValue * subscriptionBoostPercent) / 100;
  const boostedValue = baseValue + bonusFromSubscription;

  return (
    <div className="text-xs text-gray-300 leading-5 whitespace-nowrap">
      <div className="text-gray-500">
        {`${formatValue(baseValue)} + (${formatValue(baseValue)} * ${formatValue(subscriptionBoostPercent, 2)}%)`}
      </div>
      <div className="text-purple-300 font-medium">
        {`${formatValue(boostedValue)}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`}
      </div>
    </div>
  );
}
function ChatLevelSelect({
  value,
  disabled,
  onChange,
}: {
  value: string | null | undefined;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[180px] bg-[#1a2030] border border-gray-700 text-white h-8 text-sm disabled:opacity-40">
        <SelectValue placeholder="Select level" />
      </SelectTrigger>
      <SelectContent>
        {COMMUNITY_CHAT_LEVELS.map((lvl) => (
          <SelectItem key={lvl} value={lvl}>
            {lvl}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}




