"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Upload, Trash2 } from "lucide-react";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";


export default function TestUploadPage() {
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const [imageUrl, setImageUrl] = useState("");

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Upload Test</h1>

      {/* Upload Button */}
      <Button
        variant="outline"
        className="gap-2 h-12"
        onClick={() => uploaderRef.current?.open()}
      >
        <Upload size={14} /> Choose File
      </Button>

      {/* Image Preview */}
      {imageUrl && (
        <div className="flex items-center justify-between bg-[#1F2630] p-3 rounded-md max-w-md">
          <img 
            src={imageUrl} 
            alt="Uploaded preview"
            className="w-20 h-20 object-cover rounded" 
          />
          <Trash2
            className="cursor-pointer text-gray-400 hover:text-red-400"
            onClick={() => setImageUrl("")}
          />
        </div>
      )}

      {/* Image Uploader Component */}
      <ImageUploader
        ref={uploaderRef}
        folder="test-uploads"
        onUploadComplete={(url) => {
          setImageUrl(url);
        }}
      />
      <div>
        <p>{imageUrl}</p>
      </div>
    </div>
  );
}
