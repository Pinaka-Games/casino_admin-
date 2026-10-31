"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePromotionStore } from "@/store/promotion-store";
import { systemConfigApi } from "@/api/system-config/system-config.api";
import { Promotion, PromotionType, CreatePromotionDto, UpdatePromotionDto } from "@/types/promotion";
import { toast } from "react-hot-toast";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import { PROMOTION_IMAGE_PRESETS } from "@/config/promotion-image-presets";

interface PromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Promotion | null;
}

const EMPTY_FORM: CreatePromotionDto = {
  name: "",
  description: "",
  imageUrl: "",
  type: PromotionType.FIRST_DEPOSIT,
  depositNumber: undefined,
  bonusPercentage: undefined as any,
  minDepositAmount: undefined as any,
  maxBonusAmount: undefined,
  autoApply: true,
  wageringMultiplier: undefined as any,
  kycRequired: false,
  isActive: true,
  priority: undefined as any,
  validityDays: 30,
  startDate: undefined,
  endDate: undefined,
};

/**
 * Deposit step each promotion type occupies. Mirrors the server, which is the
 * authority — this only lets the dialog show what will be saved.
 */
const TYPE_PRIORITIES: Partial<Record<PromotionType, number>> = {
  [PromotionType.FIRST_DEPOSIT]: 1,
  [PromotionType.SECOND_DEPOSIT]: 2,
  [PromotionType.THIRD_DEPOSIT]: 3,
  [PromotionType.FOURTH_DEPOSIT]: 4,
  [PromotionType.FIFTH_DEPOSIT]: 5,
};

/**
 * Reload matches every deposit from the 2nd on, so it must sort behind every
 * targeted promotion — including an Nth Deposit one aimed at the 1000th.
 * Mirrors PromotionsService.RELOAD_PRIORITY.
 */
const RELOAD_PRIORITY = 1_000_000;

/** Nth Deposit sits past the five fixed steps, spaced by its own target deposit. */
const NTH_PRIORITY_OFFSET = 5;

/** Deposits 1–5 have their own promotion types, which own priorities 1–5. */
const NTH_MIN_DEPOSIT = 6;

/**
 * `datetime-local` speaks local wall-clock time, so a stored UTC instant has to
 * be shifted into the local zone before it can be shown. Using
 * `toISOString().slice(0,16)` here (as this dialog used to) renders the UTC
 * time in a local-time field, so every reopen displayed — and then re-saved —
 * a time offset by the timezone.
 */
