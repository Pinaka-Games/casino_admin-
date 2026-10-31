"use client";
import { useEffect, useState, useRef } from "react";
import { useMedalStore } from "@/store/medal-store";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ImageUploader from "@/components/image-upload/ImageUploader";
import { Upload } from "lucide-react";

// Cash reward types — the only ones a wagering requirement can be attached to.
// Real cash locks as a DEPOSIT rollover, bonus cash as a BONUS rollover; both are
// driven by the same admin-set multiplier below.
const REAL_CASH_REWARD_TYPES = ["WULF_CASH", "CASH"];
const BONUS_CASH_REWARD_TYPES = ["BONUS_WULF_CASH", "BONUS"];

interface MedalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    medal?: any;
}

export function MedalDialog({ open, onOpenChange, medal }: MedalDialogProps) {
    const { createMedal, updateMedal } = useMedalStore();
    const uploaderRef = useRef<any>(null);
    const [formData, setFormData] = useState({
        key: "",
        title: "",
        description: "",
        iconUrl: "",
        rewardType: "BONUS_WULF_CASH",
        rewardValue: 0,
        requirementValue: 1,
        wageringEnabled: false,
        wageringMultiplier: 0,
        isActive: true,
    });

    // Wagering is offered for both cash currencies, never for Wulf Coin (demo
    // currency) or XP.
    const isRealCashReward = REAL_CASH_REWARD_TYPES.includes(formData.rewardType);
    const isBonusCashReward = BONUS_CASH_REWARD_TYPES.includes(formData.rewardType);
    const supportsWagering = isRealCashReward || isBonusCashReward;
    const rewardCurrencyLabel = isRealCashReward ? "Wulf Cash" : "Bonus Wulf Cash";

    useEffect(() => {
        if (medal) {
            setFormData({
                key: medal.key,
                title: medal.title,
                description: medal.description || "",
                iconUrl: medal.iconUrl || "",
                rewardType: medal.rewardType,
                rewardValue: Number(medal.rewardValue) || 0,
                requirementValue: Number(medal.rulesConfig?.target) || 1,
                wageringEnabled: !!medal.wageringEnabled,
                wageringMultiplier: Number(medal.wageringMultiplier) || 0,
                isActive: medal.isActive,
            });
        } else {
            setFormData({
                key: "",
                title: "",
                description: "",
                iconUrl: "",
                rewardType: "BONUS_WULF_CASH",
                rewardValue: 0,
                requirementValue: 1,
                wageringEnabled: false,
                wageringMultiplier: 0,
                isActive: true,
            });
        }
    }, [medal, open]);

    const handleUploadComplete = (url: string) => {
        setFormData((prev) => ({ ...prev, iconUrl: url }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Ensure numbers are properly formatted
        const submissionData = {
            ...formData,
            rewardValue: Number(formData.rewardValue),
            requirementValue: Number(formData.requirementValue),
            // Wagering only meaningful for cash rewards; force off otherwise.
            wageringEnabled: supportsWagering && formData.wageringEnabled,
            wageringMultiplier: supportsWagering && formData.wageringEnabled
                ? Number(formData.wageringMultiplier) || 0
                : 0,
        };

        const ok = medal
            ? await updateMedal(medal.id, submissionData)
            : await createMedal(submissionData);

        // Keep the dialog open on failure so the user can fix the input and retry
        // (e.g. duplicate key+target); only close when the save actually succeeded.
        if (ok) onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Capped + scrollable: stacked one per row on a phone the form is
                taller than the screen, and a centred dialog cannot scroll. */}
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{medal ? "Edit Medal" : "Add New Medal"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    {/* First Line: 3 entries */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="title" className="text-xs font-bold uppercase text-gray-400">Title</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g. Star Player"
                                className="bg-[#191D24] border-[#2d3139]"
                                required
                            />
                        </div>
                        <div className="grid gap-2 w-full">
                            <Label
                                htmlFor="key"
                                className="text-xs font-bold uppercase text-gray-400"
                            >
                                Medal Category
                            </Label>

                            <Select
                                value={formData.key}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, key: value })
                                }
                                disabled={!!medal}
                            >
                                <SelectTrigger className="w-full md:w-50 bg-[#191D24] border-[#2d3139]">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>

                                <SelectContent className="w-full bg-[#191D24] border-[#2d3139] text-white">
                                    <SelectItem value="DAILY_LOGIN">Daily Login</SelectItem>
                                    <SelectItem value="WAGER_TOTAL">Total Wagered</SelectItem>
                                    <SelectItem value="DEPOSIT_TOTAL">Total Deposits</SelectItem>
                                    <SelectItem value="WIN_BIG">Highest Single Win</SelectItem>
                                    <SelectItem value="REFERRAL">Referral Count</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2 w-full">
                            <Label htmlFor="rewardType" className="text-xs font-bold uppercase text-gray-400">Reward Type</Label>
                            <Select
                                value={formData.rewardType}
                                onValueChange={(value) => setFormData({ ...formData, rewardType: value })}
                            >
                                <SelectTrigger className="bg-[#191D24] w-full md:w-50 border-[#2d3139]">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#191D24] border-[#2d3139] text-white">
                                    <SelectItem value="BONUS_WULF_CASH">Bonus Wulf Cash</SelectItem>
                                    <SelectItem value="WULF_CASH">Wulf Cash (Real)</SelectItem>
                                    <SelectItem value="WULF_COIN">Wulf Coin</SelectItem>
                                    <SelectItem value="XP">XP Points</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Second Line: 3 entries (including Icon uploader now) */}
                    <div className="grid grid-cols-1 gap-4 items-start sm:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="rewardValue" className="text-xs font-bold uppercase text-gray-400">Reward Value</Label>
                            <Input
                                id="rewardValue"
                                type="number"
                                value={formData.rewardValue}
                                onChange={(e) => setFormData({ ...formData, rewardValue: parseFloat(e.target.value) })}
                                className="bg-[#191D24] border-[#2d3139] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="requirementValue" className="text-xs font-bold uppercase text-gray-400 whitespace-nowrap">
                                {formData.key === "DAILY_LOGIN"
                                    ? "Req. Days"
                                    : formData.key === "WAGER_TOTAL"
                                        ? "Req. Wager"
                                        : formData.key === "DEPOSIT_TOTAL"
                                            ? "Req. Deposit"
                                            : formData.key === "WIN_BIG"
                                                ? "Req. Win"
                                                : formData.key === "REFERRAL_COUNT"
                                                    ? "Req. Referrals"
                                                    : "Requirement"}
                            </Label>
                            <Input
                                id="requirementValue"
                                type="number"
                                value={formData.requirementValue}
                                onChange={(e) => setFormData({ ...formData, requirementValue: parseFloat(e.target.value) })}
                                className="bg-[#191D24] border-[#2d3139] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label
                                className="text-xs font-bold uppercase text-gray-400 cursor-pointer hover:text-purple-400 transition-colors"
                                onClick={() => uploaderRef.current?.open()}
                            >
                                Medal Icon
                            </Label>
                            <div className="h-[40px] w-full rounded-md border border-[#2d3139] flex items-center justify-between px-3 bg-[#191D24] cursor-pointer hover:border-purple-500/50 transition-all group"
                                onClick={() => uploaderRef.current?.open()}
                            >
                                <span className="text-xs text-gray-400 truncate">
                                    {formData.iconUrl ? "Icon Selected" : "Upload Icon"}
                                </span>
                                <Upload className="h-4 w-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
                            </div>
                        </div>
                    </div>

                    {/* Wagering — cash rewards only (real or bonus) */}
                    {supportsWagering && (
                        <div className="rounded-lg border border-[#2d3139] bg-[#191D24]/50 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-xs font-bold uppercase text-gray-400">
                                        Require Wagering
                                    </Label>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        Lock the {rewardCurrencyLabel} reward until the player wagers it (Reward × Multiplier).
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.wageringEnabled}
                                    onCheckedChange={(checked) =>
                                        setFormData({ ...formData, wageringEnabled: checked })
                                    }
                                    className="data-[state=checked]:bg-purple-600"
                                />
                            </div>

                            {formData.wageringEnabled && (
                                <div className="grid grid-cols-2 gap-4 items-end pt-1">
                                    <div className="grid gap-2">
                                        <Label htmlFor="wageringMultiplier" className="text-xs font-bold uppercase text-gray-400">
                                            Wagering Multiplier (×)
                                        </Label>
                                        <Input
                                            id="wageringMultiplier"
                                            type="number"
                                            min={0}
                                            step="0.1"
                                            value={formData.wageringMultiplier}
                                            onChange={(e) =>
                                                setFormData({ ...formData, wageringMultiplier: parseFloat(e.target.value) })
                                            }
                                            placeholder="e.g. 3"
                                            className="bg-[#191D24] border-[#2d3139] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </div>
                                    <p className="text-[11px] text-gray-500 pb-2">
                                        Must wager{" "}
                                        <span className="text-purple-400 font-bold">
                                            {(Number(formData.rewardValue) || 0) * (Number(formData.wageringMultiplier) || 0)}
                                        </span>{" "}
                                        to unlock {Number(formData.rewardValue) || 0} {rewardCurrencyLabel}.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Previews & Description Section */}
                    <div className="space-y-4 pt-2">
                        {formData.iconUrl && (
                            <div
                                className="flex items-center gap-3 bg-[#191D24]/50 p-2 rounded-lg border border-[#2d3139] w-fit cursor-pointer hover:border-purple-500/50 transition-all group"
                                onClick={() => uploaderRef.current?.open()}
                            >
                                <div className="h-10 w-10 rounded-md overflow-hidden bg-[#191D24] border border-[#2d3139] group-hover:border-purple-500/50 transition-all">
                                    <img src={formData.iconUrl} alt="Preview" className="h-full w-full object-cover" />
                                </div>
                                <span className="text-xs text-gray-400 group-hover:text-purple-400 transition-colors">Change Icon</span>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="description" className="text-xs font-bold uppercase text-gray-400">Description</Label>
                            <Textarea
                                id="description"
                                className="min-h-[100px] bg-[#191D24] border-[#2d3139] resize-none"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe how players can earn this achievement..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" className="w-full text-white bg-purple-600 hover:bg-purple-700">
                            {medal ? "Update Medal" : "Create Medal"}
                        </Button>
                    </DialogFooter>
                    <ImageUploader
                        ref={uploaderRef}
                        folder="medals"
                        onUploadComplete={handleUploadComplete}
                    />
                </form>
            </DialogContent>
        </Dialog>
    );
}
