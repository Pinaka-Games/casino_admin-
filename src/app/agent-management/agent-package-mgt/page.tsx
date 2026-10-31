"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, Info, Eye, X, Wrench } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExportCSV from "@/components/ExportCSV";

// import AgentPackageManagementModal from "./components/AgentPackageManagementModel";
// import ConfirmDeleteDialog from "./components/ConfirmDeleteDialog";
import { useAdminPackageStore } from "@/store/admin-package.store";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { useGameStore } from "@/store/game-store";
import type { AgentPackage } from "@/types/agent-package.types";
import { getAdminCategories, type Category } from "@/api/games/games";
import { NODATA } from "dns";
import NoData from "@/components/NoData";
import { PackagePaymentModal, type PaymentProvider } from "./components/PackagePaymentModal";
import { PackageCoinflowEmbed } from "./components/PackageCoinflowEmbed";
import {
  agentCreateBreezeCheckout,
  agentVerifyBreezeCheckout,
  agentCreateCoinflowCheckout,
  agentConfirmCoinflowCheckout,
  type CoinflowCheckoutParams,
} from "@/api/package/agent-package.api";

/* ================= TIER ICON CONSTANTS ================= */
// const DEFAULT_AGENT_PACKAGE_ICON =
//   "https://dzyemtm911c4h.cloudfront.net/wulfcasino/hustler.svg";
// const AGENT_TIER_ICONS_BY_SEQUENCE: Record<number, string> = {
//   1: "https://dzyemtm911c4h.cloudfront.net/wulfcasino/basic.svg",
//   2: "https://dzyemtm911c4h.cloudfront.net/wulfcasino/player.svg",
//   3: "https://dzyemtm911c4h.cloudfront.net/wulfcasino/hustler.svg",
// };

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

/* ================= HELPERS ================= */

const isFreePlan = (price?: string) => {
  const n = Number(price ?? "0");
  return !Number.isNaN(n) && n <= 0;
};

/* ================= GGR MODAL ================= */

// Dynamic categories only

function GgrRatesModal({
  open,
  onClose,
  planName,
  ggrRates,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  planName: string;
  ggrRates: Record<string, number>;
  categories: { slug: string; name: string; id?: string | number }[];
}) {
  if (!open) return null;
  const displayCats = categories;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto py-3 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#15181E] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-3 sm:mx-4 max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5 bg-[#1a1f2b]/60 rounded-t-2xl">
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
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayCats.map((cat) => (
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
      </div>
    </div>
  );
}

/* ================= FEATURE INFO MODAL ================= */

function FeatureInfoModal({
  open,
  onClose,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
}) {
  if (!open) return null;

  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const heading = lines[0] ?? "";
  const detailLines = lines.slice(1);
  const keyValueRows = detailLines
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return null;
      return {
        label: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      };
    })
    .filter((row): row is { label: string; value: string } => Boolean(row));
  const showStructured =
    title.toLowerCase().includes("standard promo codes") &&
    keyValueRows.length > 0 &&
    !description.includes("\n\n");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto py-3 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#15181E] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-3 sm:mx-4 max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5 bg-gradient-to-r from-[#1a1f2b]/90 to-[#202838]/70 rounded-t-2xl">
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {showStructured && heading && (
              <p className="text-[11px] text-gray-400 mt-0.5">{heading}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">
          {showStructured ? (
            <div className="space-y-2">
              {keyValueRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1a2030]/70 px-4 py-3"
                >
                  <span className="text-[12px] text-gray-400">{row.label}</span>
                  <span className="text-[13px] font-bold text-white">{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{description}</p>
          )}
        </div>
      
      </div>
    </div>
  );
}

/* ================= SKELETON ================= */

function AgentPackageSkeleton({ colCount }: { colCount: number }) {
  const cols = Math.max(colCount, 1);
  return (
    <div className="w-full overflow-x-auto rounded-2xl bg-[#13181E] shadow-xl">
      <div
        className="min-w-[900px] border border-[#222830] rounded-xl"
        style={{
          display: "grid",
          gridTemplateColumns: `2.5fr repeat(${cols}, 1fr)`,
        }}
      >
        <div className="h-28 shimmer border-r border-b border-[#222830]" />
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-28 shimmer border-r border-b border-[#222830]"
          />
        ))}
        {Array.from({ length: 7 }).map((_, row) => (
          <React.Fragment key={row}>
            <div className="h-11 shimmer border-r border-b border-[#222830]" />
            {Array.from({ length: cols }).map((_, col) => (
              <div
                key={col}
                className="h-11 shimmer border-r border-b border-[#222830]"
              />
            ))}
          </React.Fragment>
        ))}
        <div className="h-24 border-r border-[#222830]" />
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-24 shimmer border-r border-[#222830]" />
        ))}
      </div>
    </div>
  );
}

