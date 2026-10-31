"use client";

import { useEffect, useState } from "react";
import { profileApi } from "@/api/users/users";
import { format, parseISO } from "date-fns";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  Loader2, 
  History,
  AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";

export function SubAgentSettlements() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await profileApi.getSubRequests();
            setRequests(res.data);
        } catch (error) {
            console.error("Failed to fetch sub-agent requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (claimId: string) => {
        try {
            setActionLoading(claimId);
            const res = await profileApi.approvePayout(claimId);
            if (res.data.success) {
                toast.success(res.data.message || "Payout approved!");
                fetchRequests();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Approval failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (claimId: string) => {
        if (!confirm("Are you sure you want to REJECT this payout request? Funds will be returned to the sub-agent's available balance.")) return;
        
        try {
            setActionLoading(claimId);
            const res = await profileApi.rejectPayout(claimId);
            if (res.data.success) {
                toast.success(res.data.message || "Payout rejected.");
                fetchRequests();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Rejection failed");
        } finally {
            setActionLoading(null);
        }
    }

    if (loading) {
        return (
            <div className="py-20 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
                <p className="text-gray-500 font-bold uppercase text-xs">Loading Requests...</p>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="bg-[#191D24] p-16 rounded-[32px] border border-dashed border-gray-800 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-6">
                    <History size={40} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">No Pending Settlements</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                    When your sub-agents request a commission claim, they will appear here for your approval.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-600/10 text-purple-600 border border-purple-600/20">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight">Sub-Agent Claims</h3>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Attention Required: {requests.length}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {requests.map((req) => (
                    <div key={req.id} className="bg-[#191D24] border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all group p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                        <div className="flex items-center gap-3 sm:gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-purple-600/10 flex items-center justify-center border border-purple-500/20 group-hover:bg-purple-600/20 transition-colors shrink-0">
                                <User size={20} className="text-purple-500" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg leading-none mb-1 group-hover:text-purple-400 transition-colors uppercase tracking-tight">
                                    {req.subAgent.username}
                                </h4>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1">
                                    <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold">
                                        <Mail size={12} className="text-purple-600/50" />
                                        {req.subAgent.email}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold">
                                        <Clock size={12} className="text-purple-600/50" />
                                        {format(parseISO(req.createdAt), "MMM dd, HH:mm")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                            <div className="px-4 sm:px-6 py-3 bg-black/40 rounded-xl border border-white/5 flex flex-col justify-center min-w-0 sm:min-w-[140px]">
                                <span className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Amount</span>
                                <div className="flex items-center gap-2">
                                     <span className="text-xl font-bold text-green-400">
                                        +${req.amount.toFixed(2)}
                                     </span>
                                     <span className="text-[11px] text-gray-600 font-bold uppercase mt-1">WulfCash</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3">
                                <button 
                                    onClick={() => handleReject(req.id)}
                                    disabled={!!actionLoading}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-red-500/20 text-red-500 text-[11px] font-bold uppercase hover:bg-red-500/10 transition-all disabled:opacity-50"
                                >
                                    <XCircle size={16} />
                                    Reject
                                </button>
                                <button 
                                    onClick={() => handleApprove(req.id)}
                                    disabled={!!actionLoading}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-purple-600 text-white text-[11px] font-bold uppercase hover:bg-purple-700 shadow-xl shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                >
                                    {actionLoading === req.id ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <CheckCircle size={16} />
                                    )}
                                    Approve Settlement
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 rounded-xl bg-purple-600/5 border border-purple-600/10 flex items-start gap-4">
                <AlertCircle size={20} className="text-purple-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-400 leading-relaxed font-bold uppercase tracking-tight">
                    Approving a settlement will instantly deduct the frozen commission from your available balance (liability) and transfer it to the sub-agent's wallet.
                    <span className="text-purple-500 ml-1">This action cannot be reversed.</span>
                </p>
            </div>
        </div>
    );
}
