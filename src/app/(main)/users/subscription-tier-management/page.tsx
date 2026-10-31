"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Pencil, Trash2, Wrench, X } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import ExportCSV from "@/components/ExportCSV";
import { create } from "@/assets/images/action";

import {
  basictierimage,
  hustlertierimage,
  playertierimage,
} from "@/assets/images/banner";

import UserTierManagementModal, {
  UserTierFormData,
} from "./components/UserTierManagementModel";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";

import ConfirmDeleteDialog from "./components/ConfirmDeleteDialog";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";
import { useAdminSubscriptionStore } from "@/store/admin-subscription.store";
import { ADMIN_SUBSCRIPTION_FEATURES } from "./subscription-feature-config";
import { FreeSpinConfigSelect } from "@/components/free-spin/FreeSpinConfigSelect";

/** ============ Feature mapping (UI order) ============ */
const UI_FEATURES: string[] = [...ADMIN_SUBSCRIPTION_FEATURES];
const JACKPOT_GROUP_LABEL = "Free Entry To Jackpot and Tournament";
const JACKPOT_DETAIL_LABELS = [
  "Daily Jackpot Access",
  "Weekly Jackpot Access",
  "Monthly Jackpot Access",
] as const;
const JACKPOT_GROUP_INDEX = UI_FEATURES.indexOf(JACKPOT_GROUP_LABEL);
const JACKPOT_DETAIL_START_INDEX = UI_FEATURES.indexOf(JACKPOT_DETAIL_LABELS[0]);

type BackendFeatures = {
  standardAccess: boolean;
  weeklyFreeSpins: boolean;
  profileCustomization: boolean;
  promoCodesLimit: number;   // 0 = disabled, >0 = per-period limit
  increasedRewardsPercent: number;
  /**
   * Concurrent devices this tier may be signed in on. 0 = inherit the platform
   * default from System Configuration → Security.
   *
   * NOT part of the positional toggle matrix below — it is a number, not a
   * flag, and inserting it into ADMIN_SUBSCRIPTION_FEATURES would shift every
   * FEATURE_INDEX after it.
   */
  maxDevices: number;
  raffleEntry: boolean;
  jackpotDaily: boolean;
  jackpotWeekly: boolean;
  jackpotMonthly: boolean;
  /** UUID of FreeSpinConfig granted on subscription buy/upgrade and by the weekly cron. */
  freeSpinConfigId?: string | null;
};

// ✅ if user toggles ON but no percent is provided in label, persist this default
const DEFAULT_REWARD_PERCENT = 10;
const isFeatureEnabled = (value: unknown) =>
  value === true || value === "true" || value === 1 || value === "1";

const FEATURE_INDEX = {
  standardAccess: 0,
  promoCodes: 1,
  profileCustomization: 2,
  weeklyFreeSpins: 3,
  raffleEntry: 4,
  jackpotDaily: 5,
  jackpotWeekly: 6,
  jackpotMonthly: 7,
  increasedRewards: 8,
} as const;

