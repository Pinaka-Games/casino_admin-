"use client";
import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { referralAdminApi } from "@/services/referral-admin.service";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";

interface ReferralSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

export default function ReferralSettingsModal({
    open,
    onClose,
}: ReferralSettingsModalProps) {
    const [releaseValue, setReleaseValue] = useState("7");
    const [releaseUnit, setReleaseUnit] = useState<"minutes" | "hours" | "days">("days");
    const [payoutLockValue, setPayoutLockValue] = useState("45");
    const [payoutLockUnit, setPayoutLockUnit] = useState<"minutes" | "hours" | "days">("days");
    const [autoApprovalThreshold, setAutoApprovalThreshold] = useState("1000");
    const [payoutLockEnabled, setPayoutLockEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const numberInputClassName =
        "flex h-10 w-full rounded-md border border-input bg-[#242B35] px-3 py-2 text-sm text-white border-none appearance-none";
    const selectClassName =
        "flex h-10 w-full rounded-md bg-[#242B35] px-3 py-2 text-sm text-white border-none outline-none";

    const toUnitState = (seconds: number, defaultDays: number) => {
        if (!seconds || seconds <= 0) {
            return { value: String(defaultDays), unit: "days" as const };
        }
        if (seconds % 86400 === 0) {
            return { value: String(seconds / 86400), unit: "days" as const };
        }
        if (seconds % 3600 === 0) {
            return { value: String(seconds / 3600), unit: "hours" as const };
        }
        return { value: String(Math.max(1, Math.round(seconds / 60))), unit: "minutes" as const };
    };

    const toSeconds = (value: string, unit: "minutes" | "hours" | "days") => {
        const numericValue = Number(value);
        if (unit === "minutes") return numericValue * 60;
        if (unit === "hours") return numericValue * 3600;
        return numericValue * 86400;
    };

    useEffect(() => {
        if (open) {
            fetchConfig();
        }
    }, [open]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken") || "";
            const data = await referralAdminApi.getConfig(token);
            const releaseState = toUnitState(Number(data.affiliateReleaseDurationSec ?? 604800), 7);
            const payoutState = toUnitState(Number(data.payoutLockSec ?? ((data.payoutLockDays ?? 45) * 86400)), 45);
            setReleaseValue(releaseState.value);
            setReleaseUnit(releaseState.unit);
            setPayoutLockValue(payoutState.value);
            setPayoutLockUnit(payoutState.unit);
            setAutoApprovalThreshold(String(Number(data.referralPayoutAutoThreshold ?? 1000)));
            setPayoutLockEnabled(data.payoutLockEnabled !== false);
        } catch (error: any) {
            const message = error?.response?.data?.message || "Failed to fetch payout settings";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!releaseValue || !payoutLockValue || !autoApprovalThreshold) {
            toast.error("All fields are required.");
            return;
        }

        const releaseNumericValue = Number(releaseValue);
        const payoutLockNumericValue = Number(payoutLockValue);
        const autoApprovalThresholdValue = Number(autoApprovalThreshold);

        if (releaseNumericValue < 0 || payoutLockNumericValue < 0 || autoApprovalThresholdValue < 0) {
            toast.error("Please enter valid values.");
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem("accessToken") || "";
            await referralAdminApi.updateConfig(
                {
                    affiliateReleaseDurationSec: toSeconds(releaseValue, releaseUnit),
                    payoutLockSec: toSeconds(payoutLockValue, payoutLockUnit),
                    payoutLockDays: Math.max(0, Math.ceil(toSeconds(payoutLockValue, payoutLockUnit) / 86400)),
                    referralPayoutAutoThreshold: autoApprovalThresholdValue,
                    payoutLockEnabled,
                },
                token
            );
            toast.success("Payout settings updated successfully");
            onClose();
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || "Failed to update payout settings";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100%-2rem)] bg-[#191D24] text-white border-gray-800 max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Payout/Days Settings</DialogTitle>
                </DialogHeader>

                <style jsx global>{`
                    input::-webkit-outer-spin-button,
                    input::-webkit-inner-spin-button {
                        -webkit-appearance: none;
                        margin: 0;
                    }

                    input[type=number] {
                        -moz-appearance: textfield;
                    }
                `}</style>

                {loading ? (
                    <div className="py-12 flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between rounded-md bg-[#242B35] px-3 py-3">
                            <div>
                                <Label className="text-white">Enable Freeze / Lock</Label>
                                <p className="text-xs text-gray-400 mt-1">
                                    {payoutLockEnabled
                                        ? "Lock + release timers apply"
                                        : "Instant settle, no freeze, no lock"}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={payoutLockEnabled}
                                onClick={() => setPayoutLockEnabled((v) => !v)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    payoutLockEnabled ? "bg-purple-600" : "bg-gray-600"
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        payoutLockEnabled ? "translate-x-6" : "translate-x-1"
                                    }`}
                                />
                            </button>
                        </div>

                        <div className={`space-y-2 ${payoutLockEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                            <Label htmlFor="affiliateReleaseValue">Affiliate Freeze / Release</Label>
                            <div className="grid grid-cols-[1fr_110px] gap-3 sm:grid-cols-[1fr_140px]">
                                <input
                                    id="affiliateReleaseValue"
                                    type="number"
                                    min="0"
                                    value={releaseValue}
                                    onChange={(e) => setReleaseValue(e.target.value.replace(/^0+(?!$)/, ""))}
                                    className={numberInputClassName}
                                    placeholder="7"
                                />
                                <select
                                    value={releaseUnit}
                                    onChange={(e) => setReleaseUnit(e.target.value as "minutes" | "hours" | "days")}
                                    className={selectClassName}
                                >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </div>
                        </div>

                        <div className={`space-y-2 ${payoutLockEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                            <Label htmlFor="payoutLockValue">Payout Lock</Label>
                            <div className="grid grid-cols-[1fr_110px] gap-3 sm:grid-cols-[1fr_140px]">
                                <input
                                    id="payoutLockValue"
                                    type="number"
                                    min="0"
                                    value={payoutLockValue}
                                    onChange={(e) => setPayoutLockValue(e.target.value.replace(/^0+(?!$)/, ""))}
                                    className={numberInputClassName}
                                    placeholder="45"
                                />
                                <select
                                    value={payoutLockUnit}
                                    onChange={(e) => setPayoutLockUnit(e.target.value as "minutes" | "hours" | "days")}
                                    className={selectClassName}
                                >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="autoApprovalThreshold">Auto Approval Threshold</Label>
                            <input
                                id="autoApprovalThreshold"
                                type="number"
                                min="0"
                                value={autoApprovalThreshold}
                                onChange={(e) => setAutoApprovalThreshold(e.target.value.replace(/^0+(?!$)/, ""))}
                                className={numberInputClassName}
                                placeholder="1000"
                            />
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-gray-400 hover:text-white hover:bg-white/5"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
