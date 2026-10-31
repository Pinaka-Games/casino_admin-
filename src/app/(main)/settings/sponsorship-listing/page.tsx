"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { Sponsorship } from "@/types/sponsorship";
import { useSponsorshipStore } from "@/store/sponsorship-store";

import { ContentTable } from "./components/content-table";
import { ContentDialog } from "./components/content-dialog";
import { DeleteContentDialog } from "./components/delete-content-dialog";

export default function SponsorshipListPage() {
  const {
    sponsorships,
    fetchSponsorships,
    createSponsorship,
    updateSponsorship,
    deleteSponsorship,
    setSponsorshipActive,
    patchLocal,
    getById,
    loading,
  } = useSponsorshipStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Sponsorship | null>(null);

  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchSponsorships();
  }, [fetchSponsorships]);

  const handleSubmit = async (payload: any) => {
    try {
      if (selected) {
        await updateSponsorship(selected.id, payload);
        toast.success("Sponsorship updated");
      } else {
        await createSponsorship(payload);
        toast.success("Sponsorship created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Operation failed");
    }
  };

  // No blanket error toast here: every action below reports its own outcome,
  // and the store already toasts the fetch/seed failures nobody else handles.
  // Watching `error` on top of that double-toasted every failure.

  const handleToggleActive = async (item: Sponsorship, nextActive: boolean) => {
    const prev = getById(item.id);
    setTogglingId(item.id);

    // optimistic UI
    patchLocal(item.id, { isActive: nextActive });

    try {
      await setSponsorshipActive(item.id, { isActive: nextActive });
      const label = item.sectionsEn?.[0]?.heading;
      toast.success(
        `${label ? `"${label}"` : "Sponsorship"} ${
          nextActive ? "activated" : "deactivated"
        }`
      );
    } catch {
      if (prev) patchLocal(item.id, { isActive: prev.isActive });
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <ContentTable
        data={sponsorships}
        loading={loading}
        togglingId={togglingId}
        onToggleActive={handleToggleActive}
        onCreate={() => {
          setSelected(null);
          setDialogOpen(true);
        }}
        onEdit={(item) => {
          setSelected(item);
          setDialogOpen(true);
        }}
        onDelete={(item) => {
          setSelected(item);
          setDeleteOpen(true);
        }}
      />

      <ContentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        content={selected}
        onSubmit={handleSubmit}
      />

      <DeleteContentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        content={selected}
        onConfirm={async () => {
          if (!selected) return;
          try {
            await deleteSponsorship(selected.id);
            toast.success("Sponsorship deleted");
            setDeleteOpen(false);
          } catch {
            toast.error("Delete failed");
          }
        }}
      />
    </>
  );
}
