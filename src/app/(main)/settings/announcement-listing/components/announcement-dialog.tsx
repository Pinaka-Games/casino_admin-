"use client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@radix-ui/react-dialog";
import Image from "next/image";
import * as React from "react";
import { Announcement } from "@/types/announcement";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import { useRef } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: Announcement | null;
  onSubmit: (data: {
    title: string;
    titleEs: string;
    description: string;
    descriptionEs: string;
    imageUrl: string;
    isActive: boolean;
  }) => Promise<void> | void;
}

export function AnnouncementDialog({
  open,
  onOpenChange,
  announcement,
  onSubmit,
}: Props) {
  const isEdit = !!announcement;

  const uploaderRef = useRef<ImageUploaderRef>(null);

  const [title, setTitle] = React.useState("");
  const [titleEs, setTitleEs] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [descriptionEs, setDescriptionEs] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");

  /* ================= LOAD DATA ================= */
  React.useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setTitleEs(announcement.titleEs);
      setDescription(announcement.description);
      setDescriptionEs(announcement.descriptionEs);
      setImageUrl(announcement.imageUrl);
    } else {
      setTitle("");
      setTitleEs("");
      setDescription("");
      setDescriptionEs("");
      setImageUrl("");
    }
  }, [announcement, open]);

  /* ================= VALIDATION ================= */
  const isFormValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    titleEs.trim().length > 0 &&
    descriptionEs.trim().length > 0 &&
    imageUrl.trim().length > 0;

  /* ================= SUBMIT ================= */
  const handleSubmit = () => {
    if (!isFormValid) return;

    onSubmit({
      title,
      titleEs,
      description,
      descriptionEs,
      imageUrl,
      isActive: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[#101318] text-white">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Announcement" : "Create Announcement"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* IMAGE */}
          <div>
            <label className="text-sm text-gray-400">Image</label>

            <div className="flex items-center gap-4 mt-2">
              {imageUrl && (
                <Image
                  src={imageUrl}
                  alt="preview"
                  width={100}
                  height={70}
                  className="rounded object-cover"
                  unoptimized
                />
              )}

              <Button
                onClick={() => uploaderRef.current?.open()}
                variant="outline"
              >
                Upload Image
              </Button>
            </div>
          </div>

          {/* ENGLISH */}
          <div>
            <label className="text-sm text-gray-400">Title (English)</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="text-sm text-gray-400">
              Description (English)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* SPANISH */}
          <div>
            <label className="text-sm text-gray-400">Title (Spanish)</label>
            <Input
              value={titleEs}
              onChange={(e) => setTitleEs(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">
              Description (Spanish)
            </label>
            <Input
              value={descriptionEs}
              onChange={(e) => setDescriptionEs(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="bg-[#B93DEB] hover:bg-[#a632d1] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>

        {/* IMAGE UPLOADER */}
        <ImageUploader
          ref={uploaderRef}
          aspect={40 / 12}
          folder="announcements"
          onUploadComplete={(url) => {
            setImageUrl(url);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
