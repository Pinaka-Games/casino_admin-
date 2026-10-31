"use client";

import * as React from "react";
import toast from "react-hot-toast";

import { useAnnouncementStore } from "@/store/announcement-store";
import { Announcement } from "@/types/announcement";
import { AnnouncementTable } from "./components/announcement-table";
import { AnnouncementDialog } from "./components/announcement-dialog";
import { DeleteAnnouncementDialog } from "./components/delete-announcement-dialog";

export default function AnnouncementListPage() {
  const {
    announcements,
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  } = useAnnouncementStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Announcement | null>(null);

  React.useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleSubmit = async (data: any) => {
    try {
      if (selected) {
        await updateAnnouncement(selected.id, data);
        toast.success("Announcement updated");
      } else {
        await createAnnouncement(data);
        toast.success("Announcement created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Operation failed");
    }
  };

  return (
    <>
      <AnnouncementTable
        data={announcements}
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

      <AnnouncementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        announcement={selected}
        onSubmit={handleSubmit}
      />

      <DeleteAnnouncementDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        announcement={selected}
        onConfirm={async () => {
          if (!selected) return;
          try {
            await deleteAnnouncement(selected.id);
            toast.success("Announcement removed");
            setDeleteOpen(false);
          } catch {
            toast.error("Failed to remove announcement");
          }
        }}
      />
    </>
  );
}
