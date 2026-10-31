"use client";

import { useEffect, useRef, useState } from "react";
import { Info, X, Upload, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import FigmaInput from "@/components/ui/FigmaInput";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import { ADMIN_SUBSCRIPTION_FEATURES } from "../subscription-feature-config";

// ✅ Create mode default features (so create opens like edit with all features)
const DEFAULT_FEATURES: string[] = [...ADMIN_SUBSCRIPTION_FEATURES];
const JACKPOT_GROUP_LABEL = "Free Entry To Jackpot and Tournament";
const JACKPOT_DETAIL_LABELS = [
  "Daily Jackpot Access",
  "Weekly Jackpot Access",
  "Monthly Jackpot Access",
] as const;

export interface UserTierFormData {
  id?: string;
  icon?: string;
  backgroundImage?: string;
  name: string;
  description?: string;

  features: string[];
  toggles: boolean[];
  promoCodesLimit?: number;
  increasedRewardsPercent?: number;
  /**
   * How many devices this tier may be signed in on at once.
   *
   * 0 means NOT SET — the tier inherits the platform default from
   * Settings → System Configuration → Security. That is deliberately not the
   * same as "no devices": tiers saved before this field existed carry no value,
   * and defaulting them to a real number would impose a limit nobody chose.
   *
   * Kept OUT of the `features`/`toggles` arrays on purpose. Those are matched by
   * POSITION against ADMIN_SUBSCRIPTION_FEATURES, so inserting an entry shifts
   * every index after it and silently breaks the jackpot grouping.
   */
  maxDevices?: number;

  sequence: number;
  isActive: boolean;
  prize: string;

  interval?: "MONTHLY" | "YEARLY";
  currency?: "USD";
}

interface Props {
  open: boolean;
  initialData?: UserTierFormData | null;
  onClose: () => void;
  onSubmit: (data: UserTierFormData) => void | Promise<void>;
}

export default function UserTierManagementModal({
  open,
  initialData,
  onClose,
  onSubmit,
}: Props) {
  const uploaderRef = useRef<ImageUploaderRef>(null);

  const [features, setFeatures] = useState<string[]>([]);
  const [toggles, setToggles] = useState<boolean[]>([]);
  const [promoCodesLimit, setPromoCodesLimit] = useState<string>("1");
  const [increasedRewardsPercent, setIncreasedRewardsPercent] = useState<string>("10");
  // "0" reads as "inherit the platform default" — see UserTierFormData.maxDevices.
  const [maxDevices, setMaxDevices] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Index of "Promo Codes for Exclusive Offers" in ADMIN_SUBSCRIPTION_FEATURES
  const PROMO_FEATURE_INDEX = ADMIN_SUBSCRIPTION_FEATURES.indexOf(
    "Promo Codes for Exclusive Offers"
  );
  const JACKPOT_FEATURE_INDEX = ADMIN_SUBSCRIPTION_FEATURES.indexOf(
    JACKPOT_GROUP_LABEL
  );
  const JACKPOT_DETAIL_START_INDEX = ADMIN_SUBSCRIPTION_FEATURES.indexOf(
    JACKPOT_DETAIL_LABELS[0]
  );
  const INCREASED_REWARD_FEATURE_INDEX = ADMIN_SUBSCRIPTION_FEATURES.indexOf(
    "Increased Vip Tier Rewards (%-wise)"
  );

  const parsePercentFromFeatureText = (text?: string): number => {
    const m = String(text ?? "").match(/(\d+(\.\d+)?)/);
    if (!m) return 0;
    const n = Number(m[1]);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const updateIncreasedRewardsLabel = (rawPercent: string) => {
    const percent = Number(rawPercent);
    const nextLabel =
      Number.isFinite(percent) && percent > 0
        ? `Increased Vip Tier Rewards (${percent}%)`
        : "Increased Vip Tier Rewards (%-wise)";

    setFeatures((prev) => {
      if (INCREASED_REWARD_FEATURE_INDEX < 0) return prev;
      const next = [...prev];
      next[INCREASED_REWARD_FEATURE_INDEX] = nextLabel;
      return next;
    });
  };

  const [uploadTarget, setUploadTarget] = useState<
    "icon" | "backgroundImage" | null
  >(null);

  const [jackpotInfoOpen, setJackpotInfoOpen] = useState(false);

  type DeleteTarget =
    | { type: "icon" }
    | { type: "backgroundImage" }
    | { type: "feature"; index: number }
    | null;

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [formData, setFormData] = useState<UserTierFormData>({
    id: undefined,
    icon: "",
    backgroundImage: "",
    name: "",
    description: "",
    features: [],
    toggles: [],
    sequence: 0,
    isActive: true,
    prize: "",
    interval: "MONTHLY",
    currency: "USD",
  });

  const isEdit = Boolean(initialData);

  // ✅ Always keep toggles length equal to features length (fix: toggle not reflecting + mismatch)
  const syncTogglesToFeatures = (
    nextFeatures: string[],
    nextToggles?: boolean[]
  ) => {
    const base = Array.isArray(nextToggles) ? [...nextToggles] : [];
    const synced = nextFeatures.map((_, i) => Boolean(base[i] ?? true));
    setToggles(synced);
  };

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        interval: initialData.interval ?? "MONTHLY",
        currency: initialData.currency ?? "USD",
      });
      setPromoCodesLimit(String((initialData as any).promoCodesLimit ?? 1));
      setMaxDevices(String((initialData as any).maxDevices ?? 0));

      // Pad existing tier features to full ADMIN_SUBSCRIPTION_FEATURES length so
      // newly added rows (e.g. "Increased Vip Tier Rewards") render in edit mode
      // even on tiers saved before they existed. Missing slots get default label
      // + toggle OFF.
      const stored = initialData.features || [];
      const storedToggles = initialData.toggles || [];
      const initFeatures = DEFAULT_FEATURES.map(
        (def, i) => stored[i] ?? def,
      );
      const initToggles = DEFAULT_FEATURES.map(
        (_, i) => storedToggles[i] ?? false,
      );
      setFeatures(initFeatures);
      syncTogglesToFeatures(initFeatures, initToggles);
      const initPercent =
        Number((initialData as any).increasedRewardsPercent) > 0
          ? Number((initialData as any).increasedRewardsPercent)
          : parsePercentFromFeatureText(
              initFeatures[INCREASED_REWARD_FEATURE_INDEX]
            ) || 10;
      setIncreasedRewardsPercent(String(initPercent));
    } else {
      // ✅ CREATE: show all features by default
      const initFeatures = [...DEFAULT_FEATURES];

      setFormData({
        id: undefined,
        icon: "",
        backgroundImage: "",
        name: "",
        description: "",
        features: [],
        toggles: [],
        sequence: 0,
        isActive: true,
        prize: "",
        interval: "MONTHLY",
        currency: "USD",
      });

      setFeatures(initFeatures);
      syncTogglesToFeatures(initFeatures, initFeatures.map(() => true));
      setIncreasedRewardsPercent("10");
      setMaxDevices("0");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  useEffect(() => {
    if (features.length !== toggles.length) {
      syncTogglesToFeatures(features, toggles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  if (!open) return null;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      await onSubmit({
        ...formData,
        features,
        toggles,
        promoCodesLimit: Number(promoCodesLimit) || 0,
        increasedRewardsPercent: Number(increasedRewardsPercent) || 0,
        maxDevices: Math.max(0, Number(maxDevices) || 0),
      } as any);

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-0">
      <div className="w-full max-w-6xl max-h-[90vh] bg-[#15181E] rounded-xl flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-[#2a2f3a]">
          <h2 className="text-white text-lg font-medium">
            {isEdit ? "Edit" : "Create new"}
          </h2>
          <button
            onClick={isSubmitting ? undefined : onClose}
            className="text-gray-400 hover:text-white"
          >
            <X />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 scrollbar-hide">
          <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 md:gap-6 md:mb-8">
            <div>
              <Label className="text-white text-xs">Icon</Label>
              <Button
                variant="outline"
                className="mt-2 gap-2 h-12 w-full md:w-100"
                onClick={() => {
                  setUploadTarget("icon");
                  uploaderRef.current?.open();
                }}
              >
                <Upload size={14} /> Upload
              </Button>

              {formData.icon && (
                <div className="mt-3 flex items-center justify-between bg-[#1F2630] p-3 rounded-md w-[180px]">
                  <img src={formData.icon} className="w-10 h-10" />
                  <Trash2
                    className="cursor-pointer text-gray-400 hover:text-red-400"
                    onClick={() => setDeleteTarget({ type: "icon" })}
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-white text-xs mb-1 block">
                Tier Name*
              </Label>
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
            <div className="col-span-full space-y-3">
              <Label className="text-white text-xs">Features</Label>

              {features.map((feature, index) => (
                index === JACKPOT_FEATURE_INDEX ||
                (index >= JACKPOT_DETAIL_START_INDEX &&
                  index < JACKPOT_DETAIL_START_INDEX + JACKPOT_DETAIL_LABELS.length) ? null : (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <FigmaInput
                      value={feature}
                      onChange={(e) => {
                        const updated = [...features];
                        updated[index] = e.target.value;
                        setFeatures(updated);
                      }}
                      placeholder={`Feature ${index + 1}`}
                    />

                    <Switch
                      checked={Boolean(toggles[index])}
                      onCheckedChange={(v) => {
                        setToggles((prev) => {
                          const updated = [...prev];
                          updated[index] = v;
                          return updated;
                        });
                      }}
                      className="data-[state=checked]:bg-purple-500"
                    />

                    <Trash2
                      className="text-gray-400 cursor-pointer hover:text-red-400"
                      onClick={() => setDeleteTarget({ type: "feature", index })}
                    />
                  </div>

                  {/* Promo codes limit number input */}
                  {index === PROMO_FEATURE_INDEX && Boolean(toggles[index]) && (
                    <div className="ml-4 inline-flex w-fit items-center gap-2 bg-[#1F2630] border border-purple-500/30 rounded-md px-3 py-2">
                      <Label className="text-white text-xs whitespace-nowrap">
                        Promo Codes Limit:
                      </Label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-20 h-8 px-2 text-center text-sm bg-[#0E1218] border border-white/10 rounded-md text-white focus:outline-none focus:border-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={promoCodesLimit}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setPromoCodesLimit(val);
                        }}
                      />
                    </div>
                  )}

                  {index === INCREASED_REWARD_FEATURE_INDEX &&
                    Boolean(toggles[index]) && (
                      <div className="ml-4 inline-flex w-fit items-center gap-2 bg-[#1F2630] border border-purple-500/30 rounded-md px-3 py-2">
                        <Label className="text-white text-xs whitespace-nowrap">
                          Reward Increase:
                        </Label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-20 h-8 px-2 text-center text-sm bg-[#0E1218] border border-white/10 rounded-md text-white focus:outline-none focus:border-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={increasedRewardsPercent}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9.]/g, "");
                            if (val.split(".").length > 2) {
                              const [first, ...rest] = val.split(".");
                              val = `${first}.${rest.join("")}`;
                            }
                            setIncreasedRewardsPercent(val);
                            updateIncreasedRewardsLabel(val);
                          }}
                        />
                        <span className="text-purple-300 text-xs font-bold">%</span>
                      </div>
                    )}
                </div>
                )
              ))}

              {JACKPOT_FEATURE_INDEX >= 0 && JACKPOT_DETAIL_START_INDEX >= 0 && (
                <div className="rounded-lg bg-[#1A1F27] px-4 py-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">
                      {features[JACKPOT_FEATURE_INDEX]}
                    </span>
                    <button
                      type="button"
                      onClick={() => setJackpotInfoOpen(true)}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-300 hover:bg-purple-500/40"
                      aria-label="Show jackpot access details"
                    >
                      <Info size={10} />
                    </button>
                  </div>

                  <div className="pl-4 space-y-3 border-l border-white/10">
                    {JACKPOT_DETAIL_LABELS.map((label, detailOffset) => {
                      const detailIndex = JACKPOT_DETAIL_START_INDEX + detailOffset;
                      return (
                        <div key={label} className="flex items-center gap-3">
                          <span className="text-white text-sm flex-1">
                            {label}
                          </span>

                          <Switch
                            checked={Boolean(toggles[detailIndex])}
                            onCheckedChange={(v) => {
                              setToggles((prev) => {
                                const updated = [...prev];
                                updated[detailIndex] = v;
                                return updated;
                              });
                            }}
                            className="data-[state=checked]:bg-purple-500"
                          />

                          <Trash2
                            className="text-gray-400 cursor-pointer hover:text-red-400"
                            onClick={() =>
                              setDeleteTarget({ type: "feature", index: detailIndex })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextFeatures = [...features, ""];
                  setFeatures(nextFeatures);
                  syncTogglesToFeatures(nextFeatures, [...toggles, true]);
                }}
              >
                + Add Feature
              </Button> */}
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
              <FigmaInput
                value={formData?.prize}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    prize: e?.target?.value,
                  }))
                }
                placeholder="20 / Free"
              />
            </div>

            {/*
              Deliberately a plain field here rather than a row in the feature
              matrix above. That matrix is positional — labels and toggles are
              matched by index against ADMIN_SUBSCRIPTION_FEATURES — so adding an
              entry shifts every index after it and breaks the jackpot grouping.
            */}
            <div>
              <Label className="text-white text-xs mb-2">
                Devices allowed
              </Label>
              <FigmaInput
                type="number"
                min={0}
                max={50}
                value={maxDevices}
                onChange={(e) => setMaxDevices(e.target.value)}
                placeholder="0"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                How many devices a member of this tier can stay signed in on at
                once. Leave at <span className="text-gray-300">0</span> to use
                the platform default.
              </p>
              <p className="mt-1 text-[11px] text-amber-400/80">
                Only applies when Settings → System Configuration → Security →
                Device Limit Source is set to{" "}
                <span className="font-semibold">Per subscription tier</span>.
                On <span className="font-semibold">Same for everyone</span>,
                this value is ignored.
              </p>
            </div>

            {/* ✅ Sub Tiers removed from UI */}

            <div className="space-y-2 mt-6">
              <Label className="text-white text-xs">Is Active</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, isActive: checked }))
                  }
                  className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                />
                <span className="text-white text-xs">
                  {formData.isActive ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 px-4 py-4 md:px-6 border-t border-[#2a2f3a]">
          <Button
            variant="outline"
            className="border-gray-600 text-white"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            className="bg-purple-500 text-white hover:bg-purple-600 flex items-center gap-2"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}
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
              ? `Feature {deleteTarget.index + 1}`
              : (deleteTarget?.type ?? "")
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;

            if (deleteTarget.type === "icon") {
              setFormData((p) => ({ ...p, icon: "" }));
            }

            if (deleteTarget.type === "backgroundImage") {
              setFormData((p) => ({ ...p, backgroundImage: "" }));
            }

            if (deleteTarget.type === "feature") {
              const nextFeatures = features.filter(
                (_, i) => i !== deleteTarget.index
              );
              const nextToggles = toggles.filter(
                (_, i) => i !== deleteTarget.index
              );
              setFeatures(nextFeatures);
              syncTogglesToFeatures(nextFeatures, nextToggles);
            }

            setDeleteTarget(null);
          }}
        />

        {jackpotInfoOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
            <div className="bg-[#1F2630] rounded-2xl p-6 w-full max-w-md relative shadow-2xl border border-white/[0.06]">
              <button
                onClick={() => setJackpotInfoOpen(false)}
                className="absolute top-4 right-4 w-7 h-7 rounded-md bg-[#2A3140] flex items-center justify-center hover:bg-[#38404a] transition-colors text-white"
              >
                <X size={14} />
              </button>

              <div className="flex items-center gap-2 mb-5">
                <h3 className="text-white text-base font-bold">Jackpot Access Details</h3>
              </div>

              <div className="bg-[#15181E] rounded-xl px-4 py-4 space-y-3">
                {JACKPOT_DETAIL_LABELS.map((label, idx) => {
                  const detailIndex = JACKPOT_DETAIL_START_INDEX + idx;
                  const enabled = Boolean(toggles[detailIndex]);
                  return (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          enabled
                            ? "bg-purple-500/20 text-purple-300"
                            : "bg-gray-700/50 text-gray-500"
                        }`}
                      >
                        {enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