const toLocalInputValue = (iso?: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const nowLocalInputValue = () => toLocalInputValue(new Date().toISOString());

export function PromotionDialog({ open, onOpenChange, data }: PromotionDialogProps) {
  const { createPromotion, updatePromotion } = usePromotionStore();
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const isEdit = Boolean(data);
  const [formData, setFormData] = useState<CreatePromotionDto | UpdatePromotionDto>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedImageUrl = formData.imageUrl || "";
  const isPresetImageSelected = PROMOTION_IMAGE_PRESETS.includes(selectedImageUrl);

  const isNthDeposit = formData.type === PromotionType.NTH_DEPOSIT;

  const derivedPriority =
    (formData.type && TYPE_PRIORITIES[formData.type]) ??
    (isNthDeposit && Number(formData.depositNumber) > 0
      ? NTH_PRIORITY_OFFSET + Number(formData.depositNumber)
      : undefined) ??
    formData.priority ??
    RELOAD_PRIORITY;

  // The end date can never precede the start, nor sit in the past.
  const endDateMin = (() => {
    const now = nowLocalInputValue();
    const start = toLocalInputValue(formData.startDate);
    return start && start > now ? start : now;
  })();

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name,
        description: data.description || "",
        imageUrl: data.imageUrl || "",
        type: data.type,
        depositNumber: data.depositNumber ?? undefined,
        bonusPercentage: data.bonusPercentage,
        minDepositAmount: data.minDepositAmount,
        maxBonusAmount: data.maxBonusAmount || undefined,
        autoApply: data.autoApply,
        wageringMultiplier: data.wageringMultiplier,
        kycRequired: data.kycRequired,
        isActive: data.isActive,
        priority: data.priority,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      });
    } else {
      setFormData(EMPTY_FORM);

      void (async () => {
        try {
          const response = await systemConfigApi.get();
          const promotionDefaults = response.config.promotion_defaults;
          const bonusDefaults = response.config.bonus_defaults;

          setFormData((prev) => ({
            ...prev,
            autoApply:
              typeof promotionDefaults.auto_apply_promotions === "boolean"
                ? promotionDefaults.auto_apply_promotions
                : prev.autoApply,
            wageringMultiplier:
              typeof promotionDefaults.default_promotion_wagering_multiplier === "number"
                ? promotionDefaults.default_promotion_wagering_multiplier
                : prev.wageringMultiplier,
            kycRequired:
              typeof bonusDefaults.default_kyc_required === "boolean"
                ? bonusDefaults.default_kyc_required
                : prev.kycRequired,
            priority:
              typeof promotionDefaults.default_priority === "number"
                ? promotionDefaults.default_priority
                : prev.priority,
            validityDays:
              typeof promotionDefaults.default_promotion_validity_days === "number"
                ? promotionDefaults.default_promotion_validity_days
                : prev.validityDays,
          }));
        } catch {
          // Keep local defaults if config fetch fails.
        }
      })();
    }
    setErrors({});
  }, [data, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) newErrors.name = "Name is required";
    if (!formData.description?.trim()) newErrors.description = "Description is required";
    if (!formData.imageUrl?.trim()) newErrors.imageUrl = "Image URL is required";
    if (!formData.type) newErrors.type = "Type is required";
    if (formData.type === PromotionType.NTH_DEPOSIT) {
      const target = Number(formData.depositNumber);
      if (!formData.depositNumber || !Number.isInteger(target)) {
        newErrors.depositNumber = "Deposit number is required";
      } else if (target < NTH_MIN_DEPOSIT) {
        // Deposits 1–5 already have dedicated types; two promotions competing
        // for the same deposit is what the server rejects.
        newErrors.depositNumber = `Use the First–Fifth Deposit types for deposits 1–${NTH_MIN_DEPOSIT - 1}`;
      }
    }
    if (formData.bonusPercentage === undefined || formData.bonusPercentage <= 0) newErrors.bonusPercentage = "Bonus percentage is required";
    if (formData.minDepositAmount === undefined || formData.minDepositAmount <= 0) newErrors.minDepositAmount = "Min deposit amount is required";
    if (formData.wageringMultiplier === undefined || formData.wageringMultiplier < 0) newErrors.wageringMultiplier = "Wagering multiplier is required";
    // Priority is derived from the type, so there is nothing for the operator
    // to fill in and nothing to validate.
    if (!formData.maxBonusAmount) newErrors.maxBonusAmount = "Max bonus amount is required";
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.endDate) newErrors.endDate = "End date is required";

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate).getTime();
      const end = new Date(formData.endDate).getTime();

      if (end <= start) {
        newErrors.endDate = "End date must be after the start date";
      } else if (end <= Date.now() && formData.endDate !== data?.endDate) {
        // An already-expired promotion can be edited and saved as-is; what is
        // rejected is *choosing* a new end date that is already in the past.
        newErrors.endDate = "End date cannot be in the past";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill all required fields marked *");
      return;
    }

    try {
      // Calculate validityDays from startDate and endDate
      let calculatedValidityDays = 30; // default
      if (formData.startDate && formData.endDate) {
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        calculatedValidityDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Sanitize data - ensure all numeric fields are numbers
      const sanitizedData: CreatePromotionDto | UpdatePromotionDto = {
        ...formData,
        bonusPercentage: Number(formData.bonusPercentage ?? 0),
        minDepositAmount: formData.minDepositAmount !== undefined ? Number(formData.minDepositAmount) : undefined,
        maxBonusAmount: formData.maxBonusAmount !== undefined ? Number(formData.maxBonusAmount) : undefined,
        wageringMultiplier: formData.wageringMultiplier !== undefined ? Number(formData.wageringMultiplier) : undefined,
        validityDays: calculatedValidityDays,
        priority: derivedPriority,
        // Only Nth Deposit carries a target; sending a stale one on another
        // type would be cleared server-side anyway, so send null explicitly.
        depositNumber: isNthDeposit ? Number(formData.depositNumber) : null,
      };

      if (isEdit && data) {
        await updatePromotion(data.id, sanitizedData);
      } else {
        await createPromotion(sanitizedData as CreatePromotionDto);
      }
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      // Error already handled in store with toast
      console.error("Failed to save promotion:", error);
    }
  };

  const updateField = (field: keyof CreatePromotionDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15181E] p-3 sm:p-6 text-white w-full max-w-none! h-dvh max-h-dvh rounded-none sm:w-full sm:max-w-6xl! sm:h-[90vh] sm:max-h-[90vh] sm:rounded-lg flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{isEdit ? "Edit Promotion" : "Add New Promotion"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs text-white">Name <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="bg-[#242B35] border-none text-white"
                placeholder="e.g., First Deposit Bonus"
                required
              />
              {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label className="text-xs text-white">Type <span className="text-red-500">*</span></Label>
              <Select
                value={formData.type}
                onValueChange={(value) => updateField("type", value as PromotionType)}
              >
                <SelectTrigger className="bg-[#242B35] border-none text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#242B35] text-white border-gray-600">
                  <SelectItem value={PromotionType.FIRST_DEPOSIT}>First Deposit</SelectItem>
                  <SelectItem value={PromotionType.SECOND_DEPOSIT}>Second Deposit</SelectItem>
                  <SelectItem value={PromotionType.THIRD_DEPOSIT}>Third Deposit</SelectItem>
                  <SelectItem value={PromotionType.FOURTH_DEPOSIT}>Fourth Deposit</SelectItem>
                  <SelectItem value={PromotionType.FIFTH_DEPOSIT}>Fifth Deposit</SelectItem>
                  <SelectItem value={PromotionType.NTH_DEPOSIT}>Nth Deposit</SelectItem>
                  <SelectItem value={PromotionType.RELOAD_DEPOSIT}>Reload Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Deposit Number — the N in "Nth Deposit". Only that type targets a
                single deposit; the fixed types carry their number in the type
                itself and Reload applies to every deposit from the 2nd on. */}
            {isNthDeposit && (
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs text-white">
                  Deposit Number (N) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={NTH_MIN_DEPOSIT}
                  step={1}
                  value={formData.depositNumber ?? ""}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) =>
                    updateField(
                      "depositNumber",
                      e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                    )
                  }
                  className="bg-[#242B35] border-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="e.g., 50, 100, 1000"
                  required
                />
                <p className="text-xs text-gray-400">
                  Awards on exactly this deposit — 100 means the player's 100th
                  deposit. Deposits 1–{NTH_MIN_DEPOSIT - 1} have their own types.
                </p>
                {errors.depositNumber && (
                  <p className="text-xs text-red-400">{errors.depositNumber}</p>
                )}
              </div>
            )}

            {/* Bonus Percentage */}
            <div className="space-y-1">
              <Label className="text-xs text-white">Bonus Percentage (%) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={formData.bonusPercentage ?? ""}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => updateField("bonusPercentage", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="bg-[#242B35] border-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="e.g., 100"
                required
              />
              {errors.bonusPercentage && <p className="text-xs text-red-400">{errors.bonusPercentage}</p>}
            </div>

            {/* Min Deposit Amount */}
            <div className="space-y-1">
              <Label className="text-xs text-white">Min Deposit Amount <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={formData.minDepositAmount ?? ""}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => updateField("minDepositAmount", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="bg-[#242B35] border-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="e.g., 50"
                required
              />
              {errors.minDepositAmount && <p className="text-xs text-red-400">{errors.minDepositAmount}</p>}
            </div>

            {/* Max Bonus Amount */}
            <div className="space-y-1">
              <Label className="text-xs text-white">Max Bonus Amount <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={formData.maxBonusAmount ?? ""}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => updateField("maxBonusAmount", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="bg-[#242B35] border-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="e.g., 1000"
                required
              />
              {errors.maxBonusAmount && <p className="text-xs text-red-400">{errors.maxBonusAmount}</p>}
            </div>

            {/* Wagering Multiplier */}
            <div className="space-y-1">
              <Label className="text-xs text-white">Wagering Multiplier <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={formData.wageringMultiplier ?? ""}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => updateField("wageringMultiplier", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="bg-[#242B35] border-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="e.g., 35"
                required
              />
              {errors.wageringMultiplier && <p className="text-xs text-red-400">{errors.wageringMultiplier}</p>}
            </div>

            {/* Priority — derived from the deposit step so two promotions can
                never share one; the server re-derives it on save regardless. */}
            <div className="space-y-1">
              <Label className="text-xs text-white">Priority</Label>
              <Input
                type="number"
                value={derivedPriority ?? ""}
                readOnly
                disabled
                className="bg-[#1b212b] border-none text-gray-400 cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-[11px] text-gray-400">
                Set automatically from the promotion type.
              </p>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <Label className="text-xs text-white">Start Date <span className="text-red-500">*</span></Label>
              <Input
                type="datetime-local"
                value={toLocalInputValue(formData.startDate)}
                // Only a new promotion is pinned to the future — an existing one
                // may legitimately have started in the past.
                min={isEdit ? undefined : nowLocalInputValue()}
                onChange={(e) => updateField("startDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className="bg-[#242B35] border-none text-white"
                required
              />
              {errors.startDate && <p className="text-xs text-red-400">{errors.startDate}</p>}
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <Label className="text-xs text-white">End Date <span className="text-red-500">*</span></Label>
              <Input
                type="datetime-local"
                value={toLocalInputValue(formData.endDate)}
                // Never before the start, and never in the past — the picker
                // greys those out and validateForm rejects a typed-in value.
                min={endDateMin}
                onChange={(e) => updateField("endDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className="bg-[#242B35] border-none text-white"
                required
              />
              {errors.endDate && <p className="text-xs text-red-400">{errors.endDate}</p>}
            </div>

            {/* Image Upload */}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-white">Promotion Image <span className="text-red-500">*</span></Label>
              <div className="flex flex-col gap-3 mt-2">
                {/* Preview */}
                <div className="flex items-center justify-between bg-[#1F2630] p-3 rounded-md min-h-[100px]">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded bg-[#252B35] overflow-hidden flex items-center justify-center">
                      {selectedImageUrl ? (
                        <img
                          src={selectedImageUrl}
                          alt="Promotion preview"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">No image</span>
                      )}
                    </div>
                    <div className="text-sm">
                      <p className="text-white font-medium">
                        {selectedImageUrl
                          ? isPresetImageSelected
                            ? "Preset Image"
                            : "Custom Upload"
                          : "No Image Selected"}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {selectedImageUrl
                          ? isPresetImageSelected
                            ? "Using selected preset image"
                            : "Using your uploaded image"
                          : "Select a preset or upload custom image"}
                      </p>
                    </div>
                  </div>

                  {selectedImageUrl && (
                    <Trash2
                      className="cursor-pointer text-gray-400 hover:text-red-400 transition-colors"
                      onClick={() => updateField("imageUrl", "")}
                    />
                  )}
                </div>

                {/* Preset grid */}
                <div>
                  <Label className="text-white text-xs mb-2 block">
                    Select Preset Image
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PROMOTION_IMAGE_PRESETS.map((presetUrl, index) => {
                      const isSelected = selectedImageUrl === presetUrl;
                      return (
                        <button
                          key={presetUrl}
                          type="button"
                          onClick={() => updateField("imageUrl", presetUrl)}
                          className={`relative h-20 md:h-24 rounded-lg overflow-hidden border bg-[#252B35] transition-colors ${
                            isSelected
                              ? "border-purple-500 ring-1 ring-purple-500/40"
                              : "border-gray-700 hover:border-gray-500"
                          }`}
                          aria-label={`Select promotion preset image ${index + 1}`}
                        >
                          <img
                            src={presetUrl}
                            alt={`Promotion preset ${index + 1}`}
                            className="w-full h-full object-contain p-1"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 h-10 w-full"
                  onClick={() => {
                    uploaderRef.current?.open();
                  }}
                >
                  <Upload size={14} /> Upload Custom Image
                </Button>
              </div>
              {errors.imageUrl && <p className="text-xs text-red-400">{errors.imageUrl}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-white">Description <span className="text-red-500">*</span></Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => updateField("description", e.target.value || undefined)}
                className="bg-[#242B35] border-none text-white min-h-[80px]"
                placeholder="Enter promotion description..."
                required
              />
              {errors.description && <p className="text-xs text-red-400">{errors.description}</p>}
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-3 gap-2 sm:col-span-2 sm:gap-4">
              {/* Auto Apply */}
              <div className="space-y-2">
                <Label className="text-white text-xs font-normal">Auto Apply</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.autoApply}
                    onCheckedChange={(checked) => updateField("autoApply", checked)}
                    className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                  />
                  <span className="text-white text-xs font-normal">
                    {formData.autoApply ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              {/* KYC Required */}
              <div className="space-y-2">
                <Label className="text-white text-xs font-normal">KYC Required</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.kycRequired}
                    onCheckedChange={(checked) => updateField("kycRequired", checked)}
                    className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                  />
                  <span className="text-white text-xs font-normal">
                    {formData.kycRequired ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              {/* Is Active */}
              <div className="space-y-2">
                <Label className="text-white text-xs font-normal">Is Active</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => updateField("isActive", checked)}
                    className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                  />
                  <span className="text-white text-xs font-normal">
                    {formData.isActive ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 mt-4">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            className="bg-[#B93DEB] text-white hover:bg-purple-500"
          >
            {isEdit ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* ImageUploader component */}
      <ImageUploader
        ref={uploaderRef}
        folder="promotions"
        onUploadComplete={(url) => {
          updateField("imageUrl", url);
        }}
      />
    </Dialog>
  );
}