function safeNumFromText(text: string): number {
  const m = text.match(/(\d+(\.\d+)?)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

function backendToUiToggles(features?: Partial<BackendFeatures>): boolean[] {
  const f = features ?? {};
  const increased =
    typeof f.increasedRewardsPercent === "string"
      ? Number(f.increasedRewardsPercent)
      : typeof f.increasedRewardsPercent === "number"
        ? f.increasedRewardsPercent
        : 0;

  const promoLimit =
    typeof f.promoCodesLimit === "string"
      ? Number(f.promoCodesLimit)
      : typeof f.promoCodesLimit === "number"
        ? f.promoCodesLimit
        : 0;

  return [
    isFeatureEnabled(f.standardAccess),
    promoLimit > 0,
    isFeatureEnabled(f.profileCustomization),
    isFeatureEnabled(f.weeklyFreeSpins),
    isFeatureEnabled(f.raffleEntry),
    isFeatureEnabled(f.jackpotDaily),
    isFeatureEnabled(f.jackpotWeekly),
    isFeatureEnabled(f.jackpotMonthly),
    increased > 0,
  ];
}

function uiToBackendFeatures(params: {
  toggles: boolean[];
  featuresText: string[];
  promoCodesLimit?: number;
  increasedRewardsPercent?: number;
  maxDevices?: number;
  freeSpinConfigId?: string | null;
}): BackendFeatures {
  const { toggles, featuresText, promoCodesLimit, increasedRewardsPercent, maxDevices, freeSpinConfigId } = params;

  const rewardsText = featuresText?.[FEATURE_INDEX.increasedRewards] ?? UI_FEATURES[FEATURE_INDEX.increasedRewards];
  const parsed = safeNumFromText(rewardsText);

  // ✅ critical fix: if ON but label doesn't include %, persist default
  const percent = toggles[FEATURE_INDEX.increasedRewards]
    ? Number.isFinite(Number(increasedRewardsPercent)) &&
      Number(increasedRewardsPercent) > 0
      ? Number(increasedRewardsPercent)
      : parsed > 0
        ? parsed
        : DEFAULT_REWARD_PERCENT
    : 0;

  return {
    standardAccess: !!toggles[FEATURE_INDEX.standardAccess],
    // When the promo toggle is ON, a 0 limit must fall back to 1 — otherwise it
    // persists as 0, and backendToUiToggles maps `0 > 0` back to OFF (auto-off bug).
    // `??` can't do this: it only catches null/undefined, not the valid number 0.
    promoCodesLimit: toggles[FEATURE_INDEX.promoCodes]
      ? Number(promoCodesLimit) > 0
        ? Number(promoCodesLimit)
        : 1
      : 0,
    profileCustomization: !!toggles[FEATURE_INDEX.profileCustomization],
    weeklyFreeSpins: !!toggles[FEATURE_INDEX.weeklyFreeSpins],
    raffleEntry: !!toggles[FEATURE_INDEX.raffleEntry],
    jackpotDaily: !!toggles[FEATURE_INDEX.jackpotDaily],
    jackpotWeekly: !!toggles[FEATURE_INDEX.jackpotWeekly],
    jackpotMonthly: !!toggles[FEATURE_INDEX.jackpotMonthly],
    increasedRewardsPercent: percent,
    // Clamped, never negative. 0 is meaningful here (inherit the default), so
    // it is passed through rather than coerced to a real limit.
    maxDevices: Math.max(0, Math.floor(Number(maxDevices) || 0)),
    // Always preserve the picked template, even when the toggle is off.
    // The backend triggers (weekly cron + buy/upgrade) only fire when BOTH
    // `weeklyFreeSpins === true` AND `freeSpinConfigId` is set — keeping the
    // UUID when the toggle is off lets admins pre-wire a template, then flip
    // the toggle on as a single deliberate action. (Originally we cleared
    // it on toggle-off; that broke the natural pick-template-first flow.)
    freeSpinConfigId: freeSpinConfigId ?? null,
  };
}

const toPriceString = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

/* ================= COMPONENT ================= */

export default function UserTierManagement() {
  const [openModal, setOpenModal] = useState(false);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [editData, setEditData] = useState<UserTierFormData | null>(null);
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [infoRow, setInfoRow] = useState<(typeof tierData)[0] | null>(null);

  // ✅ optimistic toggles to avoid UI not changing until store refresh
  const [optimisticToggles, setOptimisticToggles] = useState<
    Record<string, boolean[]>
  >({});

  const {
    plans,
    isLoading,
    error,
    fetchPlans,
    seedDefaultPlans,
    createPlan,
    updatePlan,
    togglePlan,
    clearError,
    deletePlan,
  } = useAdminSubscriptionStore();

  // initial fetch
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // error toast
  useEffect(() => {
    if (error) toast.error(error);
    return () => clearError();
  }, [error, clearError]);

  /** Build UI rows from backend plans */
  const tierData = useMemo(() => {
    const sorted = [...plans].sort(
      (a: any, b: any) => (a?.seq ?? 9999) - (b?.seq ?? 9999),
    );

    return sorted.map((p: any) => {
      const baseToggles = backendToUiToggles(p.features);
      const toggles = optimisticToggles[p.id] ?? baseToggles;

      const fallbackIcon =
        p.name?.toLowerCase() === "basic"
          ? basictierimage
          : p.name?.toLowerCase() === "player"
            ? playertierimage
            : p.name?.toLowerCase() === "hustler"
              ? hustlertierimage
              : basictierimage;

      // Keep same feature labels as your UI
      const featuresText = [...UI_FEATURES];

      // If there is a rewards percent, show it inside the label for clarity
      const rewardsPercent =
        typeof p?.features?.increasedRewardsPercent === "string"
          ? Number(p.features.increasedRewardsPercent)
          : typeof p?.features?.increasedRewardsPercent === "number"
            ? p.features.increasedRewardsPercent
            : 0;

      if (rewardsPercent > 0) {
        featuresText[FEATURE_INDEX.increasedRewards] = `Increased Vip Tier Rewards (${rewardsPercent}%)`;
      }

      const promoLimit =
        typeof p?.features?.promoCodesLimit === "string"
          ? Number(p.features.promoCodesLimit)
          : typeof p?.features?.promoCodesLimit === "number"
            ? p.features.promoCodesLimit
            : 0;

      if (promoLimit > 0) {
        featuresText[FEATURE_INDEX.promoCodes] = `Promo Codes for Exclusive Offers (limit: ${promoLimit})`;
      }

      const freeSpinConfigId =
        typeof p?.features?.freeSpinConfigId === "string" && p.features.freeSpinConfigId
          ? (p.features.freeSpinConfigId as string)
          : null;

      return {
        id: p.id as string,
        name: p.name as string,
        features: featuresText,
        toggles,
        increasedRewardsPercent: rewardsPercent,
        sequence: p.seq ?? 0,
        icon: p.iconUrl || fallbackIcon,
        createdAt: p.createdAt || "",
        isActive: !!p.isActive,
        prize: `${p.price ?? "0.00"}`,
        interval: p.interval ?? "MONTHLY",
        currency: p.currency ?? "USD",
        promoCodesLimit: promoLimit,
        // 0 = inherit the platform default. Read straight off `features` rather
        // than through the positional toggle array — it is a plain number, not a
        // feature flag, so it must not shift any index in that matrix.
        maxDevices:
          typeof p?.features?.maxDevices === "string"
            ? Number(p.features.maxDevices) || 0
            : typeof p?.features?.maxDevices === "number"
              ? p.features.maxDevices
              : 0,
        freeSpinConfigId,
      };
    });
  }, [plans, optimisticToggles]);

  const TIER_FILTERS = useMemo(() => {
    const names = tierData.map((tier) => tier.name);
    return ["All", ...Array.from(new Set(names))];
  }, [tierData]);

  /* ================= HANDLERS ================= */

  const toggleFeature = async (rowId: string, featureIndex: number) => {
    const row = tierData.find((t) => t.id === rowId);
    if (!row) return;

    const newToggles = row.toggles.map((t, j) => (j === featureIndex ? !t : t));

    // Block turning ON Weekly Free Spins without a wired template — the
    // weekly cron + buy/upgrade trigger would have nothing to grant.
    if (
      featureIndex === FEATURE_INDEX.weeklyFreeSpins &&
      newToggles[FEATURE_INDEX.weeklyFreeSpins] &&
      !(row as any).freeSpinConfigId
    ) {
      toast.error(
        "Pick a Free Spin template first, then turn Weekly Free Spins on.",
      );
      return;
    }

    // ✅ optimistic apply
    setOptimisticToggles((prev) => ({ ...prev, [rowId]: newToggles }));

    const featuresObj = uiToBackendFeatures({
      toggles: newToggles,
      featuresText: row.features,
      promoCodesLimit: (row as any).promoCodesLimit ?? 1,
      increasedRewardsPercent: (row as any).increasedRewardsPercent ?? 0,
      // Carried through, not defaulted. The whole `features` object is
      // overwritten on save, so omitting this would silently reset the tier's
      // device allowance to "inherit" every time an unrelated toggle is flipped.
      maxDevices: (row as any).maxDevices ?? 0,
      freeSpinConfigId: (row as any).freeSpinConfigId ?? null,
    });

    const payload: any = {
      name: row.name,
      seq: row.sequence,
      price: toPriceString(row.prize),
      currency: row.currency,
      interval: row.interval,
      isActive: row.isActive,
      iconUrl:
        typeof row.icon === "string" ? row.icon : (row.icon?.src ?? null),
      features: featuresObj,
    };

    const updated = await updatePlan(rowId, payload);

    if (updated) {
      toast.success("Feature updated");
      await fetchPlans();
      setOptimisticToggles((prev) => {
        const copy = { ...prev };
        delete copy[rowId];
        return copy;
      });
    } else {
      // rollback optimistic
      setOptimisticToggles((prev) => {
        const copy = { ...prev };
        delete copy[rowId];
        return copy;
      });
    }
  };

  /**
   * Change just the FreeSpinConfig template wired to a plan, leaving every
   * other feature toggle intact. Optimistic UI is skipped here because the
   * picker reads from the canonical store on next render — `fetchPlans()`
   * after success refreshes the row.
   */
  const handleFreeSpinConfigChange = async (
    rowId: string,
    nextConfigId: string | null,
  ) => {
    const row = tierData.find((t) => t.id === rowId);
    if (!row) return;

    const featuresObj = uiToBackendFeatures({
      toggles: row.toggles,
      featuresText: row.features,
      promoCodesLimit: (row as any).promoCodesLimit ?? 1,
      increasedRewardsPercent: (row as any).increasedRewardsPercent ?? 0,
      // Same reason as in the toggle handler: preserve, never reset.
      maxDevices: (row as any).maxDevices ?? 0,
      freeSpinConfigId: nextConfigId,
    });

    const payload: any = {
      name: row.name,
      seq: row.sequence,
      price: toPriceString(row.prize),
      currency: row.currency,
      interval: row.interval,
      isActive: row.isActive,
      iconUrl:
        typeof row.icon === "string" ? row.icon : (row.icon?.src ?? null),
      features: featuresObj,
    };

    const updated = await updatePlan(rowId, payload);
    if (updated) {
      toast.success("Free Spin template updated");
      await fetchPlans();
    }
  };

  const toggleActive = async (rowId: string) => {
    const updated = await togglePlan(rowId);
    if (updated)
      toast.success(`Plan ${updated.isActive ? "activated" : "deactivated"}`);
  };

  const handleEdit = (row: any) => {
    setEditData({
      id: row.id,
      name: row.name,
      features: row.features ?? [],
      toggles: row.toggles ?? [],
      promoCodesLimit: row.promoCodesLimit ?? 1,
      increasedRewardsPercent: row.increasedRewardsPercent ?? 0,
      maxDevices: row.maxDevices ?? 0,
      sequence: row.sequence,
      icon: typeof row.icon === "string" ? row.icon : (row.icon?.src ?? ""),

      isActive: row.isActive,
      prize: row.prize,
      interval: row.interval ?? "MONTHLY",
      currency: row.currency ?? "USD",
    } as any);

    setOpenModal(true);
  };

  const handleRemove = (rowId: string) => {
    setDeleteTierId(rowId);
  };

  const filteredTierData = useMemo(() => {
    if (selectedFilter === "All") return tierData;

    return tierData.filter(
      (tier) => tier.name.toLowerCase() === selectedFilter.toLowerCase(),
    );
  }, [tierData, selectedFilter]);

  /* ================= UI ================= */
  if (isLoading && filteredTierData.length === 0) {
    return (
      <div className="flex items-center justify-center h-120">
        <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#15181E] p-3 md:p-6 overflow-x-hidden flex flex-col">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-3 px-3 py-3 rounded-lg shrink-0 md:mb-4 md:px-4">
        <h1 className="text-sm text-white">User / Subscription Tier Management</h1>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#191D24] rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-2 shrink-0 md:mb-4">
        <Select value={selectedFilter} onValueChange={setSelectedFilter}>
          <SelectTrigger className="h-9 w-[150px] sm:w-[180px] bg-[#242B35] border-none text-xs text-white">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>

          <SelectContent className="bg-[#1a2030] border-gray-700">
            {TIER_FILTERS.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {tier}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
       

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-[#1a2030] border-gray-700"
            onClick={() => {
              // ✅ Create should open CREATE modal (not update)
              // keep editData = null, modal will show default features itself
              setEditData(null);
              setOpenModal(true);
            }}
            disabled={isLoading}
          >
            <Image src={create} alt="Create" width={20} height={20} />
          </Button>

          {plans.length === 0 && !isLoading && (
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white px-4"
              onClick={() => setSeedConfirmOpen(true)}
              disabled={isLoading}
            >
              Set Default
            </Button>
          )}

          <ConfirmSeedDialog
            open={seedConfirmOpen}
            title="Seed default subscription plans?"
            description="This creates the default subscription plans."
            effects={[
              "Missing default plans are created",
              "A default plan that already exists under the same name has its price, features and active status reset to the defaults",
              "Players' existing subscriptions are not moved or cancelled",
            ]}
            onCancel={() => setSeedConfirmOpen(false)}
            onConfirm={async () => {
              setSeedConfirmOpen(false);
              const seeded = await seedDefaultPlans();
              if (seeded) {
                toast.success("Default plans seeded successfully");
              }
            }}
          />

          <ExportCSV
            data={tierData}
            fileName="user_tier_management.csv"
            getRowDate={(row: any) => row.createdAt}
            headers={[
              "Name",
              "Sequence",
              "Created At",
              "Active",
              "Prize",
              "Features",
            ]}
            mapRow={(row: any) => [
              row.name,
              row.sequence,
              row.createdAt,
              row.isActive ? "Active" : "Inactive",
              row.prize,
              row.features.join(" | "),
            ]}
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 bg-[#15181E] rounded-lg overflow-hidden">
        <div className="h-full overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="sticky top-0 bg-[#242B35] z-10">
              <tr className="border-b border-gray-800">
                {[
                  "Name",
                  "Features",
                  "Seq",
                  "Icon",
                  "Created At",
                  "Active",
                  "Prize",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs text-white font-normal text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredTierData.map((row: any, rowIndex: number) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-800 ${
                    rowIndex % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  } hover:bg-[#1a2030]`}
                >
                  <td className="px-4 py-3 text-xs text-white font-medium">
                    {row.name}
                  </td>

                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      {row.features.map((feature: string, i: number) => {
                        const isPromo = UI_FEATURES[i] === "Promo Codes for Exclusive Offers";
                        const isJackpotGroup = i === JACKPOT_GROUP_INDEX;
                        const isJackpotChild =
                          i >= JACKPOT_DETAIL_START_INDEX &&
                          i < JACKPOT_DETAIL_START_INDEX + JACKPOT_DETAIL_LABELS.length;

                        if (isJackpotGroup || isJackpotChild) {
                          return null;
                        }

                        const isWeeklyFreeSpins = i === FEATURE_INDEX.weeklyFreeSpins;
                        return (
                          <div key={i} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-300">
                                  {isPromo
                                    ? "Promo Codes for Exclusive Offers"
                                    : feature}
                                </span>
                                {isPromo && (
                                  <button
                                    onClick={() => setInfoRow(row)}
                                    className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20 hover:bg-purple-500/40 transition-colors flex-shrink-0"
                                  >
                                    <Info size={10} className="text-purple-400" />
                                  </button>
                                )}
                              </div>
                              <Switch
                                checked={Boolean(row.toggles[i])}
                                onCheckedChange={() => toggleFeature(row.id, i)}
                                className="data-[state=checked]:bg-purple-500"
                              />
                            </div>

                            {/* Per-plan Free Spin template picker.
                                Always visible on the Weekly Free Spins row so
                                the admin can wire a template BEFORE turning the
                                feature on (otherwise the toggle is blocked).
                                The weekly cron + buy/upgrade trigger read from
                                this exact field on the plan record. */}
                            {isWeeklyFreeSpins && (
                              <div className="pl-3 pr-1">
                                <FreeSpinConfigSelect
                                  value={(row as any).freeSpinConfigId ?? null}
                                  onChange={(next) =>
                                    handleFreeSpinConfigChange(row.id, next)
                                  }
                                  triggerClassName="w-full bg-[#1A1F27] border border-gray-700 text-white text-[11px] h-8"
                                  placeholder="Pick Free Spin template"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {JACKPOT_GROUP_INDEX >= 0 && JACKPOT_DETAIL_START_INDEX >= 0 && (
                        <div className="rounded-lg bg-[#1A1F27] px-3 py-3 space-y-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-300">
                              {row.features[JACKPOT_GROUP_INDEX] || JACKPOT_GROUP_LABEL}
                            </span>
                            <button
                              onClick={() => setInfoRow(row)}
                              className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20 hover:bg-purple-500/40 transition-colors flex-shrink-0"
                            >
                              <Info size={10} className="text-purple-400" />
                            </button>
                          </div>

                          <div className="pl-4 space-y-2 border-l border-white/10">
                            {JACKPOT_DETAIL_LABELS.map((label, offset) => {
                              const featureIndex = JACKPOT_DETAIL_START_INDEX + offset;
                              return (
                                <div
                                  key={label}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="text-xs text-gray-300">
                                    {row.features[featureIndex] || label}
                                  </span>
                                  <Switch
                                    checked={Boolean(row.toggles[featureIndex])}
                                    onCheckedChange={() => toggleFeature(row.id, featureIndex)}
                                    className="data-[state=checked]:bg-purple-500"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.sequence}
                  </td>

                  <td className="px-4 py-3">
                    {typeof row.icon === "string" ? (
                      row.icon ? (
                        <img
                          src={row.icon}
                          alt="Tier Icon"
                          className="w-20 h-20 object-contain"
                        />
                      ) : (
                        <div className="w-16 h-16" />
                      )
                    ) : (
                      <Image
                        src={row.icon}
                        alt="Tier Icon"
                        width={60}
                        height={60}
                        className="object-contain"
                      />
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-300">
                    <div className="flex flex-col">
                      <span>
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "-"}
                      </span>
                      <span className="text-gray-400">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )
                          : ""}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={() => toggleActive(row.id)}
                      className="data-[state=checked]:bg-purple-500"
                    />
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.prize}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-red-400 hover:text-orange-400 transition-colors">
                          <Wrench size={16} />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        className="bg-[#1a2030] text-white p-2 border border-gray-700 rounded-md"
                      >
                        <div className="flex flex-col p-1 gap-2">
                          <DropdownMenuItem
                            onClick={() => handleEdit(row)}
                            className="text-sm flex items-center cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4 text-white" />
                            Edit
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleRemove(row.id)}
                            className="text-sm flex items-center text-red-600 cursor-pointer"
                          >
                            <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                            Remove
                          </DropdownMenuItem>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      <UserTierManagementModal
        open={openModal}
        initialData={editData} // ✅ null for create, object for edit
        onClose={() => setOpenModal(false)}
        onSubmit={async (data) => {
          const featuresObj = uiToBackendFeatures({
            toggles: data.toggles ?? [],
            featuresText: data.features ?? [],
            promoCodesLimit: (data as any).promoCodesLimit ?? 1,
            increasedRewardsPercent: (data as any).increasedRewardsPercent ?? 0,
            maxDevices: (data as any).maxDevices ?? 0,
          });

          const payload: any = {
            name: data.name,
            seq: data.sequence,
            iconUrl: data.icon || null,
            interval: data.interval ?? "MONTHLY",
            price: toPriceString(data.prize ?? "0.00"),
            currency: data.currency ?? "USD",
            isActive: data.isActive,
            features: featuresObj,
          };

          if (data?.id) {
            const updated = await updatePlan(data.id, payload);
            if (updated) toast.success("Details updated successfully");
          } else {
            const created = await createPlan(payload);
            if (created) toast.success("Details created successfully");
          }

          // refresh list so table reflects saved % and switch stays on after refresh
          await fetchPlans();
          setOpenModal(false);
        }}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDeleteDialog
        open={deleteTierId !== null}
        fileName={
          deleteTierId
            ? tierData.find((t: any) => t.id === deleteTierId)?.name
            : ""
        }
        onCancel={() => setDeleteTierId(null)}
        onConfirm={async () => {
          if (!deleteTierId) return;

          const ok = await deletePlan(deleteTierId);

          if (ok) {
            toast.success("Deleted successfully");
            setDeleteTierId(null);
            await fetchPlans();
          }
        }}
      />

      {/* PROMO CODE INFO MODAL */}
      {infoRow && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-[#1F2630] rounded-2xl p-6 w-full max-w-sm relative shadow-2xl border border-white/[0.06]">
            {/* Close */}
            <button
              onClick={() => setInfoRow(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-md bg-[#2A3140] flex items-center justify-center hover:bg-[#38404a] transition-colors text-white"
            >
              <X size={14} />
            </button>

            {/* Title */}
            <div className="flex items-center gap-2 mb-5">
              <h3 className="text-white text-base font-bold">Promo Code Details</h3>
            </div>

            {/* Plan name badge */}
            <div className="mb-4">
              <span className="text-xs text-gray-400">Plan: </span>
              <span className="text-xs text-white font-semibold">{infoRow.name}</span>
            </div>

            {/* Details card */}
            <div className="bg-[#15181E] rounded-xl px-4 py-4 space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Feature</span>
                <span className="text-xs text-white font-medium">Promo Codes for Exclusive Offers</span>
              </div>
              <div className="h-px bg-white/[0.05]" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Status</span>
                {(() => {
                  const promoIndex = UI_FEATURES.indexOf("Promo Codes for Exclusive Offers");
                  const enabled = Boolean(infoRow.toggles[promoIndex]);
                  return (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      enabled ? "bg-purple-500/20 text-purple-300" : "bg-gray-700/50 text-gray-500"
                    }`}>
                      {enabled ? "Enabled" : "Disabled"}
                    </span>
                  );
                })()}
              </div>
              <div className="h-px bg-white/[0.05]" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Usage Limit</span>
                <span className="text-sm font-bold text-purple-300">
                  {infoRow.promoCodesLimit > 0 ? `${infoRow.promoCodesLimit}` : "Not set"}
                </span>
              </div>
            </div>

           
           
          </div>
        </div>
      )}
    </div>
  );
}
