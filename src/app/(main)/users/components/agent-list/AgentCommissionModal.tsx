"use client";

import { useEffect, useState } from "react";
import { X, Percent, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import { profileApi } from "@/api/users/users";
import { getAdminCategories, getAllAdminGames, Category, Game } from "@/api/games/games";

interface Props {
  open: boolean;
  agentId: string;
  username: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function AgentCommissionModal({
  open,
  agentId,
  username,
  onClose,
  onUpdate,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [commissions, setCommissions] = useState<Record<string, number>>({});
  const [commissionMode, setCommissionMode] = useState<"CATEGORY" | "FLAT">("CATEGORY");
  const [flatRate, setFlatRate] = useState<number>(0);
  const [savedMode, setSavedMode] = useState<"CATEGORY" | "FLAT">("CATEGORY");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && agentId) {
      fetchData();
    }
  }, [open, agentId]);

  const fetchData = async () => {
    // Phase 1 — fast essentials: formal categories + saved rates/mode.
    // The form renders as soon as these land.
    let savedComms: Record<string, number> = {};
    try {
      setIsLoading(true);
      const [cats, agentComms] = (await Promise.all([
        getAdminCategories().catch(() => [] as Category[]),
        profileApi.getAgentCommissions(agentId).catch((err: any) => {
          if (err.response?.status === 404) {
            return { data: { commissions: {} } };
          }
          throw err;
        }),
      ])) as [Category[], any];

      const finalCategories: Category[] = cats
        .map((c) => ({ ...c, id: c.name })) // Force name as ID for commission mapping
        .filter((c) => c.name.toLowerCase() !== "test");

      setCategories(finalCategories);

      savedComms = agentComms.data?.commissions || {};
      const initialComms: Record<string, number> = {};
      finalCategories.forEach((cat) => {
        initialComms[cat.name] = savedComms[cat.name] || 0;
      });
      setCommissions(initialComms);

      // Commission model (CATEGORY vs FLAT) + saved flat rate
      const mode = agentComms.data?.commissionMode === "FLAT" ? "FLAT" : "CATEGORY";
      setCommissionMode(mode);
      setSavedMode(mode);
      setFlatRate(Number(agentComms.data?.flatCommissionRate || 0));
    } catch (error) {
      console.error("Failed to fetch commission data:", error);
      toast.error("Failed to load commission settings");
    } finally {
      setIsLoading(false);
    }

    // Phase 2 — background: full games list only to catch ad-hoc categories
    // missing from the formal list. Slow (whole catalog), so it must never
    // block the form; extra categories are appended when it arrives.
    getAllAdminGames({})
      .then((allGames: Game[]) => {
        const inUse = Array.from(new Set(allGames.map((g) => g.category)))
          .filter(Boolean)
          .filter((n) => n!.toLowerCase() !== "test");

        setCategories((prev) => {
          const extras = inUse
            .filter((n) => !prev.find((c) => c.name.toLowerCase() === n!.toLowerCase()))
            .map((n) => ({
              id: n as string,
              name: n as string,
              slug: (n as string).toLowerCase().replace(/\s+/g, "-"),
              displayOrder: 99,
              isActive: true,
            }));
          if (extras.length === 0) return prev;

          setCommissions((prevComms) => {
            const next = { ...prevComms };
            extras.forEach((cat) => {
              if (next[cat.name] === undefined) next[cat.name] = savedComms[cat.name] || 0;
            });
            return next;
          });
          return [...prev, ...extras];
        });
      })
      .catch(() => {
        /* background enrichment only — formal categories already shown */
      });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      if (commissionMode === "FLAT") {
        if (!(flatRate >= 0 && flatRate <= 100)) {
          toast.error("Flat rate must be between 0 and 100");
          return;
        }
        // One model at a time: FLAT replaces all category rates.
        // Cascades the mode to every sub-agent on the backend.
        const res = await profileApi.setAgentCommissionMode(agentId, "FLAT", flatRate);
        const clamped = (res.data as any)?.clampedSubAgents || 0;
        toast.success(
          `Flat commission ${flatRate}% applied${clamped > 0 ? ` (${clamped} sub-agent rate(s) adjusted)` : ""}`,
        );
      } else {
        // Switching back from FLAT re-enables category rates for the downline.
        if (savedMode === "FLAT") {
          await profileApi.setAgentCommissionMode(agentId, "CATEGORY");
        }
        await profileApi.updateAgentCommissions(agentId, commissions);
        toast.success("Commissions updated successfully");
      }

      onUpdate?.();
      onClose();
    } catch (error: any) {
      console.error("Failed to update commissions:", error);
      toast.error(error?.response?.data?.message || "Failed to update commissions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (categoryId: string, value: string) => {
    const numValue = parseFloat(value);
    setCommissions((prev) => ({
      ...prev,
      [categoryId]: isNaN(numValue) ? 0 : numValue,
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-3 md:p-0">
      <div className="w-full max-w-2xl rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-800 bg-[#191D24]/50 shrink-0 md:p-6">
          <div>
            <h2 className="text-white text-xl font-black uppercase tracking-tight italic">
              Configure Commission
            </h2>
            <p className="text-gray-500 text-xs mt-1">
              Setting custom rates for <span className="text-purple-500 font-bold">{username}</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <div className="p-4 md:p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="animate-spin text-purple-500" size={32} />
              <p className="text-gray-500 text-sm font-medium">Fetching categories and rates...</p>
            </div>
          ) : (
            <>
              {/* COMMISSION MODEL TOGGLE — exactly one applies at a time */}
              <div className="mb-6">
                <Label className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-3 block">
                  Commission Model
                </Label>
                <div className="flex rounded-xl overflow-hidden border border-white/10">
                  <button
                    type="button"
                    onClick={() => setCommissionMode("CATEGORY")}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                      commissionMode === "CATEGORY"
                        ? "bg-purple-600 text-white"
                        : "bg-black/40 text-gray-500 hover:text-white"
                    }`}
                  >
                    Game Category Rates
                    {savedMode === "CATEGORY" && (
                      <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[9px] font-black tracking-wider border border-green-500/40">
                        ACTIVE
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommissionMode("FLAT")}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                      commissionMode === "FLAT"
                        ? "bg-purple-600 text-white"
                        : "bg-black/40 text-gray-500 hover:text-white"
                    }`}
                  >
                    Flat Commission
                    {savedMode === "FLAT" && (
                      <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[9px] font-black tracking-wider border border-green-500/40">
                        ACTIVE
                      </span>
                    )}
                  </button>
                </div>
                {savedMode !== commissionMode && (
                  <p className="text-yellow-500/80 text-[11px] mt-2 font-medium">
                    ⚠ Currently active: {savedMode === "FLAT" ? "Flat Commission" : "Game Category Rates"}. Saving will switch this agent to {commissionMode === "FLAT" ? "Flat Commission" : "Game Category Rates"}.
                  </p>
                )}
                <p className="text-gray-600 text-[11px] mt-2">
                  {commissionMode === "FLAT"
                    ? "One rate on every game. Category rates and package bonuses are ignored. Sub-agents switch to flat mode automatically."
                    : "Different rate per game category. Sub-agents use category mode."}
                </p>
              </div>

              {commissionMode === "FLAT" ? (
                <div className="p-4 rounded-xl bg-white/5 border border-purple-500/30 md:p-6">
                  <Label className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-3 block">
                    Flat Rate — all games
                  </Label>
                  <div className="relative max-w-xs">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0.0"
                      value={flatRate || ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setFlatRate(isNaN(v) ? 0 : v);
                      }}
                      className="bg-black/40 border-white/5 text-white font-mono font-bold text-2xl h-14 pl-4 pr-12 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500">
                      <Percent size={20} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-[11px] mt-3">
                    Sub-agent flat rates above this value will be reduced automatically.
                  </p>
                </div>
              ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {categories.map((category) => (
                <div 
                  key={category.id} 
                  className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all group"
                >
                  <Label className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-3 block group-hover:text-purple-400 transition-colors">
                    {category.name}
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0.0"
                      value={commissions[category.id] || ""}
                      onChange={(e) => handleInputChange(category.id, e.target.value)}
                      className="bg-black/40 border-white/5 text-white font-mono font-bold text-lg h-12 pl-4 pr-12 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-purple-500 transition-colors">
                      <Percent size={18} />
                    </div>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <p className="text-gray-500">No game categories found.</p>
                </div>
              )}
            </div>
              )}
            </>
          )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-800 bg-[#191D24]/50 flex justify-end gap-4 shrink-0 md:p-6">
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-white/5 font-bold uppercase text-xs tracking-widest"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            className="bg-purple-600 text-white hover:bg-purple-700 font-black uppercase text-xs tracking-widest px-8 shadow-lg shadow-purple-500/20 active:scale-95 transition-all"
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2" size={16} />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
