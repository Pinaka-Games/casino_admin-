"use client";

import React, { useEffect } from "react";
import FilterToolbar from "@/components/filters/FilterToolbar";
import toast from "react-hot-toast";

import { BannerPackTable } from "./components/banner-pack-table";
import { BannerPackDialog } from "./components/banner-pack-dialog";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBannerPackStore } from "@/store/banner-pack-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function BannerPackPage() {
  const { bannerPacks, fetchBannerPacks, deleteBannerPack, toggleBannerPack } = useBannerPackStore();
  const [open, setOpen] = React.useState(false);
  const [editingPack, setEditingPack] = React.useState<any>(null);
  const [search, setSearch] = React.useState("");

  // Delete confirmation state
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  useEffect(() => {
    fetchBannerPacks();
  }, [fetchBannerPacks]);

  const handleEdit = (pack: any) => {
    setEditingPack(pack);
    setOpen(true);
  };

  const handleCreateNew = () => {
    setEditingPack(null);
    setOpen(true);
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await deleteBannerPack(deleteId);
      toast.success("Pack deleted successfully");
    } catch {
      toast.error("Failed to delete pack");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const packToDelete = bannerPacks.find(p => p.id === deleteId);

  const filtered = bannerPacks.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 bg-[#15181E] min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-white tracking-tight">Pack Management</h1>
        <p className="text-gray-400 text-sm">Manage downloadable assets, images, and brand materials in organized packs.</p>
      </div>

      <div className="bg-[#191D24] rounded-lg p-2">
        <FilterToolbar
          className="mb-0"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search packs..."
          showFilters={false}
          activeCount={0}
          onOpenFilters={() => {}}
          actions={
            <Button
              onClick={handleCreateNew}
              className="cursor-pointer shrink-0 bg-purple-600 hover:bg-purple-700 text-white px-6 shadow-lg shadow-purple-600/20"
            >
              Create New Pack
            </Button>
          }
        />
      </div>

      <BannerPackTable 
        packs={filtered}
        onDelete={handleDeleteRequest}
        onEdit={handleEdit}
        onToggle={(id) => toggleBannerPack(id)}
      />

      <BannerPackDialog
        open={open}
        pack={editingPack}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditingPack(null);
        }}
        onSubmit={async (data) => {
          if (editingPack) {
            await useBannerPackStore.getState().updateBannerPack(editingPack.id, data);
          } else {
            await useBannerPackStore.getState().createBannerPack(data);
          }
          setOpen(false);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <DialogContent className="bg-[#191D24] border-[#242B35] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="w-5 h-5" />
              Delete Pack
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-gray-300 text-sm">
              Are you sure you want to delete{" "}
              <span className="text-white font-semibold">"{packToDelete?.title}"</span>?
            </p>
            <p className="text-gray-500 text-xs">
              This will permanently remove the pack and all its folders and files. This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 font-semibold"
            >
              {deleting ? "Deleting..." : "Delete Pack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
