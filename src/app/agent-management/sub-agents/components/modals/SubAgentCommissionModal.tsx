"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Percent, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileApi } from "@/api/users/users";
import { getApiErrorMessage } from "@/lib/api-error";
import toast from "react-hot-toast";
import { getAdminCategories, Category } from "@/api/games/games";
import ModalPortal from "./ModalPortal";
import { ReferralStats } from "@/types/profile.type";
import { adminGetUserPackage } from "@/api/package/admin-package.api";
import { commissionChangeRequestApi } from "@/api/commission-change-request/commission-change-request.api";

const normKey = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

interface Props {
  open: boolean;
  subAgentId: string;
  username: string;
  onClose: () => void;
  onUpdate?: () => void;
  parentAgentId?: string;
}

export default function SubAgentCommissionModal({ open, subAgentId, username, onClose, onUpdate, parentAgentId }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [commissions, setCommissions] = useState<Record<string, number>>({});
  const [parentCommissions, setParentCommissions] = useState<Record<string, number>>({});
  const [planGgrRates, setPlanGgrRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  // Commission model: per-category rates, or one FLAT rate on every game.
  const [commissionMode, setCommissionMode] = useState<"CATEGORY" | "FLAT">("CATEGORY");
  const [flatRate, setFlatRate] = useState<number>(0);

  // Parent's total rate (basic + active plan bonus) for a category.
  const categoryTotal = useCallback(
    (category: Category) => {
      const basicRate = parentCommissions[category.id] ?? 0;
      const planRate =
        planGgrRates[normKey(category.slug || "")] ??
        planGgrRates[normKey(category.name)] ??
        planGgrRates[normKey(category.id)] ??
        0;
      return basicRate + planRate;
    },
    [parentCommissions, planGgrRates],
  );
  // A flat rate must fit within EVERY category, so it's capped at the lowest.
  const maxFlat = categories.length
    ? Math.min(...categories.map(categoryTotal))
    : 0;

  const fetchData = useCallback(async () => {
    // Phase 1 — essentials to render the form. Fast: categories + saved rates.
    try {
      setIsLoading(true);
      setRatesLoaded(false);
      const [cats, currentComms] = await Promise.all([
        getAdminCategories().catch(() => [] as Category[]),
        profileApi.getAgentCommissions(subAgentId).catch(() => ({ data: { commissions: {} } })),
      ]);

      const finalCategories: Category[] = cats
        .map((c) => ({ ...c, id: c.name }))
        .filter((c) => c.name.toLowerCase() !== "test");
      setCategories(finalCategories);

      const savedComms = currentComms.data.commissions || {};
      // The rate given at registration (SubAgent.commissionPercentage). At earn
      // time a category with no custom entry falls back to it, so the form must
      // seed empty categories with THIS value — seeding 0 made a freshly
      // registered 20% sub-agent open to a wall of zeros, which read as "the
      // registered rate never saved". An explicit 0 custom entry still shows 0.
      const registeredRate = Number(
        (currentComms.data as { flatCommissionRate?: number }).flatCommissionRate || 0,
      );
      const savedMode =
        (currentComms.data as { commissionMode?: string }).commissionMode === "FLAT"
          ? "FLAT"
          : "CATEGORY";
      setCommissionMode(savedMode);
      setFlatRate(registeredRate);
      const initialComms: Record<string, number> = {};
      finalCategories.forEach((cat) => {
        initialComms[cat.id] =
          savedComms[cat.id] !== undefined
            ? Number(savedComms[cat.id])
            : registeredRate;
      });
      setCommissions(initialComms);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load categories/commissions");
    } finally {
      setIsLoading(false);
    }

    // Phase 2 — display / validation rates (parent commissions + plan GGR).
    // Loaded in the background so a slow stats/package call never blocks the form.
    try {
      const [myStatsRes, parentPkg] = await Promise.all([
        profileApi.getReferralStats().catch(() => ({ data: { commissions: [] } })),
        parentAgentId
          ? adminGetUserPackage(parentAgentId).catch(() => null)
          : Promise.resolve(null),
      ]);

      const myStats = myStatsRes.data as ReferralStats;
      const myRates: Record<string, number> = {};
      (myStats.commissions || []).forEach((c: { name: string; rate: number }) => {
        myRates[c.name] = c.rate;
      });
      setParentCommissions(myRates);

      // Only apply plan GGR rates when the parent's package is still ACTIVE.
      // If admin disabled packages, the subscription lingers but its rates must
      // not count — no PLAN badge, no plan bonus in "Your Rate".
      const planActive = parentPkg?.package?.isActive === true;
      const rawGgr: Record<string, number> = planActive
        ? ((parentPkg?.package?.features as
            | { ggrRates?: Record<string, number> }
            | undefined)?.ggrRates ?? {})
        : {};
      const normalizedGgr: Record<string, number> = {};
      Object.entries(rawGgr).forEach(([k, v]) => { normalizedGgr[normKey(k)] = v; });
      setPlanGgrRates(normalizedGgr);
    } catch (err) {
      console.error(err);
    } finally {
      setRatesLoaded(true);
    }
  }, [subAgentId, parentAgentId]);

  useEffect(() => {
    if (open && subAgentId) fetchData();
  }, [open, subAgentId, fetchData]);

  const handleSave = async () => {
    // FLAT mode — one rate on every game. Reuses the category proposal by filling
    // every category with the same rate. Capped at the lowest category rate so it
    // never exceeds the agent's own rate anywhere.
    if (commissionMode === "FLAT") {
      if (!(flatRate >= 0)) {
        toast.error("Flat rate must be 0 or more");
        return;
      }
      if (ratesLoaded && flatRate > maxFlat) {
        toast.error(
          `Flat rate (${flatRate}%) cannot exceed your lowest category rate (${maxFlat}%)`,
        );
        return;
      }
      const flatByName: Record<string, number> = {};
      categories.forEach((cat) => {
        flatByName[cat.name] = flatRate;
      });
      try {
        setIsSaving(true);
        await commissionChangeRequestApi.create(subAgentId, flatByName);
        toast.success("Flat commission proposal sent to the sub-agent for approval");
        onUpdate?.();
        onClose();
      } catch (e: unknown) {
        toast.error(getApiErrorMessage(e, "Failed to send commission proposal"));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // 🚩 Validation Logic: Cannot exceed parent rate 🚩
    // Skip the max check until the display rates finish loading in the
    // background — otherwise totalRate reads 0 and blocks every save.
    if (ratesLoaded)
    for (const catId in commissions) {
        const subRate = commissions[catId];
        const basicRate = parentCommissions[catId] ?? 0;
        const cat = categories.find((c) => c.id === catId);
        const planRate = planGgrRates[normKey(cat?.slug || "")]
          ?? planGgrRates[normKey(cat?.name || "")]
          ?? planGgrRates[normKey(catId)]
          ?? 0;
        const totalRate = basicRate + planRate;
        
        if (subRate > totalRate) {
            toast.error(`Commission for ${catId} (${subRate}%) cannot exceed your total rate of ${totalRate}%`);
            return;
        }
    }

    // Send commissions keyed by category NAME (backend customCommissions map).
    const byName: Record<string, number> = {};
    for (const catId in commissions) {
      const cat = categories.find((c) => c.id === catId);
      byName[cat?.name ?? catId] = commissions[catId];
    }

    try {
      setIsSaving(true);
      await commissionChangeRequestApi.create(subAgentId, byName);
      toast.success("Commission proposal sent to the sub-agent for approval");
      onUpdate?.();
      onClose();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to send commission proposal"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-4xl rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl overflow-hidden shadow-purple-500/5 max-h-[92dvh] flex flex-col">
          {/* HEADER */}
          <div className="flex items-center justify-between p-6 pb-2">
            <h2 className="text-white text-xl font-bold"> Commission Settings </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* BODY */}
          <div className="p-4 sm:p-6 pt-2 flex-1 min-h-0 max-h-none sm:max-h-[70vh] overflow-y-auto scrollbar-hide">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <Loader2 className="animate-spin text-purple-500" size={32} />
                <p className="text-gray-500 text-sm animate-pulse">Fetching Your Current Rates...</p>
              </div>
            ) : (
              <>
                {/* COMMISSION MODEL TOGGLE — category rates vs one flat rate */}
                <div className="mb-6 pt-2">
                  <Label className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-3 block">
                    Commission Model
                  </Label>
                  <div className="flex rounded-xl overflow-hidden border border-white/10">
                    <button
                      type="button"
                      onClick={() => setCommissionMode("CATEGORY")}
                      className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                        commissionMode === "CATEGORY"
                          ? "bg-purple-600 text-white"
                          : "bg-black/40 text-gray-500 hover:text-white"
                      }`}
                    >
                      Game Category Rates
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommissionMode("FLAT")}
                      className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                        commissionMode === "FLAT"
                          ? "bg-purple-600 text-white"
                          : "bg-black/40 text-gray-500 hover:text-white"
                      }`}
                    >
                      Flat Commission
                    </button>
                  </div>
                  <p className="text-gray-600 text-[11px] mt-2">
                    {commissionMode === "FLAT"
                      ? "One rate applied to every game category for this sub-agent."
                      : "Different rate per game category."}
                  </p>
                </div>

                {commissionMode === "FLAT" ? (
                  <div className="p-4 sm:p-6 rounded-xl bg-[#1C2128]/40 border border-purple-500/30 w-full max-w-md">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-gray-400 text-[10px] uppercase font-black tracking-widest">
                        Flat Rate — all games
                      </Label>
                      <span className="text-[9px] font-black text-gray-500 uppercase">
                        Max: <span className="text-purple-400">{maxFlat.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max={maxFlat}
                        placeholder="0.0"
                        value={flatRate || ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setFlatRate(isNaN(v) ? 0 : v);
                        }}
                        className={`bg-[#12161D] text-white rounded-xl py-6 pr-12 font-mono font-bold text-lg transition-all ${
                          ratesLoaded && flatRate > maxFlat
                            ? "border-red-500/50 focus-visible:ring-red-500/30 text-red-100"
                            : "border-gray-800 focus-visible:ring-purple-500/50"
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500">
                        <Percent size={18} />
                      </div>
                    </div>
                    {ratesLoaded && flatRate > maxFlat && (
                      <p className="text-[10px] text-red-500 font-bold mt-2 animate-pulse">
                        Cannot exceed your lowest category rate ({maxFlat.toFixed(1)}%)
                      </p>
                    )}
                    <p className="text-gray-600 text-[11px] mt-3">
                      Applies to all {categories.length} categories at {flatRate || 0}% each.
                    </p>
                  </div>
                ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-4">
                {categories.map((category) => {
                  const basicRate = parentCommissions[category.id] ?? 0;
                  const planRate = planGgrRates[normKey(category.slug || "")] 
                    ?? planGgrRates[normKey(category.name)] 
                    ?? planGgrRates[normKey(category.id)] 
                    ?? 0;
                  const totalRate = basicRate + planRate;
                  const currentSubRate = commissions[category.id] || 0;
                  const isInvalid = currentSubRate > totalRate;
                  const agentNet = Math.max(0, totalRate - currentSubRate);

                  return (
                    <div key={category.id} className="space-y-3 bg-[#1C2128]/40 p-4 rounded-2xl border border-gray-800/50 hover:border-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between px-1">
                        <Label className="text-gray-300 text-[10px] uppercase font-bold tracking-[0.1em]">
                          {category.name}
                        </Label>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-black text-gray-500 uppercase">
                            Basic: <span className="text-blue-400">{basicRate}%</span>
                            {planRate > 0 && (
                              <> + Plan: <span className="text-green-400">{planRate}%</span></>
                            )}
                          </span>
                          <span className="text-[9px] font-black text-gray-500 uppercase">
                            Your Rate: <span className="text-purple-400">{totalRate}%</span>
                          </span>
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max={totalRate}
                          placeholder="0.0"
                          value={commissions[category.id] || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCommissions((prev) => ({ ...prev, [category.id]: isNaN(val) ? 0 : val }));
                          }}
                          className={`bg-[#12161D] text-white rounded-xl py-6 pr-12 font-mono font-bold transition-all ${
                            isInvalid 
                              ? "border-red-500/50 focus-visible:ring-red-500/30 text-red-100" 
                              : "border-gray-800 focus-visible:ring-purple-500/50"
                          }`}
                        />
                        <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isInvalid ? "text-red-500" : "text-gray-600 group-focus-within:text-purple-500"}`}>
                          <Percent size={18} />
                        </div>
                      </div>
                      
                      {isInvalid && (
                        <p className="text-[9px] text-red-500 font-bold px-1 animate-pulse">
                          Cannot exceed your rate of {totalRate}%
                        </p>
                      )}

                      {!isInvalid && (
                        <div className="flex items-center justify-between px-1 pt-1 border-t border-gray-800/50">
                          <span className="text-[9px] font-black text-gray-500 uppercase">
                            Agent Net: <span className="text-emerald-400">{agentNet.toFixed(1)}%</span>
                          </span>
                          <span className="text-[9px] font-black text-gray-500 uppercase">
                            Sub-Agent: <span className="text-purple-400">{currentSubRate.toFixed(1)}%</span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {categories.length === 0 && (
                  <div className="col-span-full py-12 text-center text-gray-500">No game categories found.</div>
                )}
              </div>
                )}
              </>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 sm:p-6 pt-3 sm:pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t border-gray-800/50 mt-0 sm:mt-4 shrink-0">
            <Button
              variant="ghost"
              className="text-gray-400 hover:text-white hover:bg-white/5 font-bold px-8 py-6 rounded-xl"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#A855F7] hover:bg-[#9333ea] text-white font-bold px-10 py-6 rounded-xl  disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={isSaving || isLoading}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Sending...
                </>
              ) : (
                "Send Proposal"
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
