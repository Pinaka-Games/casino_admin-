"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { X, Upload, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useGameStore } from "@/store/game-store";

const DEFAULT_AGENT_FEATURES: string[] = [];

import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import FigmaInput from "@/components/ui/FigmaInput";

import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import toast from "react-hot-toast";

const DEFAULT_AGENT_PACKAGE_ICON =
  "https://dzyemtm911c4h.cloudfront.net/wulfcasino/hustler.svg";

export interface AgentPackageFormData {
  id?: string | number;
  icon?: string;
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

interface Props {
  open: boolean;
  onClose: () => void;
  initialData: AgentPackageFormData | null;
  onSubmit: (data: AgentPackageFormData) => Promise<boolean>;
  templateFeatures?: string[];
  usedFeaturesCount?: Record<string, number>;
}

export default function AgentPackageManagementModal({
  open,
  onClose,
  initialData,
  onSubmit,
  templateFeatures,
  usedFeaturesCount,
}: Props) {
  const {
    games,
    categories: storeCategories,
    fetchData,
    isLoading: isCategoriesLoading,
  } = useGameStore();

  const displayCategories = useMemo(() => {
    const isIgnoredCategory = (value?: string) => {
      const v = (value ?? "").trim().toLowerCase();
      return v === "test" || v === "testing";
    };

    // 1. Get explicitly defined categories
    const explicitCategories = (storeCategories || []).filter(
      (c) =>
        c.isActive !== false &&
        !isIgnoredCategory(c.name) &&
        !isIgnoredCategory(c.slug),
    );
    
    // 2. Get categories used by current games (as fallback or addition)
    const gameUsedCategoriesSet = new Set(
      games
        .map((g) => g.category)
        .filter((cat) => Boolean(cat) && !isIgnoredCategory(String(cat))),
    );
    const gameUsedCategories = Array.from(gameUsedCategoriesSet).map(catName => {
      const explicit = explicitCategories.find(c => c.name === catName);
      return explicit || { 
        id: catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        slug: catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 
        name: catName,
        displayOrder: 0,
        isActive: true
      };
    });

    // 3. Merge them (prioritize explicit, add others found in games)
    const allCategories = [...explicitCategories];
    gameUsedCategories.forEach(gc => {
      if (!allCategories.find(ac => ac.name === gc.name || ac.slug === gc.slug)) {
        allCategories.push(gc as any);
      }
    });

    // 4. Final fallback to defaults if still empty
    return allCategories.sort((a, b) => a.name.localeCompare(b.name));
  }, [storeCategories, games]);

  const uploaderRef = useRef<ImageUploaderRef>(null);

  const uniqueProviders = useMemo(() => {
    const providersSet = new Set(games.map((g) => g.provider));
    return Array.from(providersSet).filter(Boolean).sort();
  }, [games]);

  const [features, setFeatures] = useState<string[]>([]);
  const [toggles, setToggles] = useState<boolean[]>([]);

  const [uploadTarget, setUploadTarget] = useState<"icon" | null>(null);

  type DeleteTarget =
    | { type: "icon" }
    | { type: "feature"; index: number }
    | null;

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [formData, setFormData] = useState<AgentPackageFormData>({
    icon: DEFAULT_AGENT_PACKAGE_ICON,
    name: "",
    features: DEFAULT_AGENT_FEATURES,
    toggles: new Array(DEFAULT_AGENT_FEATURES.length).fill(true),
    sequence: 0,
    isActive: true,
    prize: "",
    subtiers: "1",
    ggrRates: {},
    promoCodeLimit: 0,
    promoCodeMaxUsers: 0,
    promoCodeMaxPurchaseAmount: 0,
    promoDiscountMinPurchase: 0,
    promoDiscountMaxPurchase: 0,
    promoDiscountPercent: 0,
  });

  useEffect(() => {
    if (open) {
      fetchData().catch(() => toast.error("Failed to sync game categories"));
    }
  }, [open, fetchData]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      // Edit Mode
      setFormData(initialData);
      setFeatures(initialData.features || []);
      setToggles(initialData.toggles || []);
    } else {
      // Create Mode - use defaults
      setFormData({
        icon: DEFAULT_AGENT_PACKAGE_ICON,
        name: "",
        features: DEFAULT_AGENT_FEATURES,
        toggles: new Array(DEFAULT_AGENT_FEATURES.length).fill(true),
        sequence: 0,
        isActive: true,
        prize: "",
        subtiers: "1",
        ggrRates: {},
        promoCodeLimit: 0,
        promoCodeMaxUsers: 0,
        promoCodeMaxPurchaseAmount: 0,
        promoDiscountMinPurchase: 0,
        promoDiscountMaxPurchase: 0,
        promoDiscountPercent: 0,
        
      });
      setFeatures([...DEFAULT_AGENT_FEATURES]);
      setToggles(new Array(DEFAULT_AGENT_FEATURES.length).fill(true));
    }
  }, [open, initialData]);

  if (!open) return null;

  const isEdit = Boolean(initialData);

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 ">
      <div className="w-full max-w-6xl max-h-[90vh] bg-[#15181E] rounded-xl flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2f3a]">
          <h2 className="text-white text-lg font-medium">
            {isEdit ? "Edit Package" : "Create new package"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          {/* TOP SECTION */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <Label className="text-white text-xs">Icon</Label>
              <Button
                variant="outline"
                className="mt-2 gap-2"
                onClick={() => {
                  setUploadTarget("icon");
                  uploaderRef.current?.open();
                }}
              >
                <Upload size={14} /> Upload
              </Button>

              {formData.icon && (
                <div className="mt-3 flex items-center justify-between bg-[#1F2630] p-3 rounded-md w-[180px]">
                  <img
                    src={formData.icon}
                    className="w-10 h-10"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AGENT_PACKAGE_ICON;
                    }}
                  />
                  <Trash2
                    className="cursor-pointer text-gray-400 hover:text-red-400"
                    onClick={() => setDeleteTarget({ type: "icon" })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* FORM SECTION */}
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <Label className="text-white text-xs mb-1 block">Name*</Label>
              <FigmaInput
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    name: e.target.value,
                  }))
                }
                placeholder="Enter Tier Name"
              />
            </div>

            {/* GGR COMMISSION SECTION */}
            <div className="col-span-2 border border-gray-700 p-4 rounded-lg bg-[#1a2030]/50 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-purple-400 text-xs font-bold uppercase tracking-wider">
                    GGR Commission — Default Rates
                  </Label>
                  <p className="text-[10px] text-gray-500 italic mt-0.5">
                    Category-based rates (Overridable per agent)
                  </p>
                </div>
                {isCategoriesLoading && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 animate-pulse">
                    <div className="w-3 h-3 border border-purple-500/50 border-t-transparent rounded-full animate-spin" />
                    Syncing...
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {displayCategories.map((category) => (
                  <div key={category.slug}>
                    <Label className="text-gray-400 text-[10px] uppercase mb-1.5 block">
                      {category.name} (%)
                    </Label>
                    <div className="relative">
                      <FigmaInput
                        type="number"
                        value={formData.ggrRates?.[category.slug] ?? 0}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            Math.min(100, Number(e.target.value)),
                          );
                          setFormData((p) => ({
                            ...p,
                            ggrRates: {
                              ...(p.ggrRates || {}),
                              [category.slug]: val,
                            },
                          }));
                        }}
                        className="pr-8 h-8 text-xs h-[38px]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PROMO RULES SECTION */}
            <div className="col-span-2 border border-gray-700 p-4 rounded-lg bg-[#1a2030]/50 space-y-4">
              <Label className="text-purple-400 text-xs font-bold uppercase tracking-wider">
                Promo Code Limits (Plan Config)
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-400 text-[10px] uppercase mb-1.5 block">
                    Promo Codes / Plan
                  </Label>
                  <FigmaInput
                    type="number"
                    min={0}
                    value={formData.promoCodeLimit ?? 0}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        promoCodeLimit: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-[38px] text-xs"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-[10px] uppercase mb-1.5 block">
                    Users / Promo
                  </Label>
                  <FigmaInput
                    type="number"
                    min={0}
                    value={formData.promoCodeMaxUsers ?? 0}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        promoCodeMaxUsers: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-[38px] text-xs"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-[10px] uppercase mb-1.5 block">
                    Max Purchase Amount
                  </Label>
                  <FigmaInput
                    type="number"
                    min={0}
                    value={formData.promoCodeMaxPurchaseAmount ?? 0}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        promoCodeMaxPurchaseAmount: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-[38px] text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-700/70">
                <Label className="text-gray-300 text-[10px] uppercase mb-2 block">
                  Dynamic Discount Slab (e.g. 200-500 = 3%)
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-400 text-[10px] uppercase mb-1.5 block">
                      Min Purchase
                    </Label>
                    <FigmaInput
                      type="number"
                      min={0}
                      value={formData.promoDiscountMinPurchase ?? 0}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          promoDiscountMinPurchase: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="h-[38px] text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-[10px] uppercase mb-1.5 block">
                      Max Purchase
                    </Label>
                    <FigmaInput
                      type="number"
                      min={0}
                      value={formData.promoDiscountMaxPurchase ?? 0}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          promoDiscountMaxPurchase: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="h-[38px] text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-[10px] uppercase mb-1.5 block">
                      Discount (%)
                    </Label>
                    <FigmaInput
                      type="number"
                      min={0}
                      max={100}
                      value={formData.promoDiscountPercent ?? 0}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          promoDiscountPercent: Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0),
                          ),
                        }))
                      }
                      className="h-[38px] text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-2 space-y-3">
              <Label className="text-white text-xs">Features</Label>

              {features.map((feature, index) => (
                <div key={index} className="flex items-center justify-between gap-3 bg-[#1a2030]/50 p-2 rounded-lg border border-gray-700/50">
                  <div className="flex items-center gap-1.5 px-2">
                    <span className="text-xs text-gray-300 font-medium whitespace-nowrap">
                      {feature || `Feature ${index + 1}`}
                    </span>
                    <Info 
                       size={13} 
                       className="text-gray-500 hover:text-purple-400 transition-colors cursor-pointer ml-1"
                       onClick={() => {
                          const detailsMap: Record<string, string> = {
                           "Sub-Agent Creation": "Allows the agent to create and manage sub-agents under their network.",
                           "Standard Promo Codes": "Enables the creation of standard promotional codes to attract new players.",
                           "Player Referral Tracking": "Tracks and manages referrals made by players.",
                           "Basic Reporting Dashboard": "Access to a basic dashboard with essential reporting and analytics.",
                           "GGR Commission": "The commission you give here will automatically be added to the agent's base reward."
                          };
                          toast(detailsMap[feature] || "Detailed information for this feature is not provided.", {
                            icon: 'ℹ️',
                            style: { background: '#1a2030', color: '#fff', border: '1px solid #374151' }
                          });
                       }}
                    />
                  </div>

                  <Switch
                    checked={toggles[index]}
                    onCheckedChange={(v) => {
                      const updated = [...toggles];
                      updated[index] = v;
                      setToggles(updated);
                    }}
                    className="data-[state=checked]:bg-purple-500"
                  />
                </div>
              ))}
            </div>

            <div>
              <Label className="text-white text-xs mb-2">Sequence</Label>
              <FigmaInput
                type="number"
                value={formData.sequence ?? 0}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    sequence: Number(e.target.value),
                  }))
                }
              />
            </div>

            <div>
              <Label className="text-white text-xs mb-2">Prize</Label>
              <div className="relative">
                <FigmaInput
                  value={formData.prize}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      prize: e.target.value,
                    }))
                  }
                  placeholder="20.00"
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">
                  / mo
                </span>
              </div>
            </div>

            <div>
              <Label className="text-white text-xs mb-2">Sub-Agents</Label>
              <FigmaInput
                type="text"
                value={formData.subtiers ?? "1"}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    subtiers: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2 mt-6">
              <Label className="text-white text-xs">Is Active</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, isActive: checked }))
                  }
                  className="data-[state=checked]:bg-purple-500 
                             data-[state=unchecked]:bg-gray-600"
                />
                <span className="text-white text-xs">
                  {formData.isActive ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#2a2f3a]">
          <Button
            variant="outline"
            className="border-gray-600 text-white"
            onClick={() => {
              onClose();
              toast.error("Action cancelled");
            }}
          >
            Cancel
          </Button>

          <Button
            className="bg-purple-500 text-white hover:bg-purple-600"
            onClick={async () => {
              const success = await onSubmit({
                ...formData,
                features,
                toggles,
              });
              if (success) onClose();
            }}
          >
            {isEdit ? "Update" : "Create"}
          </Button>
        </div>

        {/* IMAGE UPLOADER */}
        <ImageUploader
          ref={uploaderRef}
          aspect={1}
          onChange={(file) => {
            if (!file || !uploadTarget) return;

            const previewUrl = URL.createObjectURL(file);
            setFormData((p) => ({ ...p, [uploadTarget]: previewUrl }));
            setUploadTarget(null);
          }}
        />

        {/* DELETE CONFIRM */}
        <ConfirmDeleteDialog
          open={!!deleteTarget}
          fileName={
            deleteTarget?.type === "feature"
              ? `Feature ${deleteTarget.index + 1}`
              : (deleteTarget?.type ?? "")
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;

            if (deleteTarget.type === "icon") {
              setFormData((p) => ({
                ...p,
                icon: DEFAULT_AGENT_PACKAGE_ICON,
              }));
            }

            if (deleteTarget.type === "feature") {
              setFeatures((p) => p.filter((_, i) => i !== deleteTarget.index));
              setToggles((p) => p.filter((_, i) => i !== deleteTarget.index));
            }

            setDeleteTarget(null);
          }}
        />
      </div>
    </div>
  );
}
