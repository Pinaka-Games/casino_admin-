"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useBannerStore } from "@/store/banner-store";
import { Banner } from "@/types/banner";
import { BannerTable } from "./components/banner-table";
import { BannerDialog } from "./components/banner-dialog";
import { DeleteBannerDialog } from "./components/delete-banner-dialog";
import { BannerTypeDialog } from "./components/banner-type-dialog";
import { BannerImageDialog } from "./components/banner-image-dialog";

export default function BannerPage() {
  const { banners, fetchBanners, createBanner, updateBanner, deleteBanner } =
    useBannerStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  // "New banner" asks which kind first; edit skips straight to the right form.
  const [typeDialogOpen, setTypeDialogOpen] = React.useState(false);
  const [imageDialogOpen, setImageDialogOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Banner | null>(null);

  React.useEffect(() => {
    fetchBanners();
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      if (selected) {
        await updateBanner(selected.id, data);
        toast.success("Banner updated");
      } else {
        await createBanner(data);
        toast.success("Banner created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Operation failed");
    }
  };

  return (
    <>
      <BannerTable
        data={banners}
        onCreate={() => {
          setSelected(null);
          setTypeDialogOpen(true);
        }}
        onEdit={(b) => {
          setSelected(b);
          // Editing opens the form that matches how the banner was built.
          if (b.bannerType === "IMAGE") setImageDialogOpen(true);
          else setDialogOpen(true);
        }}
        onDelete={(b) => {
          setSelected(b);
          setDeleteOpen(true);
        }}
      />

      <BannerTypeDialog
        open={typeDialogOpen}
        onOpenChange={setTypeDialogOpen}
        onPickContent={() => {
          setTypeDialogOpen(false);
          setSelected(null);
          setDialogOpen(true);
        }}
        onPickImage={() => {
          setTypeDialogOpen(false);
          setSelected(null);
          setImageDialogOpen(true);
        }}
      />

      <BannerImageDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        banner={selected}
        onSubmit={async (data) => {
          await handleSubmit(data);
          setImageDialogOpen(false);
        }}
      />

      <BannerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        banner={selected}
        onSubmit={handleSubmit}
      />

      <DeleteBannerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        banner={selected}
        onConfirm={async () => {
          if (!selected) return;
          try {
            await deleteBanner(selected.id);
            toast.success("Banner removed");
            setDeleteOpen(false);
          } catch {
            toast.error("Failed to remove banner");
          }
        }}
      />
    </>
  );
}
