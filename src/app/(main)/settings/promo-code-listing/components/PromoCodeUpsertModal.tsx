"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DatePicker from "@/components/DatePicker";
import toast from "react-hot-toast";
import { PromoCode, CreatePromoCodeDto } from "@/api/promo-codes/promo-codes.api";
import { profileApi } from "@/api/users/users";
import { UserWithProfile } from "@/types/profile.type";

interface Props {
  open: boolean;
  data?: PromoCode | null;
  onClose: () => void;
  onSubmit: (data: CreatePromoCodeDto, id?: string) => Promise<void>;
}

const EMPTY_FORM: CreatePromoCodeDto & { isActive: boolean } = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: 0,
  minPurchaseAmount: 0,
  maxDiscountAmount: undefined,
  maxUsage: 100,
  maxUsagePerUser: 1,
  startDate: undefined,
  endDate: undefined,
  isActive: true,
  agent: undefined,
};

export default function PromoCodeUpsertModal({ open, data, onClose, onSubmit }: Props) {
  const isEdit = Boolean(data);

  const [form, setForm] = useState(EMPTY_FORM);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<UserWithProfile[]>([]);
  const [agentSearch, setAgentSearch] = useState("");

  useEffect(() => {
    profileApi.getAllAgents({ limit: 1000 }).then((res) => {
      setAgents(res.data.data ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (data) {
      setForm({
        code: data.code ?? "",
        description: data.description ?? "",
        discountType: data.discountType ?? "percentage",
        discountValue: data.discountValue ?? 0,
        minPurchaseAmount: data.minPurchaseAmount ?? 0,
        maxDiscountAmount: data.maxDiscountAmount ?? undefined,
        maxUsage: data.maxUsage ?? 100,
        maxUsagePerUser: data.maxUsagePerUser ?? 1,
        isActive: data.isActive ?? true,
        agent: data.agent ?? undefined,
      });
      setStartDate(data.startDate ? new Date(data.startDate) : undefined);
      setEndDate(data.endDate ? new Date(data.endDate) : undefined);
    } else {
      setForm(EMPTY_FORM);
      setStartDate(undefined);
      setEndDate(undefined);
      setAgentSearch("");
    }
  }, [data, open]);

  if (!open) return null;

  const set = (key: keyof typeof form, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      toast.error("Code is required");
      return;
    }
    if (!form.discountValue || Number(form.discountValue) <= 0) {
      toast.error("Discount value must be > 0");
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

    setSaving(true);
    try {
      const payload: CreatePromoCodeDto = {
        ...form,
        code: form.code.trim().toUpperCase(),
        discountValue: Number(form.discountValue),
        minPurchaseAmount: Number(form.minPurchaseAmount),
        maxUsage: Number(form.maxUsage),
        maxUsagePerUser: Number(form.maxUsagePerUser),
        // Explicitly send null when cleared so the backend removes the cap
        maxDiscountAmount: form.maxDiscountAmount != null && form.maxDiscountAmount !== undefined
          ? Number(form.maxDiscountAmount)
          : null,
        startDate: startDate ? startDate.toISOString() : undefined,
        endDate: endDate ? endDate.toISOString() : undefined,
        agent: form.agent || undefined,
      };

      await onSubmit(payload, data?.id);
      toast.success(isEdit ? "Promo code updated!" : "Promo code created!");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 md:p-0">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#15181E] rounded-xl p-4 md:p-6 flex flex-col relative overflow-y-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {/* Code */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Code <span className="text-red-500">*</span></Label>
            <Input
              className="bg-[#242B35] border-none text-white uppercase3"
              value={form.code}
              onChange={(e) => set("code", e.target.value.replace(/\s/g, "").toUpperCase())}
              placeholder="e.g. SAVE20"
            />
          </div>

          {/* Discount Type */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">Discount Type <span className="text-red-500">*</span></Label>
            <div className="flex gap-3">
              {(["percentage", "flat"] as const).map((type) => (
                <label
                  key={type}
                  className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border text-sm font-medium transition ${
                    form.discountType === type
                      ? "border-purple-500 bg-purple-500/20 text-purple-300"
                      : "border-gray-700 bg-[#242B35] text-gray-400 hover:border-gray-500"
                  }`}
                >
                  <input
                    type="radio"
                    className="hidden"
                    checked={form.discountType === type}
                    onChange={() => set("discountType", type)}
                  />
                  {type === "percentage" ? "% Percentage" : " Flat"}
                </label>
              ))}
            </div>
          </div>

          {/* Discount Value */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">
              Discount Value {form.discountType === "percentage" ? "(%)" : ""} <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              max={form.discountType === "percentage" ? 100 : undefined}
              className="bg-[#242B35] border-none text-white"
              value={form.discountValue}
              onChange={(e) => set("discountValue", e.target.value)}
              placeholder={form.discountType === "percentage" ? "e.g. 20 for 20%" : "e.g. 20 for $20 off"}
            />
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

          {/* Agent */}
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-white text-xs">Agent <span className="text-gray-500 text-[10px]">optional</span></Label>
            <Select
              value={form.agent ?? "none"}
              onValueChange={(val) => set("agent", val === "none" ? undefined : val)}
            >
              <SelectTrigger className="bg-[#242B35] border-none text-white w-full">
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent className="bg-[#242B35] border-gray-700 text-white max-h-60">
                <div className="px-2 py-1.5">
                  <Input
                    className="bg-[#1a2030] border-none text-white text-xs h-7"
                    placeholder="Search agent…"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <SelectItem value="none" className="text-gray-400">No Agent</SelectItem>
                {agents
                  .filter((a) => {
                    const email = (a as any).entity ?? a.email ?? a.profile?.email ?? "";
                    const q = agentSearch.toLowerCase();
                    return (
                      !q ||
                      (a.username ?? "").toLowerCase().includes(q) ||
                      email.toLowerCase().includes(q) ||
                      (a.profile?.fullName ?? "").toLowerCase().includes(q)
                    );
                  })
                  .map((a) => {
                    const email = (a as any).entity ?? a.email ?? a.profile?.email ?? "";
                    const name = a.username ?? a.profile?.fullName ?? a.id;
                    return (
                      <SelectItem key={a.id} value={a.id} className="text-white py-2 focus:bg-[#1a2030]">
                        <span className="font-medium">{name}</span>
                        {email ? (
                          <span className="text-gray-400 text-[11px] ml-1.5">• {email}</span>
                        ) : null}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
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
            <DatePicker date={startDate} onChange={setStartDate} minDate={new Date(new Date().setHours(0, 0, 0, 0))} />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <Label className="text-white text-xs">End Date <span className="text-red-500">*</span></Label>
            <DatePicker date={endDate} onChange={setEndDate} minDate={new Date(new Date().setHours(0, 0, 0, 0))} />
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
