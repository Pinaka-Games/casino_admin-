"use client";
import { useEffect, useState } from "react";
import { useMedalStore } from "@/store/medal-store";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Pagination from "@/components/Pagination/Pagination";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface AchieversDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    medal: any;
}

function getInitials(value?: string) {
    if (!value) return "US";
    return value.slice(0, 2).toUpperCase();
}

function formatUnlockedAt(value?: string) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return format(date, "MMM d, yyyy, h:mm a");
}

const PAGE_SIZE = 10;

export function AchieversDialog({ open, onOpenChange, medal }: AchieversDialogProps) {
    const { achievers, fetchAchievers } = useMedalStore();
    const [loading, setLoading] = useState(false);

    // Page is keyed to the medal it was chosen for, so opening another medal
    // starts on page 1 without a reset effect.
    const [pageState, setPageState] = useState<{ medalId?: string; page: number }>({ page: 1 });
    const totalPages = Math.max(1, Math.ceil(achievers.length / PAGE_SIZE));
    const requestedPage = pageState.medalId === medal?.id ? pageState.page : 1;
    // A refetch can shrink the list under the page being viewed.
    const currentPage = Math.min(requestedPage, totalPages);
    const setPage = (page: number) => setPageState({ medalId: medal?.id, page });
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pageRows = achievers.slice(pageStart, pageStart + PAGE_SIZE);

    useEffect(() => {
        if (open && medal?.id) {
            setLoading(true);
            fetchAchievers(medal.id).finally(() => setLoading(false));
        }
    }, [open, medal, fetchAchievers]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[92vw] max-w-[900px] flex-col gap-0 overflow-hidden border border-gray-700 bg-[#15181E] p-0 text-white sm:max-w-[900px]">
                <DialogHeader className="shrink-0 border-b border-gray-800 px-4 py-4 pr-12 md:px-6 md:py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <DialogTitle className="text-xl font-semibold text-white">
                                "{medal?.title || "Medal"}" unlocked medal by user 
                            </DialogTitle>
                           
                        </div>
                       
                    </div>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-5">
                    {/* Two per row on a phone: stacked one per row the four
                        tiles took most of the dialog and left the list a sliver. */}
                    <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-gray-800 bg-[#111726] px-4 py-3">
                            <p className="text-xs uppercase tracking-widest text-gray-500">Medal Key</p>
                            <p className="mt-1 truncate text-sm font-semibold text-white">
                                {medal?.key || "-"}
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-[#111726] px-4 py-3">
                            <p className="text-xs uppercase tracking-widest text-gray-500">Reward</p>
                            <p className="mt-1 truncate text-sm font-semibold text-white">
                                {medal?.rewardValue ?? 0} {medal?.rewardType || ""}
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-[#111726] px-4 py-3">
                            <p className="text-xs uppercase tracking-widest text-gray-500">Claims</p>
                            <p className="mt-1 text-sm font-semibold text-white">
                                {medal?.claimCount ?? achievers.length}
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-[#111726] px-4 py-3">
                            <p className="text-xs uppercase tracking-widest text-gray-500">Achievers</p>
                            <p className="mt-1 text-sm font-semibold text-white">
                                {achievers.length}
                            </p>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-800 bg-[#111726]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10">
                                    <TableRow className="bg-[#242B35] hover:bg-[#242B35]">
                                        <TableHead className="w-[70px] text-white">#</TableHead>
                                        <TableHead className="text-white">User</TableHead>
                                        <TableHead className="text-white">User ID</TableHead>
                                        <TableHead className="text-white">Reward</TableHead>
                                        <TableHead className="text-white">Unlocked At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center">
                                                <Loader2 className="mx-auto h-7 w-7 animate-spin text-purple-500" />
                                            </TableCell>
                                        </TableRow>
                                    ) : achievers.length > 0 ? (
                                        pageRows.map((achiever: any, index: number) => (
                                            <TableRow
                                                key={`${achiever.user_id}-${achiever.ua_unlockedAt}`}
                                                className="border-gray-800 hover:bg-[#151b2d]"
                                            >
                                                <TableCell className="text-gray-400">
                                                    {pageStart + index + 1}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 rounded-full bg-[#242B35]">
                                                            <AvatarImage src={achiever.user_avatar} />
                                                            <AvatarFallback className="bg-[#242B35] text-xs text-white">
                                                                {getInitials(achiever.user_username)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-semibold text-white">
                                                            {achiever.user_username || "Unknown"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[220px] truncate font-mono text-xs text-gray-400">
                                                    {achiever.user_id || "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="bg-[#242B35] text-white">
                                                        {medal?.rewardValue ?? 0} {medal?.rewardType || ""}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-gray-300">
                                                    {formatUnlockedAt(achiever.ua_unlockedAt)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-sm text-gray-400">
                                                No one has earned this medal yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                    </div>

                    {!loading && totalPages > 1 && (
                        <div className="mt-4 flex shrink-0 flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-xs text-gray-400">
                                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, achievers.length)} of {achievers.length}
                            </p>
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
