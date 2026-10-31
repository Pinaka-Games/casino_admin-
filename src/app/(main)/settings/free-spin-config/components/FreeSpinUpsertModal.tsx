"use client";

import { CircleHelp, X, Upload, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FreeSpin,
  CreateFreeSpinDto,
  FreeSpinSelection,
  SpinCurrency,
  WinningsTarget,
} from "@/types/free-spin";
import FreeSpinSelectionPicker from "@/components/free-spin/FreeSpinSelectionPicker";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";

interface Props {
  open: boolean;
  initialData: FreeSpin | null;
  onClose: () => void;
  onSubmit: (data: CreateFreeSpinDto) => Promise<void>;
}

const defaultFormState: CreateFreeSpinDto & { isActive: boolean } = {
  name: "",
  description: "",
  imageUrl: "",
  selections: [] as FreeSpinSelection[],
  betLevel: undefined as unknown as number,
  numberOfFreeSpins: undefined as unknown as number,
  casinoCampaignId: "",
  grantExpiresInDays: undefined,
  spinCurrency: SpinCurrency.SC,
  winningsTarget: WinningsTarget.REAL_SC,
  winningsWageringMultiplier: undefined,
  isActive: true,
};

/**
 * Wulf Coin (GC) free spins are switched OFF in the admin for now.
 *
 * AleaPlay has not enabled GC bonuses for our integrator — every gold grant
 * comes back 400 `error.free-spin.currency-not-allowed` / `error.skin.not-found`
 * (integrator 83, software 63, environment 2740). Rather than let admins build
 * templates that can only fail, the picker is hidden and every template is
 * created as SC.
 *
 * The whole GC path is already built and working on our side — entity, DTO,
 * grant payload, gold winnings routing, and the matching game-launch session.
 * Flip this to `true` once AleaPlay confirms GC free spins are enabled; nothing
 * else has to change.
 */
const GC_FREE_SPINS_ENABLED = false;

type FormState = typeof defaultFormState;

