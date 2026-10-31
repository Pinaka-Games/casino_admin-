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

interface UserReferralSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

export default function UserReferralSettingsModal({
    open,
    onClose,
}: UserReferralSettingsModalProps) {
    // User referral fields
    const [perUserIncomeCap, setPerUserIncomeCap] = useState("0");

    const [autoApprovalThreshold, setAutoApprovalThreshold] = useState("1000");
    const [claimCooldownValue, setClaimCooldownValue] = useState("1");
    const [claimCooldownUnit, setClaimCooldownUnit] = useState<"minutes" | "hours" | "days">("days");

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const inputClassName =
        "flex h-10 w-full rounded-md bg-[#242B35] px-3 py-2 text-sm text-white border-none appearance-none outline-none";
    const selectClassName =
        "flex h-10 w-full rounded-md bg-[#242B35] px-3 py-2 text-sm text-white border-none outline-none";

    const toUnitState = (seconds: number, defaultDays: number) => {
        if (!seconds || seconds <= 0) return { value: String(defaultDays), unit: "days" as const };
        if (seconds % 86400 === 0) return { value: String(seconds / 86400), unit: "days" as const };
        if (seconds % 3600 === 0) return { value: String(seconds / 3600), unit: "hours" as const };
        return { value: String(Math.max(1, Math.round(seconds / 60))), unit: "minutes" as const };
    };

    const toSeconds = (value: string, unit: "minutes" | "hours" | "days") => {
        const n = Number(value);
        if (unit === "minutes") return n * 60;
        if (unit === "hours") return n * 3600;
        return n * 86400;
    };

    const toDays = (value: string, unit: "minutes" | "hours" | "days") => {
        const n = Number(value);
        if (unit === "days") return n;
        if (unit === "hours") return n / 24;
        return n / 1440;
    };

    useEffect(() => {
        if (open) fetchConfig();
    }, [open]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken") || "";
            const data = await referralAdminApi.getConfig(token);

            // User referral fields
            setPerUserIncomeCap(String(Number(data.perUserIncomeCap ?? 0)));

            setAutoApprovalThreshold(String(Number(data.referralPayoutAutoThreshold ?? 1000)));

            // Claim cooldown: use claimCooldownSec (integer seconds, no precision loss)
            const cooldownSec = Number(data.claimCooldownSec ?? 86400);
            const cooldownState = toUnitState(cooldownSec, 86400);
            setClaimCooldownValue(cooldownState.value);
            setClaimCooldownUnit(cooldownState.unit);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to fetch settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const capValue = Number(perUserIncomeCap);
        const autoThreshold = Number(autoApprovalThreshold);
        const cooldownNum = Number(claimCooldownValue);

        if (capValue < 0 || autoThreshold < 0 || cooldownNum < 1) {
            toast.error("Please enter valid values.");
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem("accessToken") || "";
            await referralAdminApi.updateConfig(
                {
                    perUserIncomeCap: capValue,
                    referralPayoutAutoThreshold: autoThreshold,
                    claimCooldownSec: toSeconds(claimCooldownValue, claimCooldownUnit),
                },
                token
            );
            toast.success("Settings updated successfully");
            onClose();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error?.message || "Failed to update settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-[#191D24] text-white border-gray-800 max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Payout/Days Settings</DialogTitle>
                </DialogHeader>

                <style jsx global>{`
                    input::-webkit-outer-spin-button,
                    input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                    input[type=number] { -moz-appearance: textfield; }
                `}</style>

                {loading ? (
                    <div className="py-12 flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">

                        <div className="space-y-2">
                            <Label>Auto Approval Threshold</Label>
                            <input
                                type="number" min="0"
                                value={autoApprovalThreshold}
                                onChange={(e) => setAutoApprovalThreshold(e.target.value.replace(/^0+(?!$)/, ""))}
                                className={inputClassName} placeholder="1000"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Claim Cooldown</Label>
                            <p className="text-xs text-gray-500">How long a user must wait before claiming again. (e.g. 7 minutes for testing, 1 day for production)</p>
                            <div className="grid grid-cols-[1fr_140px] gap-3">
                                <input
                                    type="number" min="1"
                                    value={claimCooldownValue}
                                    onChange={(e) => setClaimCooldownValue(e.target.value.replace(/^0+(?!$)/, ""))}
                                    className={inputClassName} placeholder="1"
                                />
                                <select value={claimCooldownUnit} onChange={(e) => setClaimCooldownUnit(e.target.value as any)} className={selectClassName}>
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-4">

                            <div className="space-y-2">
                                <Label>Per User Income Cap</Label>
                                <p className="text-xs text-gray-500">
                                    Max commission earned from one referral. Resets when a new referral joins. (0 = unlimited)
                                </p>
                                <input
                                    type="number" min="0"
                                    value={perUserIncomeCap}
                                    onChange={(e) => setPerUserIncomeCap(e.target.value.replace(/^0+(?!\.|$)/, ""))}
                                    className={inputClassName} placeholder="500"
                                />
                            </div>


                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-white/5">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
