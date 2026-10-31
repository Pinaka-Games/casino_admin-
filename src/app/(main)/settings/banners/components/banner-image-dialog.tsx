"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import toast from "react-hot-toast";
import { Monitor, Smartphone, Trash2 } from "lucide-react";
import { Banner } from "@/types/banner";

/**
 * Aspect ratios the crop tool enforces.
 *
 * Both match what the player app renders: 5:1.3 on desktop, 16:9 on a phone.
 * Cropping a wide desktop file down to phone width leaves the subject tiny or
 * off-frame, which is the whole reason this dialog takes two files per language
 * rather than one.
 */
const DESKTOP_ASPECT = 5 / 1.3;
// 16:9 — the shape a phone actually renders (full width against the hero's
// standard mobile height). Cropping to any other ratio here just means the app
// trims it again at render and the subject drifts out of frame.
const MOBILE_ASPECT = 16 / 9;

type Slot =
  | "imageDesktopEn"
  | "imageMobileEn"
  | "imageDesktopEs"
  | "imageMobileEs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner?: Banner | null;
  onSubmit: (data: Partial<Banner>) => void;
}

export function BannerImageDialog({
  open,
  onOpenChange,
  banner,
  onSubmit,
}: Props) {
  const isEdit = !!banner;
  const uploaderRef = React.useRef<ImageUploaderRef>(null);
  // State, not a ref: the uploader's `aspect` is derived from this, and a ref
  // change does not re-render — which is why opening Desktop right after Mobile
  // sometimes cropped square.
  const [targetSlot, setTargetSlot] = React.useState<Slot>("imageDesktopEn");

  const [tab, setTab] = React.useState<"en" | "es">("en");
  const [images, setImages] = React.useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = React.useState(1);
  const [isActive, setIsActive] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;

    if (banner) {
      setImages({
        imageDesktopEn: banner.imageDesktopEn ?? "",
        imageDesktopEnKey: banner.imageDesktopEnKey ?? "",
        imageMobileEn: banner.imageMobileEn ?? "",
        imageMobileEnKey: banner.imageMobileEnKey ?? "",
        imageDesktopEs: banner.imageDesktopEs ?? "",
        imageDesktopEsKey: banner.imageDesktopEsKey ?? "",
        imageMobileEs: banner.imageMobileEs ?? "",
        imageMobileEsKey: banner.imageMobileEsKey ?? "",
      });
      setSortOrder(banner.sortOrder ?? 1);
      setIsActive(banner.isActive ?? true);
    } else {
      setImages({});
      setSortOrder(1);
      setIsActive(true);
    }
    setTab("en");
    setError("");
  }, [open, banner]);

  const openPicker = (slot: Slot) => {
    setTargetSlot(slot);
    // Open on the next frame so the uploader has re-rendered with this slot's
    // aspect before the cropper mounts with an image.
    requestAnimationFrame(() => uploaderRef.current?.open());
  };

  const clearSlot = (slot: Slot) => {
    setImages((prev) => ({ ...prev, [slot]: "", [`${slot}Key`]: "" }));
  };

  const handleSubmit = () => {
    // Desktop is the one that cannot be substituted: mobile falls back to it,
    // but nothing falls back to mobile.
    const missing = (["imageDesktopEn", "imageDesktopEs"] as Slot[]).filter(
      (slot) => !images[slot],
    );

    if (missing.length) {
      setError(
        "Upload the desktop image for both English and Spanish — mobile falls back to it if left empty.",
      );
      setTab(missing[0].endsWith("Es") ? "es" : "en");
      return;
    }

    onSubmit({
      bannerType: "IMAGE",
      // The composed layout reads `imageUrl`; point it at the English desktop
      // file so listings, previews and any older client still show artwork.
      imageUrl: images.imageDesktopEn,
      imageKey: images.imageDesktopEnKey,
      imageDesktopEn: images.imageDesktopEn,
      imageDesktopEnKey: images.imageDesktopEnKey,
      imageMobileEn: images.imageMobileEn || images.imageDesktopEn,
      imageMobileEnKey: images.imageMobileEnKey || images.imageDesktopEnKey,
      imageDesktopEs: images.imageDesktopEs,
      imageDesktopEsKey: images.imageDesktopEsKey,
      imageMobileEs: images.imageMobileEs || images.imageDesktopEs,
      imageMobileEsKey: images.imageMobileEsKey || images.imageDesktopEsKey,
      // Image banners have no composed copy; the artwork carries the message.
      titleEn: "",
      titleEs: "",
      // The artwork is the whole message: there is no button to press and no
      // destination to configure, so the banner is display-only.
      actionType: "NAVIGATE",
      link: null,
      sortOrder,
      isActive,
    });
  };

  const slotFor = (device: "Desktop" | "Mobile") =>
    `image${device}${tab === "es" ? "Es" : "En"}` as Slot;

  const renderSlot = (device: "Desktop" | "Mobile") => {
    const slot = slotFor(device);
    const value = images[slot];
    const isDesktop = device === "Desktop";
    const Icon = isDesktop ? Monitor : Smartphone;

    return (
      <div className="rounded-xl border border-gray-800 bg-[#191D24] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-medium text-gray-200">
            <Icon size={14} className="text-purple-300" />
            {device}
            {isDesktop && <span className="text-[10px] text-red-400">required</span>}
          </span>
          <span className="text-[10px] text-gray-500">
            {isDesktop ? "5 : 1.3" : "16 : 9"}
          </span>
        </div>

        <div
          className={`relative w-full overflow-hidden rounded-lg bg-[#0F1218] ${
            isDesktop ? "aspect-[5/1.3]" : "aspect-video"
          }`}
        >
          {value ? (
            <Image src={value} alt={`${device} banner`} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-gray-600">
              No image yet
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openPicker(slot)}>
            {value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-red-400"
              onClick={() => clearSlot(slot)}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#101318] text-white w-[92vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit banner images" : "Add banner images"}
          </h2>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Finished artwork, shown full-bleed with no text over it.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={tab === "en" ? "default" : "outline"}
              className={tab === "en" ? "bg-[#B93DEB] hover:bg-[#A32ED4]" : ""}
              onClick={() => setTab("en")}
            >
              English
            </Button>
            <Button
              size="sm"
              variant={tab === "es" ? "default" : "outline"}
              className={tab === "es" ? "bg-[#B93DEB] hover:bg-[#A32ED4]" : ""}
              onClick={() => setTab("es")}
            >
              Spanish
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {renderSlot("Desktop")}
          {renderSlot("Mobile")}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="sm:w-1/2">
          <label className="mb-1 block text-xs font-medium text-gray-300">
            Display order
          </label>
          <Input
            type="number"
            min={1}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
          <p className="mt-1 text-[10px] text-gray-500">
            Lower shows first in the rotating carousel.
          </p>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-lg bg-[#191d24] px-3 py-2">
          <span className="text-sm text-gray-300">Active</span>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </label>

        <DialogFooter>
          <Button className="w-full bg-[#B93DEB]" onClick={handleSubmit}>
            {isEdit ? "Update banner" : "Create banner"}
          </Button>
        </DialogFooter>

        {/* One uploader, retargeted per slot — mounting four would mean four
            croppers competing for the same file input. */}
        <ImageUploader
          ref={uploaderRef}
          aspect={
            targetSlot.startsWith("imageMobile") ? MOBILE_ASPECT : DESKTOP_ASPECT
          }
          folder="banners"
          onUploadComplete={(url, key) => {
            const slot = targetSlot;
            setImages((prev) => ({ ...prev, [slot]: url, [`${slot}Key`]: key }));
            setError("");
            toast.success("Image uploaded");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