export default function FreeSpinUpsertModal({
  open,
  initialData,
  onClose,
  onSubmit,
}: Props) {
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const [formData, setFormData] = useState<FormState>({ ...defaultFormState });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Gold rounds are free play: the winnings are paid in Wulf Coin and never
   * touch Wulf Cash, so the sweeps-only payout fields are hidden and skipped.
   */
  // Reads false while GC is switched off, so the sweeps-only payout fields
  // stay visible and required — a template saved as SC must always have a
  // winnings target, including one edited down from a GC test template.
  const isGoldSpins =
    GC_FREE_SPINS_ENABLED && formData.spinCurrency === SpinCurrency.GC;

  /* ================= POPULATE / RESET ON OPEN ================= */
  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setFormData({
        name: initialData.name ?? "",
        description: initialData.description ?? "",
        imageUrl: initialData.imageUrl ?? "",
        // Templates saved before multi-select have no `selections` — rebuild one
        // from the legacy provider/game pair so editing them doesn't wipe it.
        selections: initialData.selections?.length
          ? initialData.selections
          : initialData.softwareId && initialData.gameId
            ? [
                {
                  softwareId: Number(initialData.softwareId),
                  softwareName: initialData.softwareName,
                  games: [
                    { id: Number(initialData.gameId), name: initialData.gameName },
                  ],
                },
              ]
            : [],
        betLevel: initialData.betLevel
          ? Number(initialData.betLevel)
          : (undefined as unknown as number),
        numberOfFreeSpins: initialData.numberOfFreeSpins
          ? Number(initialData.numberOfFreeSpins)
          : (undefined as unknown as number),
        casinoCampaignId: initialData.casinoCampaignId ?? "",
        grantExpiresInDays: initialData.grantExpiresInDays
          ? Number(initialData.grantExpiresInDays)
          : undefined,
        spinCurrency: initialData.spinCurrency ?? SpinCurrency.SC,
        winningsTarget:
          initialData.winningsTarget ?? WinningsTarget.REAL_SC,
        winningsWageringMultiplier: initialData.winningsWageringMultiplier
          ? Number(initialData.winningsWageringMultiplier)
          : undefined,
        isActive: initialData.isActive ?? true,
      });
    } else {
      setFormData({ ...defaultFormState });
    }
    setErrors({});
  }, [open, initialData]);

  /* ================= VALIDATION ================= */
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.selections.length) {
      newErrors.selections = "Select a provider and at least one game";
    } else if (!formData.selections[0].games.length) {
      newErrors.selections = `Select at least one game for ${formData.selections[0].softwareName ?? "this provider"}`;
    }
    if (!formData.betLevel) newErrors.betLevel = "Spin value level is required";
    if (!formData.numberOfFreeSpins)
      newErrors.numberOfFreeSpins = "Free spins per game is required";
    // Winnings target and playthrough only exist for sweeps grants: gold pays
    // out in gold and carries no wagering, so requiring them would block a
    // perfectly valid gold template on fields it does not even show.
    if (!isGoldSpins) {
      if (!formData.winningsTarget)
        newErrors.winningsTarget = "Winnings target is required";
      if (
        formData.winningsWageringMultiplier === undefined ||
        formData.winningsWageringMultiplier <= 0
      ) {
        newErrors.winningsWageringMultiplier =
          "Winnings wagering multiplier is required";
      }
    }

    if (
      formData.grantExpiresInDays !== undefined &&
      formData.grantExpiresInDays <= 0
    ) {
      newErrors.grantExpiresInDays = "Must be a positive number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload: CreateFreeSpinDto = {
        name: formData.name.trim(),
        description: formData.description || undefined,
        imageUrl: formData.imageUrl || undefined,
        // The backend mirrors selections[0] onto softwareId/gameId, so those
        // legacy fields are not sent from here.
        selections: formData.selections,
        betLevel: formData.betLevel,
        numberOfFreeSpins: formData.numberOfFreeSpins,
        casinoCampaignId: formData.casinoCampaignId || undefined,
        grantExpiresInDays: formData.grantExpiresInDays,
        spinCurrency: GC_FREE_SPINS_ENABLED
          ? formData.spinCurrency
          : SpinCurrency.SC,
        winningsTarget: formData.winningsTarget,
        // Gold winnings are credited as gold and never locked, so any
        // playthrough left over from a previous SC setting is dropped.
        winningsWageringMultiplier: isGoldSpins
          ? undefined
          : formData.winningsWageringMultiplier,
        // Status is owned by the table-level toggle, not this modal. Any
        // create or edit through here lands the config in active state;
        // deactivation is an explicit action via the row toggle.
        isActive: true,
      };
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="w-full max-w-6xl h-[90vh] bg-[#15181E] rounded-xl p-6 relative flex flex-col">
        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white text-lg font-medium">
            {initialData ? "Edit Free Spin Config" : "Create Free Spin Config"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* ================= BODY (SCROLL) ================= */}
        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5 items-start">
            {/* ================= LEFT COLUMN ================= */}
            <div className="space-y-5">
              {/* Name */}
              <div>
                <Label className="text-white text-xs">
                  Name<span className="text-red-500">*</span>
                </Label>
                <input
                  className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  placeholder="e.g., Welcome Free Spins"
                />
                {errors.name && (
                  <p className="text-xs text-red-400 mt-1">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <Label className="text-white text-xs">Description</Label>
                <Textarea
                  className="w-full mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm min-h-[80px]"
                  value={formData.description ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional description"
                />
              </div>

              {/* Image */}
              {/* <div>
                <Label className="text-white text-xs">Image</Label>
                <Button
                  variant="outline"
                  className="mt-2 gap-2 h-12 w-full"
                  onClick={() => uploaderRef.current?.open()}
                  type="button"
                >
                  <Upload size={14} /> Choose File
                </Button>
                {formData.imageUrl && (
                  <div className="mt-3 flex items-center justify-between bg-[#1F2630] p-3 rounded-md">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded"
                    />
                    <Trash2
                      className="cursor-pointer text-gray-400 hover:text-red-400"
                      onClick={() =>
                        setFormData({ ...formData, imageUrl: "" })
                      }
                    />
                  </div>
                )}
                <ImageUploader
                  ref={uploaderRef}
                  folder="free-spin"
                  onUploadComplete={(url) =>
                    setFormData({ ...formData, imageUrl: url })
                  }
                />
              </div> */}

              {/* Number of Free Spins */}
              <div>
                <Label className="text-white text-xs">
                  Free Spins Per Game<span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-400 mt-1">
                  Applied to every game selected. Each game is granted separately, so a
                  player&apos;s total is this × the number of games — the exact total is
                  shown under the game list, and any game can be given its own number.
                </p>
                <input
                  type="number"
                  className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onWheel={(e) => e.currentTarget.blur()}
                  value={formData.numberOfFreeSpins ?? ""}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      numberOfFreeSpins: e.target.value
                        ? Number(e.target.value)
                        : (undefined as unknown as number),
                    });
                    if (errors.numberOfFreeSpins)
                      setErrors({ ...errors, numberOfFreeSpins: undefined });
                  }}
                  placeholder="20"
                  min={1}
                />
                {errors.numberOfFreeSpins && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.numberOfFreeSpins}
                  </p>
                )}
              </div>

              {/* Spin Value Level */}
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-white text-xs">
                    Spin Value Level<span className="text-red-500">*</span>
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-white"
                        aria-label="Spin value level information"
                      >
                        <CircleHelp size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-80 bg-[#242B35] text-white border border-gray-700 p-3 space-y-2">
                      <p className="font-medium text-xs">Spin Value Level</p>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        Controls how much each free spin is worth. Every slot game has a fixed number of paylines. The level sets how many coins are wagered per line per spin — higher level = higher spin value = bigger potential win for the player, but more costly to grant.
                      </p>
                      <div className="border-t border-gray-600 pt-2 space-y-1">
                        <p className="text-xs text-gray-400">Level 1 — 1 coin × max lines (lowest value)</p>
                        <p className="text-xs text-gray-400">Level 2 — 2 coins × max lines</p>
                        <p className="text-xs text-gray-400">Level 3 — 3 coins × max lines</p>
                        <p className="text-xs text-gray-400">Level 4 — 4 coins × max lines</p>
                        <p className="text-xs text-gray-400">Level 5 — 5 coins × max lines (highest value)</p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        The actual coin value in real currency is defined by AleaPlay per game and cannot be changed here.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.betLevel ? String(formData.betLevel) : undefined}
                  onValueChange={(value) => {
                    setFormData({ ...formData, betLevel: Number(value) });
                    if (errors.betLevel)
                      setErrors({ ...errors, betLevel: undefined });
                  }}
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white mt-1">
                    <SelectValue placeholder="Select spin value level" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                    <SelectItem value="1">Level 1 — 1 coin × max lines</SelectItem>
                    <SelectItem value="2">Level 2 — 2 coins × max lines</SelectItem>
                    <SelectItem value="3">Level 3 — 3 coins × max lines</SelectItem>
                    <SelectItem value="4">Level 4 — 4 coins × max lines</SelectItem>
                    <SelectItem value="5">Level 5 — 5 coins × max lines</SelectItem>
                  </SelectContent>
                </Select>
                {errors.betLevel && (
                  <p className="text-xs text-red-400 mt-1">{errors.betLevel}</p>
                )}
              </div>

              {/* Casino Campaign ID */}
              {/* <div>
                <div className="flex items-center gap-2">
                  <Label className="text-white text-xs">Campaign Reference ID</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-gray-400 hover:text-white" aria-label="Campaign reference ID information">
                        <CircleHelp size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-80 bg-[#242B35] text-white border border-gray-700 p-3 space-y-2">
                      <p className="font-medium text-xs">Campaign Reference ID</p>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        An optional label you assign on the AleaPlay side to group multiple free spin grants under one campaign. Useful for tracking a specific promotion (e.g. "WELCOME_MAY_2025") across many players in AleaPlay's reporting dashboard.
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Leave empty if you don't need campaign-level grouping. Has no effect on how spins are granted or played.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <input
                  className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm"
                  value={formData.casinoCampaignId ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, casinoCampaignId: e.target.value })
                  }
                  placeholder="e.g. WELCOME_MAY_2025 (optional)"
                />
              </div> */}

              {/* Grant Expires In Days */}
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-white text-xs">Grant Expires In Days</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-gray-400 hover:text-white" aria-label="Grant expires in days information">
                        <CircleHelp size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-80 bg-[#242B35] text-white border border-gray-700 p-3 space-y-2">
                      <p className="font-medium text-xs">Grant Expires In Days</p>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        How many days the player has to use their free spins after they are granted. Once this window passes, the spins expire and can no longer be played.
                      </p>
                      <div className="border-t border-gray-600 pt-2 space-y-1">
                        <p className="text-xs text-gray-400 leading-relaxed">Example: Set to 7 → player must use their spins within 7 days of receiving them.</p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Leave empty to use AleaPlay's default expiry. Recommended to always set this to enforce promotion deadlines.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <input
                  type="number"
                  className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onWheel={(e) => e.currentTarget.blur()}
                  value={formData.grantExpiresInDays ?? ""}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      grantExpiresInDays: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    });
                    if (errors.grantExpiresInDays)
                      setErrors({ ...errors, grantExpiresInDays: undefined });
                  }}
                  placeholder="e.g. 7 (optional)"
                  min={1}
                />
                {errors.grantExpiresInDays && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.grantExpiresInDays}
                  </p>
                )}
              </div>
            </div>

            {/* ================= RIGHT COLUMN ================= */}
            <div className="space-y-5">
              {/* Provider & Games — lives here because it is the only block
                  that grows (a chip per selected game). Keeping it opposite the
                  fixed-height fields keeps both columns filled. */}
              <div className="w-full">
                <Label className="text-white text-xs">
                  Provider &amp; Games<span className="text-red-500">*</span>
                </Label>
                <div className="mt-1">
                  <FreeSpinSelectionPicker
                    defaultSpins={formData.numberOfFreeSpins}
                    value={formData.selections}
                    onChange={(selections) => {
                      setFormData({ ...formData, selections });
                      if (errors.selections)
                        setErrors({ ...errors, selections: undefined });
                    }}
                    disabled={isSubmitting}
                    error={errors.selections}
                  />
                </div>
              </div>

              {/* Spin Currency — which wallet the rounds are played in */}
              <div className={`w-full ${GC_FREE_SPINS_ENABLED ? "" : "hidden"}`}>
                <Label className="text-white text-xs">
                  Spin Currency<span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.spinCurrency ?? SpinCurrency.SC}
                  onValueChange={(value) =>
                    setFormData({ ...formData, spinCurrency: value as SpinCurrency })
                  }
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white mt-1">
                    <SelectValue placeholder="Select spin currency" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                    <SelectItem value={SpinCurrency.SC}>Wulf Cash (SC)</SelectItem>
                    <SelectItem value={SpinCurrency.GC}>Wulf Coin (GC)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">
                  {isGoldSpins
                    ? "Gold rounds are free play — winnings are paid in Wulf Coin, never Wulf Cash, and carry no wagering. The player must open the game in Wulf Coin mode."
                    : "Sweeps rounds. The player must open the game in Wulf Cash mode, or the game shows its own paid bonus screen instead."}
                </p>
                {isGoldSpins && (
                  // AleaPlay enables free spins per currency, per game, per
                  // environment. Ours is not enabled for GC yet, so every gold
                  // grant comes back 400 error.free-spin.currency-not-allowed /
                  // error.skin.not-found. Saying so here beats an admin
                  // assigning to a hundred players and reading the failure after.
                  <p className="text-xs text-amber-400 mt-1">
                    AleaPlay must enable GC free spins for this integrator and game
                    first. Until they do, gold grants fail with
                    &quot;currency-not-allowed&quot;. Confirm with AleaPlay before using
                    this in production.
                  </p>
                )}
              </div>

              {/* Winnings Target — SC only. Gold winnings are paid in gold,
                  so there is nothing to choose and nothing to lock. */}
              <div className={`w-full ${isGoldSpins ? "hidden" : ""}`}>
                <Label className="text-white text-xs">
                  Winnings Target<span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.winningsTarget}
                  onValueChange={(value) => {
                    setFormData({
                      ...formData,
                      winningsTarget: value as WinningsTarget,
                    });
                    if (errors.winningsTarget)
                      setErrors({ ...errors, winningsTarget: undefined });
                  }}
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white mt-1">
                    <SelectValue placeholder="Select winnings target" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                    <SelectItem value={WinningsTarget.REAL_SC}>Wulf Cash</SelectItem>
                    {/* bonus_sc credits bonusWulfCash — locked Wulf Cash, NOT
                        Wulf Coin. It was labelled "Wulf Coin", which read as a
                        gold-coin promotion; AleaPlay free spins are granted in
                        SC only and there is no GC free-spin product. */}
                    <SelectItem value={WinningsTarget.BONUS_SC}>
                      Bonus Wulf Cash (locked)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.winningsTarget && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.winningsTarget}
                  </p>
                )}
              </div>

              {/* Winnings Wagering Multiplier — SC only; gold has no
                  redeemable value, so a playthrough on it is theatre. */}
              <div className={isGoldSpins ? "hidden" : ""}>
                <div className="flex items-center gap-2">
                  <Label className="text-white text-xs">
                    Winnings Wagering Multiplier<span className="text-red-500">*</span>
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-white"
                        aria-label="Winnings wagering multiplier information"
                      >
                        <CircleHelp size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-80 bg-[#242B35] text-white border border-gray-700 p-3 space-y-2">
                      <p className="font-medium text-xs">Winnings Wagering Multiplier</p>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        This is how you recover the cost of granting free spins. When a player wins from free spins, their winnings are locked as Wulf Coin and must be wagered (played through) this many times before they can redeem.
                      </p>
                      <div className="border-t border-gray-600 pt-2 space-y-1">
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Example: Player wins $10 from free spins with a 20x multiplier → they must wager $200 total before the $10 becomes redeemable.
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Required. Use 1 for no extra playthrough. Higher values defer redemption until the player wagers more.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <input
                  type="number"
                  className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onWheel={(e) => e.currentTarget.blur()}
                  value={formData.winningsWageringMultiplier ?? ""}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      winningsWageringMultiplier: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    });
                    if (errors.winningsWageringMultiplier)
                      setErrors({
                        ...errors,
                        winningsWageringMultiplier: undefined,
                      });
                  }}
                  placeholder="e.g. 20"
                  min={1}
                />
                {errors.winningsWageringMultiplier && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.winningsWageringMultiplier}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= FOOTER ================= */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-purple-600 hover:bg-purple-700 text-white min-w-[100px]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Saving...
              </span>
            ) : initialData ? (
              "Save Changes"
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
