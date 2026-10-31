"use client";

import { useEffect } from "react";
import CashBundleHeader from "./components/CashBundleHeader";
import CashBundleGrid from "./components/CashBundleGrid";
import { CashBundle } from "@/types/cashbundletypes";
import { DeleteBundleDialog } from "./components/DeleteBundleModal";
import AddEditBundleDialog from "./components/AddEditBundleModal";
import { useCashBundleStore } from "@/store/cashbundle-store";
import { useFreeSpinWiringsStore } from "@/store/free-spin-wirings-store";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function Page() {
  const { bundles, isLoading, fetchBundles, createBundle, updateBundle, restartDiscount, deleteBundle, reorderBundles, toggleActive } = useCashBundleStore();

  const [editItem, setEditItem] = useState<CashBundle | null>(null);
  const [deleteItem, setDeleteItem] = useState<CashBundle | null>(null);
  const [openAddEdit, setOpenAddEdit] = useState(false);

  useEffect(() => {
    fetchBundles();
  }, [fetchBundles]);

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      <CashBundleHeader
        onAdd={() => {
          setEditItem(null);
          setOpenAddEdit(true);
        }}
      />

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
          </div>
        ) : (
          <CashBundleGrid
            data={bundles}
            onEdit={(item) => {
              setEditItem(item);
              setOpenAddEdit(true);
            }}
            onDelete={setDeleteItem}
            onToggleActive={(item, isActive) => {
              toggleActive(item.id, isActive).catch(() => {});
            }}
            // Store applies the new order optimistically and reverts + toasts on
            // failure, so nothing extra is needed here.
            onReorder={(ordered) => {
              reorderBundles(ordered).catch(() => {});
            }}
          />
        )}
      </div>

      {/* ✅ ADD / EDIT DIALOG */}
      <AddEditBundleDialog
        open={openAddEdit}
        initialData={editItem}
        // A new bundle lands at the end; position is changed by dragging.
        nextDisplayOrder={bundles.length + 1}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
          setOpenAddEdit(open);
        }}
        onSubmit={async (bundle) => {
          // ✅ EDIT MODE -> UPDATE
          if (editItem?.id) {
            await updateBundle(editItem.id, bundle);
          } else {
            // ✅ ADD MODE -> CREATE
            await createBundle(bundle);
          }
          // A bundle can wire a free-spin template, so refresh the shared
          // wirings cache — otherwise the template table's "Wired As" badge and
          // the picker's in-use filter stay stale until a reload.
          void useFreeSpinWiringsStore.getState().loadWirings(true);

          // Modal close and success message are now handled in AddEditBundleDialog
          setOpenAddEdit(false);
          setEditItem(null);
        }}
        onRestartSale={async (id) => {
          await restartDiscount(id);
          setOpenAddEdit(false);
          setEditItem(null);
        }}
      />

      {/* ✅ DELETE DIALOG */}
      <DeleteBundleDialog
        open={Boolean(deleteItem)}
        bundle={deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={async () => {
          try {
            if (!deleteItem?.id) return;
            await deleteBundle(deleteItem.id);
            setDeleteItem(null);
          } catch (e) {
            // Error already handled by store
          }
        }}
      />
    </div>
  );
}
