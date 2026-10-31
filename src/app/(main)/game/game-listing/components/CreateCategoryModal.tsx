"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAdminCategory } from "@/api/games/games";
import { toast } from "react-hot-toast";

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateCategoryModal({ open, onClose, onSuccess }: Props) {
    const [name, setName] = useState("");
    // Spanish name for players on the /es site. Blank = translated on save.
    const [nameEs, setNameEs] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) return;

        try {
            setLoading(true);
            await createAdminCategory({ name, translations: { es: nameEs.trim() } });
            toast.success("Category created successfully");
            setName("");
            setNameEs("");
            onSuccess();
            onClose();
        } catch (error) {
            toast.error("Failed to create category");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-[#1a2030] text-white border-gray-700">
                <DialogHeader>
                    <DialogTitle>Create New Category</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Category Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Popular Games"
                            className="bg-[#15181E] border-gray-600 text-white"
                        />
                    </div>
                    {/* A category created here has no entry in the player app's
                        translation files, so its Spanish name is stored with it. */}
                    <div className="grid gap-2">
                        <Label htmlFor="nameEs">Category Name (Spanish)</Label>
                        <Input
                            id="nameEs"
                            value={nameEs}
                            onChange={(e) => setNameEs(e.target.value)}
                            placeholder="Leave blank to translate automatically"
                            className="bg-[#15181E] border-gray-600 text-white"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !name.trim()}
                        className="bg-[#B93DEB] hover:bg-[#a32cd4]"
                    >
                        {loading ? "Creating..." : "Create Category"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