/* ================= MAP PLAN -> FORM DATA ================= */

function mapToFormData(pkg: AgentPackage): AgentPackageFormData {
  const features: string[] = [];
  const toggles: boolean[] = [];
  let ggrRates: Record<string, number> = {};
  let promoCodeLimit = 0;
  let promoCodeMaxUsers = 0;
  let promoCodeMaxPurchaseAmount = 0;
  let promoDiscountMinPurchase = 0;
  let promoDiscountMaxPurchase = 0;
  let promoDiscountPercent = 0;

  if (pkg.features && typeof pkg.features === "object") {
    Object.entries(pkg.features).forEach(([key, value]) => {
      if (key === "ggrRates") {
        ggrRates = value as Record<string, number>;
      } else if (key === "promoCodeLimit") {
        promoCodeLimit = Number(value) || 0;
      } else if (key === "promoCodeMaxUsers") {
        promoCodeMaxUsers = Number(value) || 0;
      } else if (key === "promoCodeMaxPurchaseAmount") {
        promoCodeMaxPurchaseAmount = Number(value) || 0;
      } else if (key === "promoDiscountMinPurchase") {
        promoDiscountMinPurchase = Number(value) || 0;
      } else if (key === "promoDiscountMaxPurchase") {
        promoDiscountMaxPurchase = Number(value) || 0;
      } else if (key === "promoDiscountPercent") {
        promoDiscountPercent = Number(value) || 0;
      } else if (typeof value === "boolean") {
        features.push(key);
        toggles.push(value);
      } else {
        // Ignore non-boolean config keys in feature matrix rows.
      }
    });
  }

  return {
    id: pkg.id,
    name: pkg.name,
    sequence: pkg.seq,
    icon:
      AGENT_TIER_ICONS_BY_SEQUENCE[pkg.seq] ||
      pkg.iconUrl ||
      DEFAULT_AGENT_PACKAGE_ICON,
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
}

/* ================= MAIN PAGE ================= */

export default function AgentPackageManagement() {
  const {
    packages: plans,
    isLoading,
    fetchPackages,
    togglePackage,
    deletePackage,
  } = useAdminPackageStore();

  const {
    currentPackage,
    isLoading: agentLoading,
    fetchCurrentPackage,
    buyPlan,
    upgradePlan,
  } = useAgentPackageStore();

  const {
    games,
    categories: storeCategories,
    fetchData: fetchGameData,
  } = useGameStore();

  const [processingPlanId, setProcessingPlanId] = React.useState<string | null>(
    null,
  );
  // Which payment provider is mid-checkout — so only that button spins.
  const [processingProvider, setProcessingProvider] =
    React.useState<PaymentProvider | null>(null);
  const loadingAction = agentLoading;
  const [searchQuery, setSearchQuery] = React.useState("");

  // Payment-method selection (Breeze / Coinflow) for buy/upgrade.
  const [paymentModal, setPaymentModal] = React.useState<{
    planId: string;
    planName: string;
    price: string;
    actionLabel: "Buy" | "Upgrade";
  } | null>(null);

  // Coinflow embedded checkout (recurring) — open after the method picker.
  const [coinflowCheckout, setCoinflowCheckout] = React.useState<{
    params: CoinflowCheckoutParams;
    planId: string;
    planName: string;
  } | null>(null);

  React.useEffect(() => {
    fetchPackages();
    fetchCurrentPackage();
    fetchGameData().catch(() => {});
  }, [fetchPackages, fetchCurrentPackage, fetchGameData]);

  const displayCategories = React.useMemo(() => {
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

  const tierData = React.useMemo(
    () =>
      plans
        .filter((p) => p.isActive)
        .map(mapToFormData)
        .sort((a, b) => a.sequence - b.sequence),
    [plans],
  );

  const filteredData = React.useMemo(
    () =>
      tierData.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [tierData, searchQuery],
  );

  const handleEdit = (row: AgentPackageFormData) => {
    // modal editing reserved for future use
  };

  // Step 1: validate the click, then open the payment-method modal.
  const requestPurchase = (clickedPlanId: string, clickedPrice: string) => {
    if (isFreePlan(clickedPrice)) return;
    if (loadingAction) return;

    const currentPlanId = currentPackage?.packageId;

    // Same plan → already have
    if (currentPlanId === clickedPlanId) {
      toast.error("You already have this plan.");
      return;
    }

    // Compare seq for upgrade/downgrade (only when already subscribed)
    if (currentPlanId) {
      const currentSeq = plans.find((p) => p.id === currentPlanId)?.seq ?? 0;
      const clickedSeq = plans.find((p) => p.id === clickedPlanId)?.seq ?? 0;
      if (clickedSeq < currentSeq) {
        toast.error("Cannot downgrade to a lower tier plan.");
        return;
      }
    }

    const planName =
      plans.find((p) => p.id === clickedPlanId)?.name ?? "this plan";
    setPaymentModal({
      planId: clickedPlanId,
      planName,
      price: clickedPrice,
      actionLabel: currentPlanId ? "Upgrade" : "Buy",
    });
  };

  // Step 2: payment method chosen → start the chosen provider's checkout.
  // Breeze = hosted redirect (verify on return). Coinflow = embedded recurring
  // checkout (<CoinflowPurchase>), activated from the in-page success event.
  const handleConfirmPayment = async (provider: PaymentProvider) => {
    if (!paymentModal) return;

    const { planId, planName } = paymentModal;

    if (provider === "COINFLOW") {
      try {
        setProcessingPlanId(planId);
        setProcessingProvider("COINFLOW");
        const res = await agentCreateCoinflowCheckout({ planId });
        setPaymentModal(null);
        setCoinflowCheckout({
          params: res.coinflowCheckout,
          planId,
          planName,
        });
      } catch (e: any) {
        toast.error(
          e?.response?.data?.message || "Failed to start Coinflow checkout.",
        );
      } finally {
        setProcessingPlanId(null);
        setProcessingProvider(null);
      }
      return;
    }

    if (provider !== "BREEZE") return;

    const base = `${window.location.origin}/agent-management/agent-package-mgt`;

    try {
      setProcessingPlanId(planId);
      setProcessingProvider("BREEZE");
      const res = await agentCreateBreezeCheckout({
        planId,
        successReturnUrl: `${base}?breeze=success`,
        failReturnUrl: `${base}?breeze=failed`,
      });
      // Remember what we're paying for so we can verify after returning.
      sessionStorage.setItem(
        "breeze_pkg_checkout",
        JSON.stringify({ pageId: res.pageId, planId }),
      );
      // Redirect to the hosted Breeze payment page.
      window.location.href = res.url;
    } catch (e: any) {
      setProcessingPlanId(null);
      setProcessingProvider(null);
      toast.error(
        e?.response?.data?.message || "Failed to start Breeze checkout.",
      );
    }
  };

  // Coinflow in-page success → confirm with the backend (webhook-independent) and
  // activate the plan.
  const handleCoinflowSuccess = async (paymentId?: string) => {
    if (!coinflowCheckout) return;
    const { planId } = coinflowCheckout;
    try {
      const r = await agentConfirmCoinflowCheckout(planId, paymentId);
      if (r.activated) {
        toast.success("Payment confirmed — plan activated!");
        fetchCurrentPackage();
      } else {
        toast.error("Payment not completed yet.");
      }
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Could not confirm Coinflow payment.",
      );
    } finally {
      setCoinflowCheckout(null);
    }
  };

  // On return from Breeze: confirm payment and activate the plan.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const breeze = params.get("breeze");
    if (!breeze) return;

    const clean = () =>
      window.history.replaceState({}, "", window.location.pathname);

    if (breeze === "failed") {
      toast.error("Payment was cancelled or failed.");
      sessionStorage.removeItem("breeze_pkg_checkout");
      clean();
      return;
    }

    if (breeze === "success") {
      const raw = sessionStorage.getItem("breeze_pkg_checkout");
      sessionStorage.removeItem("breeze_pkg_checkout");
      if (!raw) {
        clean();
        return;
      }
      const { pageId, planId } = JSON.parse(raw) as {
        pageId: string;
        planId: string;
      };
      (async () => {
        try {
          const r = await agentVerifyBreezeCheckout(pageId, planId);
          if (r.activated) {
            toast.success("Payment confirmed — plan activated!");
            fetchCurrentPackage();
          } else {
            toast.error(
              `Payment not completed yet (status: ${r.status ?? "pending"}).`,
            );
          }
        } catch (e: any) {
          toast.error(
            e?.response?.data?.message || "Could not verify payment.",
          );
        } finally {
          clean();
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading && plans.length === 0) {
    return (
      <div className="flex flex-col min-h-dvh p-3 sm:p-6 bg-[#0B0E14]">
        <div className="bg-[#191D24] mb-3 sm:mb-4 px-3 sm:px-4 py-3 rounded-lg">
          <h1 className="text-sm text-white font-medium capitalize leading-snug">
            Dashboard / Agent Package Management
          </h1>
        </div>
        <AgentPackageSkeleton colCount={3} />
      </div>
    );
  }

  return (
    <div className="flex flex-col p-3 sm:p-6 bg-[#0B0E14]">
      {/* BREADCRUMB */}
      <div className="bg-[#191D24] mb-3 sm:mb-4 px-3 sm:px-4 py-3 rounded-lg shrink-0">
        <h1 className="text-sm text-white font-medium capitalize leading-snug">
          Dashboard / Agent Package Management
        </h1>
      </div>

      {/* TABLE CARD */}
      <div className="bg-[#15181E] rounded-xl border border-white/5 flex flex-col shadow-2xl">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-24 text-gray-500">
            <Wrench size={36} className="mb-3 opacity-20" />
            <p className="text-sm">
              <NoData />
            </p>
          </div>
        ) : (
          <AgentPackageTable
            tiers={filteredData}
            categories={displayCategories}
            onEdit={handleEdit}
            onDelete={(id) => {
              /* delete reserved */
            }}
            onToggle={(id) => togglePackage(String(id))}
            isLoading={isLoading}
            currentPlanId={currentPackage?.packageId}
            allPlans={plans}
            onBuyOrUpgrade={requestPurchase}
            loadingAction={loadingAction}
            processingPlanId={processingPlanId}
          />
        )}
      </div>

      <PackagePaymentModal
        isOpen={!!paymentModal}
        onClose={() => {
          if (processingPlanId) return;
          setPaymentModal(null);
        }}
        onSelect={handleConfirmPayment}
        planName={paymentModal?.planName ?? ""}
        price={paymentModal?.price ?? 0}
        actionLabel={paymentModal?.actionLabel}
        processing={!!processingPlanId}
        processingProvider={processingProvider}
      />

      {/* Coinflow embedded recurring checkout */}
      {coinflowCheckout && (
        <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[92dvh]">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-200 bg-[#F8FAFC] shrink-0 gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B146F5]">
                  Coinflow checkout
                </p>
                <p className="text-sm font-bold text-gray-800">
                  {coinflowCheckout.planName}
                </p>
              </div>
              <button
                onClick={() => setCoinflowCheckout(null)}
                className="p-2 rounded-lg bg-black/5 text-gray-500 hover:text-black hover:bg-black/10 transition-all"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PackageCoinflowEmbed
                checkout={coinflowCheckout.params}
                onSuccess={handleCoinflowSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= TABLE COMPONENT ================= */

function AgentPackageTable({
  tiers,
  categories,
  onEdit,
  onDelete,
  onToggle,
  isLoading,
  currentPlanId,
  allPlans,
  onBuyOrUpgrade,
  loadingAction,
  processingPlanId,
}: {
  tiers: AgentPackageFormData[];
  categories: { slug: string; name: string; id?: string | number }[];
  onEdit: (row: AgentPackageFormData) => void;
  onDelete: (id: string | number) => void;
  onToggle: (id: string | number) => void;
  isLoading: boolean;
  currentPlanId?: string;
  allPlans: AgentPackage[];
  onBuyOrUpgrade: (planId: string, price: string) => void;
  loadingAction: boolean;
  processingPlanId: string | null;
}) {
  const [infoModal, setInfoModal] = React.useState<{
    open: boolean;
    title: string;
    desc: string;
  }>({ open: false, title: "", desc: "" });

  const [ggrModal, setGgrModal] = React.useState<{
    open: boolean;
    planName: string;
    ggrRates: Record<string, number>;
  }>({ open: false, planName: "", ggrRates: {} });

  // Collect all unique feature names across all plans (preserving order)
  const allFeatures = React.useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    tiers.forEach((t) =>
      t.features.forEach((f) => {
        if (!seen.has(f)) {
          seen.add(f);
          list.push(f);
        }
      }),
    );
    return list;
  }, [tiers]);

  // Current plan's feature set for locked-feature highlighting
  const currentTier = React.useMemo(
    () => tiers.find((t) => String(t.id) === currentPlanId) ?? null,
    [tiers, currentPlanId],
  );

  const getFeatureEnabled = (
    tier: AgentPackageFormData,
    featureName: string,
  ) => {
    const idx = tier.features.indexOf(featureName);
    return idx !== -1 ? tier.toggles[idx] : false;
  };

  const isStandardPromoFeature = (featureName: string) => {
    const name = featureName.trim().toLowerCase();
    return (
      name === "standard promo codes" ||
      name === "promo codes" ||
      name === "agent promo code"
    );
  };

  const colCount = tiers.length;

  return (
    <>
      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div
          className="grid min-w-[900px] w-full border border-[#222830] rounded-b-xl"
          style={{
            gridTemplateColumns: `2.5fr repeat(${Math.max(colCount, 1)}, 1fr)`,
          }}
        >
          {/* ─── HEADER ROW ─── */}
          <div className="bg-[#1d232b] flex items-end px-6 py-4 border-r border-b border-[#222830] text-base font-normal text-white">
            Feature
          </div>

          {tiers.map((tier, idx) => {
            const planId = String(tier.id ?? "");
            const isCurrent = currentPlanId === planId;
            return (
              <div
                key={tier.id ?? idx}
                className={`relative overflow-hidden flex flex-col bg-[#1d232b] justify-center items-center px-4 py-4 border-r border-b border-[#222830] ${
                  tier.isActive ? "bg-[#1E252D]" : "opacity-60"
                }`}
              >
                {/* Current plan ribbon — only for the logged-in agent's active plan */}
                {isCurrent && (
                  <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none z-20">
                    <div className="absolute top-2 -right-6 w-24 bg-[#B146F5] rotate-45 py-0.5 flex items-center justify-center shadow-[0_2px_8px_rgba(177,70,245,0.4)] border-y border-white/20">
                      <span className="text-[9px] text-white font-black tracking-widest uppercase">
                        Current
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`text-[11px] uppercase tracking-[0.1em] font-black ${
                      tier.isActive ? "text-[#B93DEB]" : "text-gray-500"
                    }`}
                  >
                    {tier.name}
                  </span>

                  <div className="relative w-16 h-16 my-1">
                    {typeof tier.icon === "string" ? (
                      <img
                        src={tier.icon || DEFAULT_AGENT_PACKAGE_ICON}
                        alt={tier.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AGENT_PACKAGE_ICON;
                        }}
                      />
                    ) : (
                      <Image
                        src={tier.icon || DEFAULT_AGENT_PACKAGE_ICON}
                        alt={tier.name}
                        fill
                        className="object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ─── FEATURE ROWS ─── */}
          {allFeatures.map((featureName, rowIdx) => (
            <React.Fragment key={rowIdx}>
              {/* Label cell */}
	              <div className="px-6 py-3 border-r border-b border-[#222830] text-[14px] flex items-center gap-2 bg-[#13181E]">
	                <span className="text-gray-200">{featureName}</span>
	                <button
		                  onClick={() => {
		                    if (isStandardPromoFeature(featureName)) {
		                      const enabledTiers = tiers.filter(
		                        (tier) => getFeatureEnabled(tier, featureName) === true,
		                      );
		
		                      const details =
		                        enabledTiers.length === 0
		                          ? "Standard Promo Codes feature is currently disabled in all plans."
		                          : enabledTiers
		                              .map(
		                                (tier) =>
		                                  `${tier.name}\n` +
		                                  `Promo code limit: ${(tier.promoCodeLimit ?? 0) > 0 ? tier.promoCodeLimit : "Not set"}\n` +
		                                  `Users per promo code: ${(tier.promoCodeMaxUsers ?? 0) > 0 ? tier.promoCodeMaxUsers : "Not set"}\n` +
		                                  `Max purchase limit: ${(tier.promoCodeMaxPurchaseAmount ?? 0) > 0 ? tier.promoCodeMaxPurchaseAmount : "Not set"}\n` +
		                                  `Discount slab: ${
		                                    (tier.promoDiscountMinPurchase ?? 0) > 0 &&
		                                    (tier.promoDiscountMaxPurchase ?? 0) > 0 &&
		                                    (tier.promoDiscountPercent ?? 0) > 0
		                                      ? `${tier.promoDiscountMinPurchase} to ${tier.promoDiscountMaxPurchase} = ${tier.promoDiscountPercent}%`
		                                      : "Not set"
		                                  }`,
		                              )
		                              .join("\n\n");
	
	                      setInfoModal({
	                        open: true,
	                        title: "Standard Promo Codes",
	                        desc: details,
	                      });
	                      return;
	                    }
	
	                    setInfoModal({
	                      open: true,
	                      title: featureName,
	                      desc: `Controls "${featureName}" access for agents on this plan.`,
	                    });
	                  }}
	                  className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
	                >
	                  <Info className="w-4 h-4" />
	                </button>
	              </div>

              {/* Value per tier */}
	              {tiers.map((tier, colIdx) => {
	                const enabled = getFeatureEnabled(tier, featureName);
	                const isLocked = false;

                const STAR_COLORS = [
                  "#B146F5",
                  "#F59E0B",
                  "#3B82F6",
                  "#10B981",
                  "#EF4444",
                ];
                const starColor = STAR_COLORS[colIdx % STAR_COLORS.length];
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={`flex justify-center items-center px-4 py-3 border-r border-b border-[#222830] ${
                      isLocked ? "bg-[#0f1318]" : "bg-[#13181E]"
                    }`}
                  >
	                    {isStandardPromoFeature(featureName) && enabled === true ? (
	                      <div
	                        className={`transition-all duration-300 ${isLocked ? "opacity-30 scale-90" : "scale-100"}`}
	                      >
	                        <div
	                          className={`transition-all duration-300 ${isLocked ? "opacity-30 scale-90" : "scale-100"}`}
	                        >
	                          <svg
	                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill={starColor}
                            xmlns="http://www.w3.org/2000/svg"
                            className="drop-shadow-[0_0_8px_rgba(var(--star-rgb),0.5)]"
	                          >
	                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
	                          </svg>
	                        </div>
	                      </div>
	                    ) : enabled === true ? (
                      <div
                        className={`transition-all duration-300 ${isLocked ? "opacity-30 scale-90" : "scale-100"}`}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill={starColor}
                          xmlns="http://www.w3.org/2000/svg"
                          className="drop-shadow-[0_0_8px_rgba(var(--star-rgb),0.5)]"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </div>
                    ) : enabled === false ||
                      enabled === undefined ||
                      enabled === null ? (
                      <span className="text-gray-600 text-base font-light select-none">
                        -
                      </span>
                    ) : (
                      <span
                        className={`text-[13px] font-bold tracking-wider ${isLocked ? "text-gray-600" : "text-gray-300"}`}
                      >
                        {String(enabled)}
                      </span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {/* ─── GGR COMMISSION ROW ─── */}
          <div className="px-6 py-3 border-r border-b border-[#222830] flex items-center gap-2 bg-[#13181E]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-[14px] text-green-300/80 font-medium">
              GGR Commission — default rates
            </span>
            <button
              onClick={() =>
                setInfoModal({
                  open: true,
                  title: "GGR Commission",
                  desc: "Gross Gaming Revenue commission rates applied per game category for agents on this plan.",
                })
              }
              className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {tiers.map((tier, colIdx) => (
            <div
              key={`ggr-${colIdx}`}
              className="flex justify-center items-center px-4 py-3 border-r border-b border-[#222830] bg-[#13181E]"
            >
              <button
                onClick={() =>
                  setGgrModal({
                    open: true,
                    planName: tier.name,
                    ggrRates: tier.ggrRates ?? {},
                  })
                }
                className="flex items-center gap-1.5 text-[11px] font-bold text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 px-3 py-1.5 rounded-lg transition-all"
              >
                <Eye size={12} />
                View
              </button>
            </div>
          ))}

          {/* ─── SUB-AGENT LIMIT ROW ─── */}
          <div className="px-6 py-3 border-r border-b border-[#222830] flex items-center gap-2 bg-[#13181E]">
            <span className="text-[14px] text-gray-200">Sub-Agent Limit</span>
            <button
              onClick={() =>
                setInfoModal({
                  open: true,
                  title: "Sub-Agent Limit",
                  desc: "Maximum number of sub-agents an agent can create under this plan.",
                })
              }
              className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {tiers.map((tier, colIdx) => {
            const isZero = tier.subtiers === "0" || !tier.subtiers;
            return (
              <div
                key={`sub-${colIdx}`}
                className="flex justify-center items-center px-4 py-3 border-r border-b border-[#222830] bg-[#13181E]"
              >
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold text-white leading-none">
                    {isZero ? "0" : tier.subtiers}
                  </span>
                </div>
              </div>
            );
          })}

          {/* ─── PRICE + BUY ROW ─── */}
          <div className="border-r border-[#222830] bg-[#13181E] rounded-bl-xl" />

          {tiers.map((tier, idx) => {
            const free = isFreePlan(tier.prize);
            const last = idx === tiers.length - 1;
            const priceNum = Number(tier.prize);
            const planId = String(tier.id ?? "");

            // Determine button state
            const isCurrent = currentPlanId === planId;
            const currentPlanSeq =
              allPlans.find((p) => p.id === currentPlanId)?.seq ?? 0;
            const thisPlanSeq =
              allPlans.find((p) => p.id === planId)?.seq ?? tier.sequence;
            const isUpgrade =
              !!currentPlanId && !isCurrent && thisPlanSeq > currentPlanSeq;
            const isDowngrade =
              !!currentPlanId && !isCurrent && thisPlanSeq < currentPlanSeq;
            const isProcessing = processingPlanId === planId;

            let btnLabel = free
              ? "Default"
              : isCurrent
                ? "Current Plan"
                : isUpgrade
                  ? "Upgrade"
                  : "Buy";
            let btnClass = free
              ? "bg-[#232931] text-gray-500 cursor-default"
              : isCurrent
                ? "bg-[#B146F5] text-white cursor-default ring-2 ring-[#B146F5]/30"
                : isDowngrade
                  ? "bg-[#232931] text-gray-500 cursor-not-allowed opacity-50"
                  : "bg-[#B146F5] hover:bg-[#C05CFF] text-white";

            return (
              <div
                key={`price-${tier.id ?? idx}`}
                className={`flex flex-col justify-end items-center border-r border-[#222830] pt-3 ${
                  last ? "rounded-br-xl overflow-hidden" : ""
                }`}
                style={{ minHeight: 110 }}
              >
                {/* Price */}
                <div className="flex flex-col items-center mb-2">
                  <span className="text-xl font-semibold text-white">
                    {free ? "Free" : priceNum.toLocaleString()}
                  </span>
                  {!free && (
                    <span className="text-[11px] text-gray-400">per month</span>
                  )}
                </div>

                {/* Buy / Upgrade / Current button */}
                <button
                  disabled={free || isCurrent || isDowngrade || loadingAction}
                  onClick={() =>
                    !free &&
                    !isCurrent &&
                    !isDowngrade &&
                    onBuyOrUpgrade(planId, tier.prize)
                  }
                  className={`w-[85%] mb-4 py-2.5 text-[11px] font-black transition-all duration-300 rounded-lg ${btnClass} ${
                    isProcessing
                      ? "opacity-70"
                      : "hover:shadow-[0_0_20px_rgba(177,70,245,0.3)] hover:-translate-y-0.5 active:translate-y-0"
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing
                    </span>
                  ) : (
                    btnLabel
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── INLINE MODALS ─── */}
      <FeatureInfoModal
        open={infoModal.open}
        onClose={() => setInfoModal((s) => ({ ...s, open: false }))}
        title={infoModal.title}
        description={infoModal.desc}
      />

      <GgrRatesModal
        open={ggrModal.open}
        onClose={() => setGgrModal((s) => ({ ...s, open: false }))}
        planName={ggrModal.planName}
        ggrRates={ggrModal.ggrRates}
        categories={categories}
      />
    </>
  );
}
