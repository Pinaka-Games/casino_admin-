"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Pencil, Trash2, Wrench, X, Info, Users } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";

import ExportCSV from "@/components/ExportCSV";
import { create } from "@/assets/images/action";

import AgentPackageManagementModal from "./components/AgentPackageManagementModel";
import ConfirmDeleteDialog from "./components/ConfirmDeleteDialog";
import { useAdminPackageStore } from "@/store/admin-package.store";
import { useGameStore } from "@/store/game-store";
import type { AgentPackage } from "@/types/agent-package.types";

export interface AgentPackageFormData {
  id?: string | number;
  icon?: string | any;
  name: string;
  features: string[];
  toggles: boolean[];
  sequence: number;
  isActive: boolean;
  prize: string;
  subtiers: string;
  createdAt?: string;
  ggrRates?: Record<string, number>;
  promoCodeLimit?: number;
  promoCodeMaxUsers?: number;
  promoCodeMaxPurchaseAmount?: number;
  promoDiscountMinPurchase?: number;
  promoDiscountMaxPurchase?: number;
  promoDiscountPercent?: number;
}

const DEFAULT_AGENT_PACKAGE_ICON =
  "https://dzyemtm911c4h.cloudfront.net/wulfcasino/hustler.svg";
const AGENT_TIER_ICONS_BY_SEQUENCE: Record<number, string> = {
  1: "https://dzyemtm911c4h.cloudfront.net/wulfcasino/basic.svg",
  2: "https://dzyemtm911c4h.cloudfront.net/wulfcasino/player.svg",
  3: "https://dzyemtm911c4h.cloudfront.net/wulfcasino/hustler.svg",
};

/* ================= GGR RATES MODAL ================= */

interface GgrRatesModalProps {
  open: boolean;
  onClose: () => void;
  planName: string;
  ggrRates: Record<string, number>;
  categories: { slug: string; name: string; id?: string | number }[];
}

// Dynamic categories only

