"use client";
import { useEffect, useState } from "react";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import { useMedalStore } from "@/store/medal-store";
import { Button } from "@/components/ui/button";
import { FolderPlus } from "lucide-react";
import { MedalsTable } from "@/components/medals/medals.table";
import { MedalDialog } from "@/components/medals/medals.dialog";
import { UserAchievementsDialog } from "@/components/medals/user-achievements.dialog";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/Pagination/Pagination";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function MedalListingPage() {
    const {
        medals, fetchMedals, loading,
        stats, fetchStats, statsLoading,
        leaderboard, fetchLeaderboard, updateMedal,
        fetchUserMedals, seedMedals
    } = useMedalStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isUserMedalOpen, setIsUserMedalOpen] = useState(false);
    const [currentMedal, setCurrentMedal] = useState<any>(null);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
    const [leaderboardPage, setLeaderboardPage] = useState(1);
    // Controlled only so the Top Achievers export can sit beside the tabs.
    const [activeTab, setActiveTab] = useState("medals");
    const LEADERBOARD_PAGE_SIZE = 10;

    useEffect(() => {
        fetchMedals();
        fetchStats();
        fetchLeaderboard();
    }, [fetchMedals, fetchStats, fetchLeaderboard]);

    const handleUserClick = (user: any) => {
        setSelectedUser(user);
        fetchUserMedals(user.userId);
        setIsUserMedalOpen(true);
    };

    const handleEdit = (medal: any) => {
        setCurrentMedal(medal);
        setIsDialogOpen(true);
    };

    const handleAdd = () => {
        setCurrentMedal(null);
        setIsDialogOpen(true);
    };

    const filteredMedals = medals.filter(medal =>
        medal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        medal.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleStatusToggle = (medal: any, isActive: boolean) => {
        updateMedal(medal.id, { isActive });
    };

    const leaderboardTotalPages = Math.max(
        1,
        Math.ceil(leaderboard.length / LEADERBOARD_PAGE_SIZE)
    );
    const leaderboardRows = leaderboard.slice(
        (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE,
        leaderboardPage * LEADERBOARD_PAGE_SIZE
    );

    useEffect(() => {
        setLeaderboardPage((prev) => Math.min(prev, leaderboardTotalPages));
    }, [leaderboardTotalPages]);

    // Export covers the whole leaderboard, not the page on screen —
    // `leaderboard` is the full list and the table slices it for display.
    const leaderboardExport = (
        <ExportCSV
            data={leaderboard}
            fileName="top_achievers.csv"
            headers={["Rank", "User", "User ID", "Medals", "Achievements"]}
            mapRow={(user) => [
                leaderboard.indexOf(user) + 1,
                user.username ?? "-",
                user.userId,
                Number(user.medalCount || 0),
                user.medalTitles || "-",
            ]}
        />
    );

    return (
        <div className="flex-1 space-y-4 p-3 md:p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                {/* Stacked on a phone: the heading and both tabs ran ~540px on
                    one row, so the tabs sat off-screen behind a sideways scroll. */}
                <div className="flex flex-col items-start gap-3 overflow-x-auto scrollbar-hide md:flex-row md:items-center md:justify-between md:gap-4">
                    <h2 className="shrink-0 text-xl font-bold tracking-tight">Medals Dashboard</h2>

                    <div className="flex shrink-0 items-center gap-2">
                    <TabsList className="h-auto shrink-0 rounded-xl border border-gray-700 bg-[#151B23] p-1">
                        <TabsTrigger
                            value="medals"
                            className="h-10 rounded-lg px-3 text-sm font-semibold text-gray-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white sm:px-5 sm:text-base"
                        >
                            Medals Management
                        </TabsTrigger>
                        <TabsTrigger
                            value="leaderboard"
                            className="h-10 rounded-lg px-3 text-sm font-semibold text-gray-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white sm:px-5 sm:text-base"
                        >
                            Top Achievers
                        </TabsTrigger>
                    </TabsList>
                    {/* Beside the tabs on a phone rather than on a line of its
                        own above the table. */}
                    {activeTab === "leaderboard" && (
                        <div className="md:hidden">{leaderboardExport}</div>
                    )}
                    </div>
                </div>

                <TabsContent value="medals" className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <Card className="bg-[#191D24] border-[#2d3139] flex flex-col items-center justify-center p-2 shadow-lg">
                            <p className="text-[#8E96A1] text-xs uppercase tracking-widest font-bold ">Total Medal Claims</p>
                            <div className="text-3xl font-black text-white mb-1">{statsLoading ? "..." : stats?.totalClaims || 0}</div>
                        </Card>
                        <Card className="bg-[#191D24] border-[#2d3139] flex flex-col items-center justify-center p-2 shadow-lg">
                            <p className="text-[#8E96A1] text-xs uppercase tracking-widest font-bold ">Unique Users</p>
                            <div className="text-3xl font-black text-white mb-1">{statsLoading ? "..." : stats?.uniqueUsers || 0}</div>
                        </Card>
                        <Card className="bg-[#191D24] border-[#2d3139] flex flex-col items-center justify-center p-2 shadow-lg">
                            <p className="text-[#8E96A1] text-xs uppercase tracking-widest font-bold ">Total Rewards Paid</p>
                            <div className="text-3xl font-black text-white mb-1">{statsLoading ? "..." : stats?.totalRewardPaid?.toLocaleString() || 0}</div>
                        </Card>
                    </div>

                    <div className="bg-[#191D24] rounded-lg p-2 flex items-center gap-3 shrink-0">
                        <div className="flex-1">
                            <Input
                                placeholder="Search medals..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm pl-4"
                            />
                        </div>
                        {/* Seed Data only helps on an empty list; Create is always
                            available so a medal can be added manually too. */}
                        {medals.length === 0 && !loading && (
                            <Button
                                variant="default"
                                onClick={() => setSeedConfirmOpen(true)}
                                className="bg-purple-600 hover:bg-purple-700 text-white border-none h-10 px-4"
                            >
                                Seed Data
                            </Button>
                        )}
                        <ConfirmSeedDialog
                            open={seedConfirmOpen}
                            title="Seed default medals?"
                            description="This adds the default medal list. It only runs when there are no medals yet."
                            effects={[
                                "Default medals are created and players can start earning them",
                                "Player medal progress and claims are not touched",
                            ]}
                            onCancel={() => setSeedConfirmOpen(false)}
                            onConfirm={() => {
                                setSeedConfirmOpen(false);
                                seedMedals();
                            }}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleAdd}
                            className="bg-[#1a2030] border-gray-700 hover:bg-[#242B35]"
                            aria-label="Create medal"
                            title="Create medal"
                        >
                            <FolderPlus className="h-4 w-4 text-white" />
                        </Button>
                    </div>

                    <MedalsTable
                        data={filteredMedals}
                        loading={loading}
                        onEdit={handleEdit}
                        onStatusToggle={handleStatusToggle}
                    />
                </TabsContent>

                <TabsContent value="leaderboard" className="space-y-4">
                    {/* Desktop keeps the export on its own line here; on a
                        phone it sits beside the tabs instead (see above). */}
                    <div className="hidden justify-end md:flex">
                        {leaderboardExport}
                    </div>

                    <div className="rounded-md border border-[#2d3139] bg-[#15181E] p-2 md:p-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-[#242B35] hover:bg-[#242B35]">
                                    <TableHead className="w-[90px] text-white">Rank</TableHead>
                                    <TableHead className="text-white">User</TableHead>
                                    <TableHead className="w-[160px] text-white">Medals</TableHead>
                                    <TableHead className="text-white">Achievements</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leaderboardRows.length > 0 ? (
                                    leaderboardRows.map((user, index) => {
                                        const rank =
                                            (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE + index + 1;

                                        return (
                                            <TableRow
                                                key={user.userId}
                                                className="cursor-pointer border-[#2d3139] hover:bg-[#1f2430]"
                                                onClick={() => handleUserClick(user)}
                                            >
                                                <TableCell className="font-extrabold text-[#8E96A1]">
                                                    #{rank}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-10 w-10 rounded-full ring-1 ring-purple-500/30 bg-[#242B35]">
                                                            <AvatarImage
                                                                src={user.avatar}
                                                                alt={user.username}
                                                                className="object-cover"
                                                            />
                                                            <AvatarFallback className="bg-[#242B35] font-semibold text-[#8E96A1]">
                                                                {user.username
                                                                    ? user.username.substring(0, 2).toUpperCase()
                                                                    : "??"}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-bold text-white">
                                                            {user.username || "Anonymous"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-[#B93DEB]">
                                                    {Number(user.medalCount || 0)} Medals
                                                </TableCell>
                                                <TableCell className="max-w-[420px]">
                                                    <p className="line-clamp-1 text-xs italic text-gray-400">
                                                        {user.medalTitles || "No medals listed"}
                                                    </p>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-16 text-center text-sm text-gray-400">
                                            No top achievers yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {leaderboard.length > 0 && (
                        <Pagination
                            currentPage={leaderboardPage}
                            totalPages={leaderboardTotalPages}
                            onPageChange={setLeaderboardPage}
                        />
                    )}
                </TabsContent>
            </Tabs>

            <MedalDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                medal={currentMedal}
            />

            <UserAchievementsDialog
                open={isUserMedalOpen}
                onOpenChange={setIsUserMedalOpen}
                username={selectedUser?.username || "loading..."}
            />
        </div>
    );
}
