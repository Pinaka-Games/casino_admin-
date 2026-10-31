"use client";

import { useEffect, useMemo, useState } from "react";

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

import type {
  PaymentProcessor,
  PaymentProcessorMethod,
  PaymentProcessorProvider,
} from "@/api/payment-processor/payment-processor.api";

const CARD_BRANDS = ["Visa", "Mastercard", "Amex", "Discover", "JCB"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PaymentProcessor | null;
  onSubmit: (payload: PaymentProcessor) => void;
}

export function PaymentProcessorDialog({
  open,
  onOpenChange,
  data,
  onSubmit,
}: Props) {
  const [formData, setFormData] = useState<PaymentProcessor | null>(null);

  useEffect(() => {
    if (data) {
      setFormData({
        ...data,
        cardBrands: Array.isArray(data.cardBrands) ? data.cardBrands : [],
        threeDSRequired: Boolean(data.threeDSRequired),
      });
    }
  }, [data, open]);

  const showCardFields = useMemo(
    () => formData?.provider === "breeze" && formData?.method === "card",
    [formData?.provider, formData?.method],
  );

  const showBankFields = useMemo(
    () =>
      formData?.provider === "breeze" && formData?.method === "bank-transfer",
    [formData?.provider, formData?.method],
  );

  if (!formData) return null;

  const update = <K extends keyof PaymentProcessor>(
    key: K,
    value: PaymentProcessor[K],
  ) => setFormData((p) => (p ? { ...p, [key]: value } : p));

  const toggleCardBrand = (brand: string) => {
    setFormData((p) => {
      if (!p) return p;
      const next = p.cardBrands.includes(brand)
        ? p.cardBrands.filter((b) => b !== brand)
        : [...p.cardBrands, brand];
      return { ...p, cardBrands: next };
    });
  };

  const handleSubmit = () => onSubmit(formData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15181E] p-6 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Edit</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {/* Gateway Name */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Gateway Name</Label>
            <Input
              value={formData.gatewayName}
              disabled
              className="bg-[#242B35] border-none text-gray-300"
            />
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Payment Provider</Label>
            <Select
              value={formData.provider}
              onValueChange={(v) =>
                update("provider", v as PaymentProcessorProvider)
              }
            >
              <SelectTrigger className="bg-[#242B35] border-none text-white">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white">
                <SelectItem value="breeze">Breeze</SelectItem>
                <SelectItem value="coinflow">Coinflow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Method */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Payment Method</Label>
            <Select
              value={formData.method}
              onValueChange={(v) =>
                update("method", v as PaymentProcessorMethod)
              }
            >
              <SelectTrigger className="bg-[#242B35] border-none text-white">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white">
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
                <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Currency</Label>
            <Select
              value={formData.currency}
              onValueChange={(v) =>
                update("currency", v as PaymentProcessor["currency"])
              }
            >
              <SelectTrigger className="bg-[#242B35] border-none text-white">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white">
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="sgd">SGD</SelectItem>
                <SelectItem value="coin">Wolf Coin</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min Deposit */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Min Deposit</Label>
            <Input
              value={formData.minDeposit}
              onChange={(e) => update("minDeposit", e.target.value)}
              className="bg-[#242B35] border-none text-white"
            />
          </div>

          {/* Max Deposit */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Max Deposit</Label>
            <Input
              value={formData.maxDeposit}
              onChange={(e) => update("maxDeposit", e.target.value)}
              className="bg-[#242B35] border-none text-white"
            />
          </div>

          {/* Min Withdraw */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Min Withdraw</Label>
            <Input
              value={formData.minWithdraw}
              onChange={(e) => update("minWithdraw", e.target.value)}
              className="bg-[#242B35] border-none text-white"
            />
          </div>

          {/* Max Withdraw */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Max Withdraw</Label>
            <Input
              value={formData.maxWithdraw}
              onChange={(e) => update("maxWithdraw", e.target.value)}
              className="bg-[#242B35] border-none text-white"
            />
          </div>

          {/* Depositable */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Depositable</Label>
            <Switch
              checked={formData.depositable}
              onCheckedChange={(c) => update("depositable", c)}
              className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
            />
          </div>

          {/* Withdrawable */}
          <div className="space-y-2">
            <Label className="text-xs text-white">Withdrawable</Label>
            <Switch
              checked={formData.withdrawable}
              onCheckedChange={(c) => update("withdrawable", c)}
              className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
            />
          </div>
        </div>

        {/* Breeze card fields */}
        {showCardFields && (
          <div className="mt-6 rounded-lg border border-[#242B35] p-4">
            <h3 className="text-sm font-medium text-white mb-3">
              Breeze · Card Details
            </h3>

            <div className="grid grid-cols-1 gap-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-white">Supported brands</Label>
                <div className="flex flex-wrap gap-2">
                  {CARD_BRANDS.map((brand) => {
                    const active = formData.cardBrands.includes(brand);
                    return (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => toggleCardBrand(brand)}
                        className={`px-3 py-1 rounded-md text-xs border ${
                          active
                            ? "bg-[#B93DEB] border-[#B93DEB] text-white"
                            : "bg-[#242B35] border-[#242B35] text-gray-300"
                        }`}
                      >
                        {brand}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-white">3DS required</Label>
                <Switch
                  checked={formData.threeDSRequired}
                  onCheckedChange={(c) => update("threeDSRequired", c)}
                  className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* Breeze bank fields */}
        {showBankFields && (
          <div className="mt-6 rounded-lg border border-[#242B35] p-4">
            <h3 className="text-sm font-medium text-white mb-3">
              Breeze · Bank Details
            </h3>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-white">Country</Label>
                <Input
                  value={formData.country ?? ""}
                  onChange={(e) => update("country", e.target.value)}
                  placeholder="MY, SG, US..."
                  className="bg-[#242B35] border-none text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white">
                  Bank account / IBAN
                </Label>
                <Input
                  value={formData.bankAccount ?? ""}
                  onChange={(e) => update("bankAccount", e.target.value)}
                  className="bg-[#242B35] border-none text-white"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label className="text-xs text-white">SWIFT / BIC</Label>
                <Input
                  value={formData.swiftCode ?? ""}
                  onChange={(e) => update("swiftCode", e.target.value)}
                  className="bg-[#242B35] border-none text-white"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6">
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
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
