"use client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2, Pencil, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AchieversDialog } from "./achievers.dialog";
import NoData from "../NoData/NoData";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMedalStore } from "@/store/medal-store";

interface MedalsTableProps {
    data: any[];
    loading: boolean;
    onEdit: (medal: any) => void;
    onStatusToggle: (medal: any, isActive: boolean) => void;
}

export function MedalsTable({
    data,
    loading,
    onEdit,
    onStatusToggle,
}: MedalsTableProps) {
    const { deleteMedal } = useMedalStore();
    const [selectedMedal, setSelectedMedal] = useState<any>(null);
    const [isAchieversOpen, setIsAchieversOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [medalToDelete, setMedalToDelete] = useState<any>(null);

    if (loading && data.length === 0) return (
        <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
    );

    const handleViewAchievers = (medal: any) => {
        setSelectedMedal(medal);
        setIsAchieversOpen(true);
    };

    const handleDeleteClick = (medal: any) => {
        setMedalToDelete(medal);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (medalToDelete) {
            await deleteMedal(medalToDelete.id);
            setIsDeleteDialogOpen(false);
            setMedalToDelete(null);
        }
    };

    return (
        <div className="rounded-md border p-2 md:p-4 bg-[#15181E]">
            <Table>
                <TableHeader>
                    <TableRow className="bg-[#242B35] hover:bg-[#242B35]">
                        <TableHead className="w-[80px] text-white">Icon</TableHead>
                        <TableHead className="text-white">Title</TableHead>
                        <TableHead className="text-white">Key</TableHead>
                        <TableHead className="text-white">Reward</TableHead>
                        <TableHead className="text-white">Claims</TableHead>
                        {/* <TableHead className="text-white">Description</TableHead> */}
                        <TableHead className="text-white">Created At</TableHead>
                        <TableHead className="text-white">Status</TableHead>
                        <TableHead className="text-right text-white">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((medal) => (
                        <TableRow key={medal.id}>
                            <TableCell>
                                <img
                                    src={medal.iconUrl}
                                    alt=""
                                    className="w-8 h-8 rounded object-contain bg-muted"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "/placeholder-medal.png";
                                    }}
                                />
                            </TableCell>
                            <TableCell className="font-medium">{medal.title}</TableCell>
                            <TableCell>{medal.key}</TableCell>
                            <TableCell>
                                <div className="flex flex-wrap items-center gap-1">
                                    <Badge variant="secondary">
                                        {medal.rewardValue} {medal.rewardType}
                                    </Badge>
                                    {/* A wagered reward pays out very differently from a
                                        free one, so the multiplier is visible without
                                        opening the medal. */}
                                    {medal.wageringEnabled && Number(medal.wageringMultiplier) > 0 && (
                                        <Badge className="bg-purple-600/20 text-purple-300 border border-purple-500/40">
                                            {Number(medal.wageringMultiplier)}x wager
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <span className="text-gray-300 font-medium">
                                    {medal.claimCount || 0}
                                </span>
                            </TableCell>
                            {/* <TableCell>
                                {medal.description}
                            </TableCell> */}
                            <TableCell>
                                {new Date(medal?.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                                <Switch
                                    key={medal.id}
                                    id={`status-${medal.id}`}
                                    checked={Boolean(medal.isActive)}
                                    className="data-[state=checked]:bg-purple-600 [&_span]:data-[state=checked]:bg-white"
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={(checked) => onStatusToggle(medal, checked)}
                                />
                            </TableCell>


                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-orange-400">
                                            <Wrench className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-[#1a2030] text-white border border-gray-700 p-2 min-w-[150px]">
                                        <DropdownMenuLabel className="text-gray-400 text-xs px-2 py-1.5">Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-gray-700 mx-1 my-1" />

                                        <DropdownMenuItem
                                            onClick={() => handleViewAchievers(medal)}
                                            className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                                        >
                                            <Eye className="mr-2 h-4 w-4" />
                                            View Achievers
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            onClick={() => onEdit(medal)}
                                            className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            onClick={() => handleDeleteClick(medal)}
                                            className="text-red-400 text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {data.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="py-10">
                                <NoData title="No medals found" />
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <AchieversDialog
                open={isAchieversOpen}
                onOpenChange={setIsAchieversOpen}
                medal={selectedMedal}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="bg-[#1a2030] text-white border-gray-700">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400">
                            This action cannot be undone. This will permanently delete the
                            medal "{medalToDelete?.title}" and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
