"use client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useMedalStore } from "@/store/medal-store";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface UserAchievementsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    username: string;
}

export function UserAchievementsDialog({ open, onOpenChange, username }: UserAchievementsDialogProps) {
    const { userMedals, userMedalsLoading } = useMedalStore();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-[#191D24] border-[#2d3139] text-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        Achievements: <span className="text-purple-400">{username}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    {userMedalsLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                            <p>Loading achievements...</p>
                        </div>
                    ) : userMedals.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic">
                            No medals earned yet.
                        </div>
                    ) : (
                        <div className="rounded-lg border border-[#2d3139] overflow-x-auto">
                            <table className="w-full min-w-[520px] text-sm">
                                <thead className="bg-[#242B35] text-[#8E96A1] font-bold uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Medal</th>
                                        <th className="px-4 py-3 text-left">Unlocked At</th>
                                        <th className="px-4 py-3 text-left">Reward</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2d3139]">
                                    {userMedals.map((achievement) => (
                                        <tr key={achievement.id} className="hover:bg-[#1f2430] transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded bg-[#191D24] border border-[#2d3139] overflow-hidden flex-shrink-0">
                                                        <img
                                                            src={achievement.medal?.iconUrl || "/medal-placeholder.png"}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                    <span className="font-semibold">{achievement.medal?.title}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-gray-400">
                                                {format(new Date(achievement.unlockedAt), "MMM dd, yyyy HH:mm")}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-green-400 font-bold">
                                                        +{achievement.medal?.rewardValue}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 uppercase">
                                                        {achievement.medal?.rewardType?.replace(/_/g, " ")}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {achievement.rewardClaimed ? (
                                                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                                        Claimed
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                                                        Pending
                                                    </Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
