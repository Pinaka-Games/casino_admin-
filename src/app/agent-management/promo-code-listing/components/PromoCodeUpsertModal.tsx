"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import DatePicker from "@/components/DatePicker";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { PromoCode, CreatePromoCodeDto } from "@/api/promo-codes/promo-codes-agent.api";

interface Props {
  open: boolean;
  data?: PromoCode | null;
  promoDiscountRule?: {
    minPurchase: number;
    maxPurchase: number;
    maxPercent: number;
  } | null;
  packageDateRange?: {
    startsAt: Date | null;
    endsAt: Date | null;
  };
  onClose: () => void;
  onSubmit: (data: CreatePromoCodeDto, id?: string) => Promise<void>;
}

const EMPTY_FORM: CreatePromoCodeDto & { isActive: boolean } = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: 0,
  minPurchaseAmount: 0,
  maxPurchaseAmount: undefined,
  maxDiscountAmount: undefined,
  maxUsage: 100,
  maxUsagePerUser: 1,
  startDate: undefined,
  endDate: undefined,
  isActive: true,
};

export default function PromoCodeUpsertModal({
  open,
  data,
  promoDiscountRule,
  packageDateRange,
  onClose,
  onSubmit,
}: Props) {
  const isEdit = Boolean(data);

  const [form, setForm] = useState(EMPTY_FORM);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [discountLimitError, setDiscountLimitError] = useState("");
  const lastDiscountErrorRef = useRef("");

  useEffect(() => {
    if (data) {
      setForm({
        code: data.code ?? "",
        description: data.description ?? "",
        discountType: data.discountType ?? "percentage",
        discountValue: data.discountValue ?? 0,
        minPurchaseAmount: data.minPurchaseAmount ?? 0,
        maxPurchaseAmount: data.maxPurchaseAmount ?? undefined,
        maxDiscountAmount: data.maxDiscountAmount ?? undefined,
        maxUsage: data.maxUsage ?? 100,
        maxUsagePerUser: data.maxUsagePerUser ?? 1,
        isActive: data.isActive ?? true,
      });
      setStartDate(data.startDate ? new Date(data.startDate) : undefined);
      setEndDate(data.endDate ? new Date(data.endDate) : undefined);
    } else {
      setForm(EMPTY_FORM);
      const today = new Date();
      let defaultStart = today;
      if (packageDateRange?.startsAt && today < packageDateRange.startsAt) {
        defaultStart = packageDateRange.startsAt;
      }
      setStartDate(defaultStart);
      setEndDate(undefined);
    }
  }, [data, open]);

  if (!open) return null;

  // Numeric fields legitimately hold raw input strings until handleSubmit
  // coerces them with Number(); a strict generic here would reject that.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (key: keyof typeof form, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const getDiscountErrorMessage = (
    discountType: "percentage" | "flat",
    discountValue: number | string,
  ): string => {
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) return "";
    if (discountType !== "percentage") return "";
    if (value > 100) return "Percentage discount cannot exceed 100%";
    if ((promoDiscountRule?.maxPercent ?? 0) > 0 && value > Number(promoDiscountRule?.maxPercent)) {
      return `Your plan allows maximum ${promoDiscountRule?.maxPercent}% discount`;
    }
    return "";
  };

  const validateDiscountLive = (
    nextDiscountType: "percentage" | "flat",
    nextDiscountValue: number | string,
  ) => {
    const message = getDiscountErrorMessage(nextDiscountType, nextDiscountValue);
    setDiscountLimitError(message);
    if (message && message !== lastDiscountErrorRef.current) {
      toast.error(message);
    }
    lastDiscountErrorRef.current = message;
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      toast.error("Code is required");
      return;
    }
    if (!form.discountValue || Number(form.discountValue) <= 0) {
      toast.error("Discount value must be > 0");
      return;
    }
    const discountError = getDiscountErrorMessage(form.discountType ?? "percentage", form.discountValue);
    if (discountError) {
      toast.error(discountError);
      return;
    }
    if (!startDate) {
      toast.error("Start Date is required");
      return;
    }
    if (!endDate) {
      toast.error("End Date is required");
      return;
    }
    // A day picked from the calendar is midnight, so "today" can land just
    // before a package that started later in the day. Clamp rather than block —
    // the API does the same, since a promo can't be live before its package.
    const effectiveStartDate =
      packageDateRange?.startsAt && startDate < packageDateRange.startsAt
        ? packageDateRange.startsAt
        : startDate;

    if (packageDateRange?.endsAt && effectiveStartDate > packageDateRange.endsAt) {
      toast.error("Start Date cannot be after your package expiry date");
      return;
    }
    if (packageDateRange?.startsAt && endDate < packageDateRange.startsAt) {
      toast.error("End Date cannot be before your package start date");
      return;
    }
    if (packageDateRange?.endsAt && endDate > packageDateRange.endsAt) {
      toast.error("End Date cannot be after your package expiry date");
      return;
    }
    if (endDate < effectiveStartDate) {
      toast.error("End Date cannot be before Start Date");
      return;
    }

    setSaving(true);
    try {
      const payload: CreatePromoCodeDto = {
        ...form,
        code: form.code.trim().toUpperCase(),
        discountValue: Number(form.discountValue),
        minPurchaseAmount: Number(form.minPurchaseAmount),
        maxPurchaseAmount:
          form.maxPurchaseAmount != null && form.maxPurchaseAmount !== undefined
            ? Number(form.maxPurchaseAmount)
            : null,
        maxUsage: Number(form.maxUsage),
        maxUsagePerUser: Number(form.maxUsagePerUser),
        // Explicitly send null when cleared so the backend removes the cap
        maxDiscountAmount: form.maxDiscountAmount != null && form.maxDiscountAmount !== undefined
          ? Number(form.maxDiscountAmount)
          : null,
        startDate: effectiveStartDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : undefined,
      };

      await onSubmit(payload, data?.id);
      toast.success(isEdit ? "Promo code updated!" : "Promo code created!");
      onClose();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92dvh] bg-[#15181E] rounded-xl p-4 sm:p-6 flex flex-col relative overflow-y-auto scrollbar-hide">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-medium">
            {isEdit ? "Edit Promo Code" : "Create Promo Code"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* BODY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-6 gap-y-4 sm:gap-y-5">
          {/* Code */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Code <span className="text-red-500">*</span></Label>
            <Input
              className="bg-[#242B35] border-none text-white uppercase3"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="e.g. SAVE20"
            />
          </div>

          {/* Discount Value */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">
              Discount Value {form.discountType === "percentage" ? "(%)" : ""} <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              max={
                form.discountType === "percentage"
                  ? Math.min(
                      100,
                      (promoDiscountRule?.maxPercent ?? 0) > 0
                        ? Number(promoDiscountRule?.maxPercent)
                        : 100,
                    )
                  : undefined
              }
              className="bg-[#242B35] border-none text-white"
              value={form.discountValue}
              onChange={(e) => {
                set("discountValue", e.target.value);
                validateDiscountLive(form.discountType ?? "percentage", e.target.value);
              }}
              placeholder={form.discountType === "percentage" ? "e.g. 20 for 20%" : "e.g. 20 for $20 off"}
            />
            {discountLimitError && (
              <p className="text-[10px] text-red-400">{discountLimitError}</p>
            )}
            {form.discountType === "percentage" &&
              (promoDiscountRule?.maxPercent ?? 0) > 0 &&
              (promoDiscountRule?.minPurchase ?? 0) > 0 &&
              (promoDiscountRule?.maxPurchase ?? 0) > 0 && (
                <p className="text-[10px] text-purple-300">
                  Discount slab: {promoDiscountRule?.minPurchase} to {promoDiscountRule?.maxPurchase} = {promoDiscountRule?.maxPercent}%
                </p>
              )}
          </div>

          {/* Min Purchase */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Min Purchase Amount</Label>
            <Input
              type="number"
              min={0}
              className="bg-[#242B35] border-none text-white"
              value={form.minPurchaseAmount}
              onChange={(e) => set("minPurchaseAmount", e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Max Purchase */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Max Purchase Amount <span className="text-gray-500 text-[10px]">optional</span></Label>
            <Input
              type="number"
              min={0}
              className="bg-[#242B35] border-none text-white"
              value={form.maxPurchaseAmount ?? ""}
              onChange={(e) =>
                set("maxPurchaseAmount", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="No upper limit"
            />
          </div>

          {/* Max Discount Cap */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Max Discount Amount <span className="text-gray-500 text-[10px]">optional</span></Label>
            <Input
              type="number"
              min={0}
              className="bg-[#242B35] border-none text-white"
              value={form.maxDiscountAmount ?? ""}
              onChange={(e) =>
                set("maxDiscountAmount", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="No cap"
            />
          </div>

          {/* Max Usage */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Max Total Usage <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min={1}
              className="bg-[#242B35] border-none text-white"
              value={form.maxUsage}
              onChange={(e) => set("maxUsage", e.target.value)}
            />
          </div>

          {/* Max Usage Per User */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Max Usage Per User <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min={1}
              className="bg-[#242B35] border-none text-white"
              value={form.maxUsagePerUser}
              onChange={(e) => set("maxUsagePerUser", e.target.value)}
            />
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Start Date <span className="text-red-500">*</span></Label>
            <DatePicker
              date={startDate}
              onChange={setStartDate}
              minDate={packageDateRange?.startsAt ?? undefined}
              maxDate={packageDateRange?.endsAt ?? undefined}
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">End Date <span className="text-red-500">*</span></Label>
            <DatePicker
              date={endDate}
              onChange={setEndDate}
              minDate={
                startDate && packageDateRange?.startsAt
                  ? new Date(Math.max(startDate.getTime(), packageDateRange.startsAt.getTime()))
                  : startDate ?? packageDateRange?.startsAt ?? undefined
              }
              maxDate={packageDateRange?.endsAt ?? undefined}
            />
            {packageDateRange?.startsAt && packageDateRange?.endsAt && (
              <p className="text-[10px] text-gray-400">
                Allowed window: {packageDateRange.startsAt.toLocaleDateString()} to {packageDateRange.endsAt.toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-white text-xs">Description</Label>
            <Input
              className="bg-[#242B35] border-none text-white"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short description shown to users"
            />
          </div>

          {/* Is Active */}
          <div className="md:col-span-2 flex items-center gap-3">
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => set("isActive", checked)}
              className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
            />
            <Label className="text-white text-xs font-normal">
              {form.isActive ? "Active" : "Inactive"}
            </Label>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            className="border-gray-600 text-white"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-purple-500 text-white hover:bg-purple-600"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
