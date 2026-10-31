"use client";
import { useEffect, useState } from "react";
import { useMedalStore } from "@/store/medal-store";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { MedalDialog } from "./medals.dialog";
import { MedalsTable } from "./medals.table";
import { Input } from "@/components/ui/input";

export default function MedalListingPage() {
    const { medals, fetchMedals, loading, updateMedal } = useMedalStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentMedal, setCurrentMedal] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchMedals();
    }, [fetchMedals]);

    const handleEdit = (medal: any) => {
        setCurrentMedal(medal);
        setIsDialogOpen(true);
    };

    const handleAdd = () => {
        setCurrentMedal(null);
        setIsDialogOpen(true);
    };

    const handleStatusToggle = async (medal: any, isActive: boolean) => {
        try {
            await updateMedal(medal.id, { isActive });
        } catch (error) {
            console.error("Failed to toggle status:", error);
        }
    };

    const filteredMedals = medals.filter(medal =>
        medal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        medal.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Medals Management</h2>
                <div className="flex items-center space-x-2">
                    <Button onClick={handleAdd}>
                        <Plus className="mr-2 h-4 w-4" /> Add Medal
                    </Button>
                </div>
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
            </div>

            <MedalsTable
                data={filteredMedals}
                loading={loading}
                onEdit={handleEdit}
                onStatusToggle={handleStatusToggle}
            />

            <MedalDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                medal={currentMedal}
            />
        </div>
    );
}
