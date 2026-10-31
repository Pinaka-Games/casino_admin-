"use client";

import { useEffect, useState } from "react";
import { X, Percent, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { commissionApi } from "@/api/commission/commission";
import { getAdminCategories, getAllAdminGames, Category, Game } from "@/api/games/games";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GlobalCommissionModal({ open, onClose }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryRates, setCategoryRates] = useState<Record<string, number>>({});
  const [extraFields, setExtraFields] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [cats, allGames, configRes] = await Promise.all([
        getAdminCategories().catch(() => [] as Category[]),
        getAllAdminGames({}).catch(() => [] as Game[]),
        commissionApi.getCommissionConfig(),
      ]);

      // Build dynamic category list (same logic as AgentCommissionModal)
      let finalCategories: Category[] = cats
        .map((c) => ({ ...c, id: c.name }))
        .filter((c) => c.name.toLowerCase() !== "test");

      const inUseNames = Array.from(new Set(allGames.map((g) => g.category)))
        .filter(Boolean)
        .filter((n) => n?.toLowerCase() !== "test");

      inUseNames.forEach((catName) => {
        const exists = finalCategories.find(
          (c) => c.name.toLowerCase() === catName!.toLowerCase()
        );
        if (!exists) {
          finalCategories.push({
            id: catName as string,
            name: catName as string,
            slug: (catName as string).toLowerCase().replace(/\s+/g, "-"),
            displayOrder: 99,
            isActive: true,
          });
        }
      });

      setCategories(finalCategories);

      // Load saved categoryRates from config
      const config = configRes.data as any;
      const savedRates: Record<string, number> = config.categoryRates || {};
      const initial: Record<string, number> = {};
      finalCategories.forEach((cat) => {
        initial[cat.name] = savedRates[cat.name] ?? 0;
      });
      setCategoryRates(initial);

      // Keep all other backend fields intact (don't overwrite on save)
      const { categoryRates: _cr, ...rest } = config;
      setExtraFields(rest);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load commission settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await commissionApi.updateCommissionConfig({
        ...extraFields,
        categoryRates,
      } as any);
      toast.success("Commission settings updated successfully");
      onClose();
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to update commission settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-[#191D24]/50">
          <div>
            <h2 className="text-white text-xl font-black uppercase tracking-tight italic">
              Commission Settings
            </h2>
            <p className="text-gray-500 text-xs mt-1">
              Global default commission rates — applies to all users
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
        <div className="p-8 max-h-[60vh] overflow-y-auto scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="animate-spin text-purple-500" size={32} />
              <p className="text-gray-500 text-sm font-medium">
                Fetching categories and rates...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((category) => (
                <div
                  key={category.name}
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
                      value={categoryRates[category.name] || ""}
                      onChange={(e) =>
                        setCategoryRates((prev) => ({
                          ...prev,
                          [category.name]: parseFloat(e.target.value) || 0,
                        }))
                      }
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
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-gray-800 bg-[#191D24]/50 flex justify-end gap-4">
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