function GgrRatesModal({
  open,
  onClose,
  planName,
  ggrRates,
  categories,
}: GgrRatesModalProps) {
  if (!open) return null;

  const displayCategories = categories;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#15181E] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1f2b]/60">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              GGR Commission Rates
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {planName} — default rates
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Rates Grid */}
        <div className="p-6 grid grid-cols-2 gap-3">
          {displayCategories.map((cat) => (
            <div
              key={cat.slug}
              className="flex items-center justify-between bg-[#1a2030] px-4 py-3 rounded-xl border border-gray-800/60 hover:border-purple-500/20 transition-colors group"
            >
              <span className="text-[11px] text-gray-400 group-hover:text-gray-300 transition-colors">
                {cat.name}
              </span>
              <span className="text-sm font-black text-green-400 tracking-wide">
                {ggrRates?.[cat.slug] ?? 0}%
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2 rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= FEATURE DETAILS MODAL ================= */

const FEATURE_DETAILS: Record<string, string> = {
  "Sub-Agent Creation": "Allows the agent to create and manage sub-agents under their network.",
  "Standard Promo Codes": "Enables the creation of standard promotional codes to attract new players.",
  "Player Referral Tracking": "Tracks and manages referrals made by players.",
  "Basic Reporting Dashboard": "Access to a basic dashboard with essential reporting and analytics.",
  "GGR Commission": "The commission you give here will automatically be added to the agent's base reward as (Base + Plan) in their My Rewards section based on the game category."
};

function FeatureDetailsModal({ open, onClose, title }: { open: boolean, onClose: () => void, title: string }) {
  if (!open) return null;
  const details = FEATURE_DETAILS[title] || "Detailed information for this feature is not provided.";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#15181E] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1f2b]/60">
          <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-300 leading-relaxed">{details}</p>
        </div>
        <div className="px-6 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2 rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= COMPONENT ================= */

export default function AgentPackageManagement() {
  const {
    packages,
    isLoading,
    fetchPackages,
    seedPackages,
    createPackage,
    updatePackage,
    deletePackage,
    togglePackage,
    applyPackageToAll,
    setPackageFeature,
    setAllPackagesActive,
  } = useAdminPackageStore();

  const {
    games,
    categories: storeCategories,
    fetchData: fetchGameData,
  } = useGameStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPlanData, setEditPlanData] = useState<AgentPackage | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [applyPlanId, setApplyPlanId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [bulkDisableOpen, setBulkDisableOpen] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isSeedDialogOpen, setIsSeedDialogOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [ggrModal, setGgrModal] = useState<{
    open: boolean;
    planName: string;
    ggrRates: Record<string, number>;
  }>({ open: false, planName: "", ggrRates: {} });

  const [featureDetailModal, setFeatureDetailModal] = useState<{ open: boolean; title: string }>({ open: false, title: "" });

  const handleSeed = async () => {
    setIsSeedDialogOpen(false);
    const success = await seedPackages();

    if (success) {
      toast.success("Default agent packages seeded successfully");
      return;
    }

    toast.error("Failed to seed default agent packages");
  };

  const openGgrModal = (planName: string, ggrRates: Record<string, number>) => {
    setGgrModal({ open: true, planName, ggrRates });
  };

  useEffect(() => {
    fetchPackages();
    fetchGameData().catch(() => {});
  }, [fetchPackages, fetchGameData]);

  const displayCategories = useMemo(() => {
    const isIgnoredCategory = (value?: string) => {
      const v = (value ?? "").trim().toLowerCase();
      return v === "test" || v === "testing";
    };

    const explicitCategories = (storeCategories || []).filter(
      (c) =>
        c.isActive !== false &&
        !isIgnoredCategory(c.name) &&
        !isIgnoredCategory(c.slug),
    );
    const gameUsedCategoriesSet = new Set(
      games
        .map((g) => g.category)
        .filter((cat) => Boolean(cat) && !isIgnoredCategory(String(cat))),
    );
    const gameUsedCategories = Array.from(gameUsedCategoriesSet).map(
      (catName) => {
        const explicit = explicitCategories.find((c) => c.name === catName);
        return (
          explicit || {
            id: catName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            slug: catName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            name: catName,
            displayOrder: 0,
            isActive: true,
          }
        );
      },
    );

    const allCategories = [...explicitCategories];
    gameUsedCategories.forEach((gc) => {
      if (
        !allCategories.find((ac) => ac.name === gc.name || ac.slug === gc.slug)
      ) {
        allCategories.push(gc as any);
      }
    });

    return allCategories.sort((a, b) => a.name.localeCompare(b.name));
  }, [storeCategories, games]);

  const mapToFormData = (pkg: AgentPackage): AgentPackageFormData => {
    const features: string[] = [];
    const toggles: boolean[] = [];
    let ggrRates = {};

    if (pkg.features && typeof pkg.features === "object") {
      Object.entries(pkg.features).forEach(([key, value]) => {
        if (key === "ggrRates") {
          ggrRates = value as any;
        } else if (typeof value === "boolean") {
          features.push(key);
          toggles.push(value);
        }
      });
    }

    const promoCodeLimit = Number(pkg.features?.promoCodeLimit ?? 0) || 0;
    const promoCodeMaxUsers = Number(pkg.features?.promoCodeMaxUsers ?? 0) || 0;
    const promoCodeMaxPurchaseAmount =
      Number(pkg.features?.promoCodeMaxPurchaseAmount ?? 0) || 0;
    const promoDiscountMinPurchase =
      Number(pkg.features?.promoDiscountMinPurchase ?? 0) || 0;
    const promoDiscountMaxPurchase =
      Number(pkg.features?.promoDiscountMaxPurchase ?? 0) || 0;
    const promoDiscountPercent =
      Number(pkg.features?.promoDiscountPercent ?? 0) || 0;

    const currentIcon =
      AGENT_TIER_ICONS_BY_SEQUENCE[pkg.seq] ||
      pkg.iconUrl ||
      DEFAULT_AGENT_PACKAGE_ICON;

    return {
      id: pkg.id,
      name: pkg.name,
      sequence: pkg.seq,
      icon: currentIcon,
      prize: pkg.price || "0",
      isActive: pkg.isActive,
      subtiers: String(pkg.subAgents || "0"),
      features,
      toggles,
      ggrRates,
      promoCodeLimit,
      promoCodeMaxUsers,
      promoCodeMaxPurchaseAmount,
      promoDiscountMinPurchase,
      promoDiscountMaxPurchase,
      promoDiscountPercent,
      createdAt: pkg.createdAt,
    };
  };

  const tierData = useMemo(() => {
    return packages.map(mapToFormData).sort((a, b) => a.sequence - b.sequence);
  }, [packages]);

  const PACKAGE_FILTERS = useMemo(() => {
    const names = tierData.map((t) => t.name);
    return ["All", ...Array.from(new Set(names))];
  }, [tierData]);

  const filteredData = useMemo(() => {
    if (selectedFilter === "All") return tierData;
    return tierData.filter(
      (p) => p.name.toLowerCase() === selectedFilter.toLowerCase(),
    );
  }, [tierData, selectedFilter]);

  const allPackagesActive = useMemo(
    () => packages.length > 0 && packages.every((p) => p.isActive),
    [packages],
  );

  /* ================= HANDLERS ================= */

  const applyBulkActive = async (next: boolean) => {
    setIsBulkSaving(true);
    const ok = await setAllPackagesActive(next);
    setIsBulkSaving(false);
    if (ok) {
      toast.success(next ? "All packages enabled" : "All packages disabled");
    } else {
      toast.error("Failed to update all packages");
    }
  };

  const handleEdit = (row: AgentPackageFormData) => {
    const pkg = packages.find((p) => p.id === row.id);
    if (pkg) {
      setIsModalOpen(true);
      setEditPlanData(pkg);
    }
  };

  const handleCreate = () => {
    setIsModalOpen(true);
    setEditPlanData(null);
  };

  const handleSavePlan = async (
    data: AgentPackageFormData,
  ): Promise<boolean> => {
    const featuresObj: Record<string, any> = {};
    (data.features || []).forEach((f, i) => {
      if (f.trim()) featuresObj[f.trim()] = data.toggles?.[i] ?? true;
    });
    if (data.ggrRates && Object.keys(data.ggrRates).length > 0) {
      featuresObj.ggrRates = data.ggrRates;
    }
    if ((data.promoCodeLimit ?? 0) > 0) {
      featuresObj.promoCodeLimit = Number(data.promoCodeLimit);
    }
    if ((data.promoCodeMaxUsers ?? 0) > 0) {
      featuresObj.promoCodeMaxUsers = Number(data.promoCodeMaxUsers);
    }
    if ((data.promoCodeMaxPurchaseAmount ?? 0) > 0) {
      featuresObj.promoCodeMaxPurchaseAmount = Number(data.promoCodeMaxPurchaseAmount);
    }
    if ((data.promoDiscountMinPurchase ?? 0) > 0) {
      featuresObj.promoDiscountMinPurchase = Number(data.promoDiscountMinPurchase);
    }
    if ((data.promoDiscountMaxPurchase ?? 0) > 0) {
      featuresObj.promoDiscountMaxPurchase = Number(data.promoDiscountMaxPurchase);
    }
    if ((data.promoDiscountPercent ?? 0) > 0) {
      featuresObj.promoDiscountPercent = Number(data.promoDiscountPercent);
    }
    const iconUrl =
      typeof data.icon === "string"
        ? data.icon
        : (data.icon?.src ?? undefined);
    const payload = {
      name: data.name,
      seq: data.sequence,
      iconUrl:
        iconUrl ||
        AGENT_TIER_ICONS_BY_SEQUENCE[data.sequence] ||
        DEFAULT_AGENT_PACKAGE_ICON,
      price: data.prize,
      currency: "USD",
      interval: "MONTHLY" as const,
      features: featuresObj,
      isActive: data.isActive,
      subAgents: data.subtiers,
    };
    if (data.id) {
      const result = await updatePackage(String(data.id), payload);
      return !!result;
    }
    const result = await createPackage(payload);
    return !!result;
  };

  const toggleFeatureInRow = async (
    pkg: AgentPackageFormData,
    featureIndex: number,
  ) => {
    if (!pkg.id) return;
    const feature = pkg.features?.[featureIndex];
    if (!feature) return;
    const enabled = !pkg.toggles?.[featureIndex];

    const result = await setPackageFeature(String(pkg.id), feature, enabled);
    if (result) {
      toast.success(`"${feature}" ${enabled ? "enabled" : "disabled"}`);
    } else {
      toast.error(`Failed to update "${feature}"`);
    }
  };

  /* ================= UI LOADING ================= */

  if (isLoading && packages.length === 0) {
    return (
      <div className="flex items-center justify-center h-120">
        <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
      </div>
    );
  }

  /* ================= MAIN RENDER ================= */

  return (
    <div className="h-full w-full bg-[#15181E] p-3 md:p-6 overflow-x-hidden flex flex-col">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-3 rounded-lg shrink-0">
        <h1 className="text-sm text-white">
          Dashboard / Agent Package Management
        </h1>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#191D24] rounded-lg px-3 py-2 mb-4 flex items-center justify-between shrink-0">
        <Select value={selectedFilter} onValueChange={setSelectedFilter}>
          <SelectTrigger className="h-9 w-[180px] bg-[#242B35] border-none text-xs text-white">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a2030] border-gray-700">
            {PACKAGE_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-2 rounded-md bg-[#242B35] px-3 h-9">
            <span className="text-xs text-gray-300">
              {allPackagesActive ? "All Packages On" : "Packages Disabled"}
            </span>
            <Switch
              checked={allPackagesActive}
              disabled={isLoading || isBulkSaving || packages.length === 0}
              onCheckedChange={(next) => {
                if (!next) setBulkDisableOpen(true);
                else applyBulkActive(true);
              }}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>

          {/* <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-[#1a2030] border-gray-700"
            onClick={handleCreate}
            disabled={isLoading}
          >
            <Image src={create} alt="Create" width={20} height={20} />
          </Button> */}

          {packages.length === 0 && !isLoading && (
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white px-4"
              onClick={() => setIsSeedDialogOpen(true)}
              disabled={isLoading}
            >
              Set Default
            </Button>
          )}

          <ExportCSV
            data={tierData}
            fileName="agent_packages.csv"
            getRowDate={(row) => row.createdAt}
            headers={[
              "Name",
              "Seq",
              "Created At",
              "Active",
              "Sub-Agents",
              "Prize",
            ]}
            mapRow={(row) => [
              row.name,
              row.sequence,
              row.createdAt || "",
              row.isActive ? "Active" : "Inactive",
              row.subtiers,
              row.prize,
            ]}
          />
        </div>
      </div>

      {/* <PlanComparisonDashboard packages={packages} /> */}

      {/* TABLE */}
      <div className="flex-1 bg-[#15181E] rounded-lg overflow-hidden">
        <div className="h-full overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#242B35] z-10">
              <tr className="border-b border-gray-800">
	                {[
	                  "Name",
	                  "Features",
	                  "Promo Config",
	                  "Seq",
	                  "Icon",
                  "Created At",
                  "Active",
                  "Sub-Agents",
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
              {filteredData.map((row, rowIndex) => (
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
                      {row.features.map((feature, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-300">
                              {feature}
                            </span>
                            <Info 
                              size={13} 
                              className="text-gray-500 hover:text-purple-400 transition-colors cursor-pointer" 
                              onClick={() => setFeatureDetailModal({ open: true, title: feature })}
                            />
                          </div>
                          <Switch
                            checked={Boolean(row.toggles[i])}
                            onCheckedChange={() => toggleFeatureInRow(row, i)}
                            className="data-[state=checked]:bg-purple-500"
                          />
                        </div>
                      ))}

	                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-green-400">
                            GGR Commission
                          </span>
                          <Info 
                            size={13} 
                            className="text-gray-500 hover:text-green-400 transition-colors cursor-pointer" 
                            onClick={() => setFeatureDetailModal({ open: true, title: "GGR Commission" })}
                          />
                        </div>
                        <button
                          onClick={() =>
                            openGgrModal(row.name, row.ggrRates ?? {})
                          }
                          className="text-[10px] text-green-400 hover:text-green-300 border border-green-500/30 px-2 py-0.5 rounded"
                        >
                          View
                        </button>
                      </div>
	                    </div>
	                  </td>

	                  <td className="px-4 py-3">
	                    {(() => {
	                      const standardPromoIndex = row.features.findIndex(
	                        (feature) =>
	                          feature === "Standard Promo Codes" ||
	                          feature === "Promo Codes" ||
	                          feature === "Agent Promo Code",
	                      );
	                      const standardPromoEnabled =
	                        standardPromoIndex >= 0
	                          ? Boolean(row.toggles[standardPromoIndex])
	                          : false;
	                      if (!standardPromoEnabled) {
	                        return <span className="text-xs text-gray-500">-</span>;
	                      }

	                      return (
	                        <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2">
	                          <div className="space-y-1">
	                            <div className="flex items-center justify-between text-[11px] gap-1">
	                              <span className="text-gray-400">Promo code limit</span>
	                              <span className="text-white font-semibold">
	                                {row.promoCodeLimit && row.promoCodeLimit > 0 ? row.promoCodeLimit : "-"}
	                              </span>
	                            </div>
	                            <div className="flex items-center justify-between text-[11px] gap-1">
	                              <span className="text-gray-400">Users per promo code</span>
	                              <span className="text-white font-semibold">
	                                {row.promoCodeMaxUsers && row.promoCodeMaxUsers > 0 ? row.promoCodeMaxUsers : "-"}
	                              </span>
	                            </div>
	                            <div className="flex items-center justify-between text-[11px] gap-1">
	                              <span className="text-gray-400">Max purchase limit</span>
	                              <span className="text-white font-semibold">
	                                {row.promoCodeMaxPurchaseAmount && row.promoCodeMaxPurchaseAmount > 0
	                                  ? row.promoCodeMaxPurchaseAmount
	                                  : "-"}
	                              </span>
	                            </div>
	                            <div className="flex items-center justify-between text-[11px] gap-1">
	                              <span className="text-gray-400">Discount slab</span>
	                              <span className="text-white font-semibold">
	                                {row.promoDiscountMinPurchase &&
	                                row.promoDiscountMinPurchase > 0 &&
	                                row.promoDiscountMaxPurchase &&
	                                row.promoDiscountMaxPurchase > 0 &&
	                                row.promoDiscountPercent &&
	                                row.promoDiscountPercent > 0
	                                  ? `${row.promoDiscountMinPurchase} to ${row.promoDiscountMaxPurchase} = ${row.promoDiscountPercent}%`
	                                  : "-"}
	                              </span>
	                            </div>
	                          </div>
	                        </div>
	                      );
	                    })()}
	                  </td>

	                  <td className="px-4 py-3 text-xs text-gray-300">
	                    {row.sequence}
	                  </td>

                  <td className="px-4 py-3">
                    {typeof row.icon === "string" ? (
                      row.icon ? (
                        <img
                          src={row.icon}
                          alt="Package Icon"
                          className="w-20 h-20 object-contain"
                          onError={(e) => {
                            e.currentTarget.src =
                              DEFAULT_AGENT_PACKAGE_ICON;
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16" />
                      )
                    ) : (
                      <Image
                        src={row.icon}
                        alt="Package Icon"
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
                      onCheckedChange={() =>
                        row.id && togglePackage(String(row.id))
                      }
                      className="data-[state=checked]:bg-purple-500"
                    />
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.subtiers}
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
                            onClick={() =>
                              row.id && setApplyPlanId(String(row.id))
                            }
                            className="text-sm flex items-center cursor-pointer"
                          >
                            <Users className="mr-2 h-4 w-4 text-white" />
                            Apply to all agents
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              row.id && setDeletePlanId(String(row.id))
                            }
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

      {/* GGR Rates Modal */}
      <GgrRatesModal
        open={ggrModal.open}
        onClose={() => setGgrModal((s) => ({ ...s, open: false }))}
        planName={ggrModal.planName}
        ggrRates={ggrModal.ggrRates}
        categories={displayCategories}
      />

      {/* Feature Details Modal */}
      <FeatureDetailsModal
        open={featureDetailModal.open}
        onClose={() => setFeatureDetailModal({ open: false, title: "" })}
        title={featureDetailModal.title}
      />

      <AgentPackageManagementModal
        open={isModalOpen}
        initialData={editPlanData ? mapToFormData(editPlanData) : null}
        onClose={() => {
          setIsModalOpen(false);
          setEditPlanData(null);
        }}
        onSubmit={async (data) => {
          const success = await handleSavePlan(data);
          if (success) {
            toast.success(
              editPlanData
                ? "Package updated successfully"
                : "New package created",
            );
          }
          return success;
        }}
      />

      <ConfirmDeleteDialog
        open={deletePlanId !== null}
        fileName={packages.find((p) => p.id === deletePlanId)?.name || ""}
        onCancel={() => setDeletePlanId(null)}
        onConfirm={async () => {
          if (!deletePlanId) return;
          const success = await deletePackage(deletePlanId);
          if (success) toast.success("Package removed successfully");
        }}
      />

      <AlertDialog
        open={bulkDisableOpen}
        onOpenChange={(o) => !o && setBulkDisableOpen(false)}
      >
        <AlertDialogContent className="bg-[#15181E] border border-[#2a2f3a] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Disable all packages?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Every package will be set inactive and hidden from the agent
              catalog. Existing agent subscriptions stay, but no package can be
              bought until you turn this back on.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isBulkSaving}
              className="border-gray-600 bg-transparent text-white hover:bg-white/5 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkSaving}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={async (e) => {
                e.preventDefault();
                await applyBulkActive(false);
                setBulkDisableOpen(false);
              }}
            >
              {isBulkSaving ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </span>
              ) : (
                "Disable all"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={applyPlanId !== null}
        onOpenChange={(o) => !o && setApplyPlanId(null)}
      >
        <AlertDialogContent className="bg-[#15181E] border border-[#2a2f3a] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply package to all agents?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Every agent will be moved to{" "}
              <span className="text-white font-medium">
                {packages.find((p) => p.id === applyPlanId)?.name || "this package"}
              </span>
              . Agents already on it are skipped; agents on a different package are
              upgraded to this one. This affects all agents at once.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isApplying}
              className="border-gray-600 bg-transparent text-white hover:bg-white/5 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isApplying}
              className="bg-purple-600 text-white hover:bg-purple-700"
              onClick={async (e) => {
                e.preventDefault();
                if (!applyPlanId) return;
                setIsApplying(true);
                const result = await applyPackageToAll(applyPlanId);
                setIsApplying(false);
                if (result) {
                  toast.success(result.message);
                  setApplyPlanId(null);
                } else {
                  toast.error("Failed to apply package to all agents");
                }
              }}
            >
              {isApplying ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </span>
              ) : (
                "Apply to all"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmSeedDialog
        open={isSeedDialogOpen}
        title="Set default agent packages?"
        description="This creates the default agent packages."
        effects={[
          "Missing default packages are created",
          "Default packages that were deleted earlier are restored",
          "A restored or existing default package has its price, sub-agent limit, features and active status reset to the defaults",
          "Packages you created yourself are not touched",
        ]}
        onCancel={() => setIsSeedDialogOpen(false)}
        onConfirm={handleSeed}
      />
    </div>
  );
}
