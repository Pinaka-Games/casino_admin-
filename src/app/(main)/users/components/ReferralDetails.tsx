"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { referralAdminApi } from "@/services/referral-admin.service";
// Date formatting helper
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
};
import {
    Mail,
    Calendar,
    User,
    Phone,
    MapPin,
    Globe,
    Wallet,
    Hash,
    Share2,
    DollarSign,
    Clock,
    CheckCircle,
    Users,
} from "lucide-react";

interface ReferralDetailsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: any | null; // Using any for now to accommodate various user structures
}

export function ReferralDetails({
    open,
    onOpenChange,
    user,
}: ReferralDetailsProps) {
    const [stats, setStats] = useState<any>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    useEffect(() => {
        if (open && user?.id) {
            fetchStats(user.id);
        } else {
            setStats(null);
        }
    }, [open, user]);

    const fetchStats = async (userId: string) => {
        setLoadingStats(true);
        try {
            const token = localStorage.getItem("accessToken") || "";
            const data = await referralAdminApi.getUserStats(userId, token);
            setStats(data);
        } catch (error) {
            console.error("Failed to load user stats", error);
        } finally {
            setLoadingStats(false);
        }
    };

    if (!user) return null;

    const profile = user.profile || {};
    const wallet = user.wallet || {};

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] bg-[#15181E] border-none text-white p-0 rounded-xl shadow-xl overflow-hidden z-50">
                {/* FIXED HEADER */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-700">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl font-semibold text-white">
                            User Details & Referral Info
                        </DialogTitle>

                        {/* USERNAME + STATUS */}
                        <div className="flex items-center gap-3">
                            <DialogDescription className="text-gray-400 text-sm uppercase font-mono">
                                {user.username || "N/A"}
                            </DialogDescription>

                            {/* <Badge
                                className={`px-2 py-0.5 text-xs font-medium ${user.isActive
                                    ? "bg-green-600 text-white"
                                    : "bg-red-600 text-white"
                                    }`}
                            >
                                {user.isActive ? "Active" : "Inactive"}
                            </Badge> */}
                        </div>
                    </DialogHeader>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-4 py-4 space-y-4 scrollbar-hide">

                    {/* STATS CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 shrink-0">

                        <Card className="bg-[#1C2027] border-none">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-gray-400">Total Earnings</p>
                                <h3 className="text-xl font-bold text-white mt-1">
                                    {loadingStats ? "..." : `${stats?.totalEarnings?.toFixed(2) || "0.00"}`}
                                </h3>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#1C2027] border-none">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-gray-400">Pending Payouts</p>
                                <h3 className="text-xl font-bold text-white mt-1">
                                    {loadingStats ? "..." : `${stats?.pendingPayouts?.toFixed(2) || "0.00"}`}
                                </h3>
                            </CardContent>
                        </Card>

                        {/* Total Claimed = actually paid out (referral_claims
                            COMPLETED), the same figure the player sees as
                            "Already Claimed". `settledAmount` is the older,
                            broader number (earnings the cron marked CLAIMED at
                            settlement time) and is kept as a sub-line — it runs
                            ahead of what the player has withdrawn. */}
                        <Card className="bg-[#1C2027] border-none">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-gray-400">Total Claimed</p>
                                <h3 className="text-xl font-bold text-white mt-1">
                                    {loadingStats ? "..." : `${stats?.totalClaimed?.toFixed(2) || "0.00"}`}
                                </h3>
                                {!loadingStats && typeof stats?.settledAmount === "number" && (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Settled: {stats.settledAmount.toFixed(2)}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-[#1C2027] border-none">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-gray-400">Total Connections</p>
                                <h3 className="text-xl font-bold text-white mt-1">
                                    {loadingStats ? "..." : stats?.totalReferralConnections || 0}
                                </h3>
                            </CardContent>
                        </Card>

                    </div>




                    {/* REFERRAL INFO CARD */}
                    <Card className="bg-[#1C2027] border-none text-white">
                        <CardHeader>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Share2 className="h-4 w-4 text-purple-400" />
                                Referral Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-[#242B35] p-3 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Referral Code</p>
                                    <p className="text-lg font-mono font-bold text-white">{user.referralCode || "N/A"}</p>
                                </div>
                                <Hash className="h-5 w-5 text-purple-500 opacity-50" />
                            </div>

                            <div className="bg-[#242B35] p-3 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Referred By</p>
                                    <p className="text-lg font-mono font-bold text-gray-300">{user.referredBy || "No one"}</p>
                                </div>
                                <User className="h-5 w-5 text-blue-500 opacity-50" />
                            </div>

                            <div className="bg-[#242B35] p-3 rounded-lg flex items-center justify-between col-span-1 md:col-span-2">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Total Referrals Implemented</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-2xl font-bold text-white">{user.referralsCount || 0}</p>
                                        <span className="text-xs text-gray-400">users joined via this code</span>
                                    </div>
                                </div>
                                <Share2 className="h-8 w-8 text-green-500 opacity-20" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* FOOTER TIMESTAMPS */}
                    <Card className="bg-[#1C2027] border-none mb-6 text-white">
                        <CardContent className="pt-4">
                            <div className="text-xs text-gray-500 space-y-1">
                                <p className="flex items-center gap-2">
                                    <span className="text-gray-400">Account Created:</span>
                                    <span className="text-gray-300">
                                        {formatDate(user.createdAt)}
                                    </span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <span className="text-gray-400">Last Updated:</span>
                                    <span className="text-gray-300">
                                        {formatDate(user.updatedAt)}
                                    </span>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
