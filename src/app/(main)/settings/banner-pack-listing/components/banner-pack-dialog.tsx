"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import ImageUploader from "@/components/image-upload/ImageUploader";
import { BannerPack } from "@/types/banner-pack";

import * as React from "react";
import { useRef } from "react";
import { ImageUploaderRef } from "@/components/image-upload/ImageUploader";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pack?: BannerPack | null;
  onSubmit: (data: any) => Promise<void> | void;
}

export function BannerPackDialog({
  open,
  onOpenChange,
  pack,
  onSubmit,
}: Props) {
  const isEdit = !!pack;

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [coverImage, setCoverImage] = React.useState("");
  const [errors, setErrors] = React.useState<{ title?: boolean; coverImage?: boolean }>({});

  const uploaderRef = useRef<ImageUploaderRef>(null);

  React.useEffect(() => {
    if (pack) {
      setTitle(pack.title);
      setDescription(pack.description);
      setCoverImage(pack.coverImage);
    } else {
      setTitle("");
      setDescription("");
      setCoverImage("");
    }
    setErrors({});
  }, [pack, open]);

  const handleSubmit = () => {
    const newErrors: { title?: boolean; coverImage?: boolean } = {};

    if (!title.trim()) {
      newErrors.title = true;
    }
    if (!coverImage) {
      newErrors.coverImage = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.title && newErrors.coverImage) {
        toast.error("Title and Cover Image are required.");
      } else if (newErrors.title) {
        toast.error("Please enter a title for the pack.");
      } else if (newErrors.coverImage) {
        toast.error("Please upload a cover image before creating the pack.");
      }
      return;
    }

    setErrors({});
    onSubmit({
      title,
      description,
      coverImage,
      isActive: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#101318] text-white">
        <DialogHeader>
          {isEdit ? "Edit Banner Pack" : "Create Banner Pack"}
        </DialogHeader>

        <div className="space-y-4">

          <div className="space-y-2">
            <label className="text-sm text-gray-400 flex items-center gap-1">
              Cover Image
              <span className="text-red-500 text-xs">*</span>
            </label>

            <div className="flex items-center gap-4">
              <div className={`relative w-40 aspect-video rounded-lg overflow-hidden border ${errors.coverImage ? 'border-red-500' : 'border-[#242B35]'} bg-[#191D24] transition-colors`}>
                {coverImage ? (
                  <img src={coverImage} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                    No Cover Image
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={() => uploaderRef.current?.open()}
                  className={`border-[#242B35] text-white hover:bg-[#242B35] ${errors.coverImage ? 'border-red-500' : ''}`}
                >
                  Upload Cover
                </Button>
                <p className="text-[10px] text-gray-500">Recommended 16:9 aspect ratio</p>
                {errors.coverImage && (
                  <p className="text-[10px] text-red-500">Cover image is required</p>
                )}
              </div>
            </div>

            <ImageUploader
              ref={uploaderRef}
              folder="banner-packs"
              aspect={16 / 9}
              onUploadComplete={(url) => {
                setCoverImage(url);
                setErrors(prev => ({ ...prev, coverImage: false }));
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 flex items-center gap-1">
              Title
              <span className="text-red-500 text-xs">*</span>
            </label>
            <Input 
              value={title} 
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) setErrors(prev => ({ ...prev, title: false }));
              }} 
              placeholder="e.g. Summer Bundle Pack"
              className={`bg-[#191D24] border-[#242B35] text-white ${errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            {errors.title && (
              <p className="text-[10px] text-red-500">Title is required</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="bg-[#191D24] border-[#242B35] text-white"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-[#242B35] pt-4">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isEdit ? "Update Pack" : "Create Pack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}