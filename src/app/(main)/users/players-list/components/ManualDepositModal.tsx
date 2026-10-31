"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import { manualDepositApi } from "@/api/manual-deposit/manual-deposit.api";
import { Loader2 } from "lucide-react";

interface ManualDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  onSuccess?: () => void;
}

export default function ManualDepositModal({
  isOpen,
  onClose,
  userId,
  username,
  onSuccess,
}: ManualDepositModalProps) {
  const [option, setOption] = useState("topup");
  const [wulfCashAmount, setWulfCashAmount] = useState("");
  const [wulfCoinAmount, setWulfCoinAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [applyWagering, setApplyWagering] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleAmountChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (value === "") {
      setter("");
      return;
    }
    // Allow only positive numbers with up to 2 decimal places. There is no upper
    // bound: admins credit arbitrarily large amounts and the column is decimal(18,2).
    if (!/^\d*\.?\d{0,2}$/.test(value)) return;
    setter(value);
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("User ID is missing");
      return;
    }

    const cashAmt = parseFloat(wulfCashAmount);
    const coinAmt = parseFloat(wulfCoinAmount);
    const hasCash = !!wulfCashAmount && !isNaN(cashAmt) && cashAmt > 0;
    const hasCoin = !!wulfCoinAmount && !isNaN(coinAmt) && coinAmt > 0;

    if (!hasCash && !hasCoin) {
      toast.error("Please enter at least one valid amount");
      return;
    }

    setSubmitting(true);
    try {
      // pairId only groups two deposits submitted together. A single-currency
      // deposit must stay unpaired, otherwise the listing renders it as half of
      // a pair with a missing counterpart.
      const pairId = hasCash && hasCoin ? crypto.randomUUID() : undefined;
      const requests = [];

      if (hasCash) {
        requests.push(
          manualDepositApi.create({
            userId,
            amount: cashAmt,
            currency: "wulfCash",
            notes: notes.trim() || undefined,
            pairId,
            applyWagering,
          })
        );
      }

      if (hasCoin) {
        requests.push(
          manualDepositApi.create({
            userId,
            amount: coinAmt,
            currency: "wulfCoin",
            notes: notes.trim() || undefined,
            pairId,
            applyWagering,
          })
        );
      }

      await Promise.all(requests);
      toast.success("Manual deposit requests created (pending approval)");
      
      // Reset form
      setWulfCashAmount("");
      setWulfCoinAmount("");
      setNotes("");
      setApplyWagering(true);
      
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to create deposit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#15181E] border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Manual Deposit - {username}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Available Options */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-400">
              Available Options
            </label>
            <Select value={option} onValueChange={setOption}>
              <SelectTrigger className="bg-[#242B35] border-none text-white h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] border-gray-700 text-white">
                <SelectItem value="topup">Topup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Wulf Cash Amount */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-400">
                Wulf Cash Amount
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={wulfCashAmount}
                onChange={(e) => handleAmountChange(e.target.value, setWulfCashAmount)}
                placeholder="0.00"
                className="bg-[#242B35] border-none text-white h-11"
              />
            </div>

            {/* Wulf Coin Amount */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-400">
                Wulf Coin Amount
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={wulfCoinAmount}
                onChange={(e) => handleAmountChange(e.target.value, setWulfCoinAmount)}
                placeholder="0.00"
                className="bg-[#242B35] border-none text-white h-11"
              />
            </div>
          </div>

          <p className="text-[10px] text-gray-500 -mt-3">
            Enter Wulf Cash, Wulf Coin, or both — at least one is required.
          </p>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-400">
              Notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note..."
              className="bg-[#242B35] border-none text-white resize-none min-h-[80px]"
            />
          </div>

          {/* Apply Wagering */}
          <label className="flex items-start gap-3 bg-[#242B35] rounded-lg p-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyWagering}
              onChange={(e) => setApplyWagering(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#B93DEB]"
            />
            <span>
              <span className="block text-white text-sm font-medium">
                Apply Wagering
              </span>
              <span className="block text-gray-500 text-xs mt-0.5">
                If enabled, a rollover is created on approval (normal flow). If
                disabled, the Wulf Cash is added directly to the user&apos;s
                redeemable / available-to-withdraw balance.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#B93DEB] hover:bg-[#a32cd6] text-white px-8"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
