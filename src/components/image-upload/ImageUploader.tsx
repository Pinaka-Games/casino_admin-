"use client";

import { useRef, useState, forwardRef, useImperativeHandle } from "react";
import Cropper from "react-easy-crop";

/** Zoom bounds. Below 1 the whole image sits inside the crop box, which is what
 *  makes "use the entire picture" possible for a source that is not already the
 *  target ratio. */
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

/**
 * Largest file the picker accepts, checked before anything is read.
 *
 * Rejecting here rather than on upload matters: a 12MB photo is read into a
 * data URL for the cropper first, so waiting for the server to say no means the
 * browser has already parsed the whole thing — and on a slow connection the
 * operator watches a progress bar for a file that was never going to be
 * accepted.
 *
 * The crop step re-encodes to WebP, so this bounds the SOURCE, not the result.
 */
const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB

/** Converter linked from the format toasts and the "Why WebP?" explainer. */
const WEBP_CONVERTER_URL = "https://cloudconvert.com/webp-converter";

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, RotateCw, Download, Info } from "lucide-react";
import { UploadAPI } from "@/api";
import toast from "react-hot-toast";

/* ================= TYPES ================= */
export interface ImageUploaderRef {
  open: () => void;
}

interface ImageUploaderProps {
  aspect?: number;
  onChange?: (file: File) => Promise<void> | void;
  onUploadComplete?: (url: string, key: string) => void;

  folder?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;

  onlyPNG?: boolean;
  /** Allow SVG uploads. SVGs bypass the raster crop and upload as-is (vector). */
  allowSvg?: boolean;
}

/* ================= COMPONENT ================= */
const ImageUploader = forwardRef<ImageUploaderRef, ImageUploaderProps>(
  (
    {
      aspect = 1,
      onChange,
      onUploadComplete,
      folder = "uploads",
      maxWidth = 2048,
      maxHeight = 2048,
      /**
       * WebP quality. 0.82, not the 0.95 this used to be: 0.95 keeps detail no
       * one can see and costs a third more bytes for it. Re-encoding a real
       * uploaded banner measured 363KB at the old setting against 233KB here,
       * with no visible difference at the size banners are displayed. Every one
       * of the 45 upload slots inherits this, and none override it.
       *
       * Do not push it much lower — 0.75 only saved another 13KB on the same
       * image, so the curve has flattened and the next step down costs quality
       * for almost nothing.
       */
      quality = 0.82,
      onlyPNG = false,
      allowSvg = false,
    },
    ref
  ) => {
    const fileRef = useRef<HTMLInputElement>(null);

    const [open, setOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedPixels, setCroppedPixels] = useState<any>(null);
    const [progress, setProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState("image.png");

    /* ========== EXPOSE OPEN METHOD ========== */
    useImperativeHandle(ref, () => ({
      open: () => fileRef.current?.click(),
    }));

    const [infoOpen, setInfoOpen] = useState(false);

    /* ================= FILE SELECT ================= */
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return;

      const file = e.target.files[0];

      if (!file.type.startsWith("image/")) {
        toast.error("Please select a valid image file");
        return;
      }

      const isSvg = file.type === "image/svg+xml";

      /* WebP only. SVG still passes where a slot allows it — it is vector, so
         the size argument behind this rule does not apply to it. */
      if (file.type !== "image/webp" && !(allowSvg && isSvg)) {
        toast.error(
          (t) => (
            <span>
              Only <strong>WebP</strong> images are accepted
              {allowSvg ? " (or SVG)" : ""}.{" "}
              <a
                href={WEBP_CONVERTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                onClick={() => toast.dismiss(t.id)}
              >
                Convert yours here
              </a>
              .
            </span>
          ),
          { duration: 8000 },
        );
        e.target.value = "";
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(
          (t) => (
            <span>
              Image is {formatBytes(file.size)} — the limit is 1&nbsp;MB.{" "}
              <a
                href={WEBP_CONVERTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                onClick={() => toast.dismiss(t.id)}
              >
                Compress it here
              </a>
              .
            </span>
          ),
          { duration: 8000 },
        );
        e.target.value = "";
        return;
      }

      // SVG is vector — can't be raster-cropped. Upload it as-is, skipping the
      // crop dialog.
      if (allowSvg && isSvg) {
        e.target.value = "";
        void uploadDirect(file);
        return;
      }

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setOpen(true);
        setZoom(1);
        setRotation(0);
        setCrop({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);

      // Reset input value to allow selecting the same file again
      e.target.value = "";
    };

    /* ================= CROP ================= */
    const onCropComplete = (_: any, cropped: any) => {
      setCroppedPixels(cropped);
    };

    /* ================= ROTATE ================= */
    const handleRotate = () => {
      setRotation((prev) => (prev + 90) % 360);
    };

    /* ================= RESET ================= */
    const handleReset = () => {
      setZoom(1);
      setRotation(0);
      setCrop({ x: 0, y: 0 });
    };

    /* ========== DIRECT UPLOAD (SVG / no-crop) ========== */
    const uploadDirect = async (file: File) => {
      setUploading(true);
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((p) => (p >= 90 ? 90 : p + 15));
      }, 100);
      try {
        if (onUploadComplete) {
          const response = await UploadAPI.uploadSingle(file, folder);
          onUploadComplete(response.data.url, response.data.key);
          toast.success("Image uploaded successfully!");
        } else if (onChange) {
          await onChange(file);
        }
        setProgress(100);
        await new Promise((res) => setTimeout(res, 300));
      } catch (error: any) {
        console.error("Upload failed:", error);
        toast.error(error?.response?.data?.message || "Failed to upload image");
      } finally {
        clearInterval(interval);
        setUploading(false);
        setProgress(0);
      }
    };

    /* ================= SAVE ================= */
    const saveImage = async () => {
      if (!imageSrc || !croppedPixels) return;

      setUploading(true);
      setProgress(0);

      const blob = await getCroppedImg(
        imageSrc,
        croppedPixels,
        rotation,
        quality
      );
      // Name the file after what was actually encoded — S3 takes the stored
      // object's extension straight from `originalname`, so a mismatch here is
      // what produced .png URLs for WebP uploads.
      const ext = blob.type === "image/webp" ? ".webp" : ".png";
      const file = new File([blob], fileName.replace(/\.[^/.]+$/, ext), {
        type: blob.type || "image/webp",
      });

      // Smooth progress animation
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) {
            clearInterval(interval);
            return 90;
          }
          return p + 15;
        });
      }, 100);

      try {
        if (onUploadComplete) {
          const response = await UploadAPI.uploadSingle(file, folder);

          onUploadComplete(response.data.url, response.data.key);

          toast.success("Image uploaded successfully!");
        } else if (onChange) {
          await onChange(file);
        }

        setProgress(100);
        await new Promise((res) => setTimeout(res, 300));
      } catch (error: any) {
        console.error("Upload failed:", error);
        clearInterval(interval);
        toast.error(error?.response?.data?.message || "Failed to upload image");
      } finally {
        clearInterval(interval);
        setUploading(false);
        setOpen(false);
        setProgress(0);
      }
    };

    return (
      <>
        {/* Hidden Input */}
        <input
          ref={fileRef}
          type="file"
          accept={allowSvg ? "image/webp,image/svg+xml" : "image/webp"}
          hidden
          onChange={onFileChange}
        />

        {/* Why WebP — opened from the (i) beside the format rule. */}
        <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Why WebP?</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm text-gray-300">
              <p>
                WebP stores the same picture in roughly{" "}
                <strong className="text-white">25–35% less space</strong> than
                JPEG and far less than PNG, with no visible loss. Smaller files
                mean pages that paint sooner — which matters most to the players
                on the slowest connections, who are the ones most likely to
                leave.
              </p>

              <ul className="space-y-2">
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>
                    <strong className="text-white">Faster loads.</strong> Banner
                    and poster art is among the heaviest things on a page; it is
                    usually the last thing to appear.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>
                    <strong className="text-white">Transparency and
                    animation</strong> both supported, so it replaces PNG and
                    GIF as well as JPEG.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>
                    <strong className="text-white">Supported everywhere</strong>{" "}
                    — every current browser, mobile and desktop.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>
                    <strong className="text-white">Lower bandwidth cost</strong>{" "}
                    on every page view, for the platform and the player.
                  </span>
                </li>
              </ul>

              <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3">
                <p className="mb-2 text-xs text-emerald-300/90">
                  Have a PNG or JPEG? Convert it in a couple of clicks, then
                  upload the WebP here.
                </p>
                <a
                  href={WEBP_CONVERTER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                >
                  Open the converter ↗
                </a>
              </div>

              <p className="text-xs text-gray-500">
                Tip: export at the size it will actually be displayed. A 4000px
                image scaled down in the browser costs the player the full
                download either way.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Crop Dialog - Increased Width */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-5xl w-[calc(100%-1rem)] sm:w-[95vw] max-h-[92vh] overflow-y-auto scrollbar-hide p-3 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center mt-4 justify-between">
                <span>Crop & Edit Image</span>
                <span className="text-sm font-normal text-gray-500">
                  {fileName}
                </span>
              </DialogTitle>
            </DialogHeader>

            {/* Format rule, stated where the operator is already looking. The
                detail sits behind the (i) rather than in this line: the rule is
                what they need every time, the reasoning only once. */}
            <div className="-mt-2 flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300/90">
              <span aria-hidden="true">💡</span>
              <span className="flex-1">
                <strong className="font-semibold">WebP</strong> only, up to
                1&nbsp;MB.
              </span>
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                aria-label="Why WebP?"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-emerald-300/80 transition hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>

            {/* Cropper Area */}
            <div className="relative h-[46vh] min-h-[320px] sm:h-[54vh] bg-black rounded-md overflow-hidden">
              {imageSrc && (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  // The library scales the image to COVER the crop box at zoom
                  // 1 and refuses to go below it, so a source whose ratio does
                  // not match the target always lost its edges with no way to
                  // pull them back. `contain` fits the whole image in view,
                  // MIN_ZOOM lets it be shrunk further, and restrictPosition
                  // must be off or the crop box would be forced back inside the
                  // image and cancel both.
                  objectFit="contain"
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  restrictPosition={false}
                  zoomSpeed={0.15}
                />
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              {/* Zoom Control - Left Side */}
              <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto sm:gap-3">
                <ZoomIn className="w-4 h-4 text-gray-600 shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">
                  Zoom
                </span>
                <Slider
                  value={[zoom]}
                  onValueChange={(value) => setZoom(value[0])}
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.05}
                  disabled={uploading}
                  className="min-w-0 flex-1 sm:min-w-[200px]"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap min-w-10 text-right">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              {/* Rotation Control - Right Side */}
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  disabled={uploading}
                  className="flex items-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  Rotate 90°
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={uploading}
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* {rotation > 0 && (
              <div className="text-xs text-gray-500 text-right -mt-2">
                Rotated {rotation}°
              </div>
            )} */}

            {/* Progress Bar */}
            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-gray-500">
                  Uploading... {progress}%
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-2 flex flex-wrap justify-end gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={saveImage}
                disabled={uploading}
                className="bg-purple-500 text-white hover:bg-purple-600 flex items-center gap-2"
              >
                {uploading ? "Uploading..." : <>Save Image</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

ImageUploader.displayName = "ImageUploader";
export default ImageUploader;

/* ================= HELPER ================= */
async function getCroppedImg(
  imageSrc: string,
  crop: any,
  rotation: number = 0,
  quality: number = 0.95,
  mimeType: string = "image/webp"
): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((res) => (image.onload = res));

  const radians = (rotation * Math.PI) / 180;

  // Rotate first, into a canvas sized to hold the whole rotated image. Cropping
  // straight from the source with drawImage's source rectangle cannot express a
  // crop that reaches OUTSIDE the image — and zooming below 1x produces exactly
  // that, since the point of it is to include area the picture does not cover.
  // Negative source coordinates are clamped by the browser, which silently
  // shifted the result; drawing the image into a destination offset instead
  // keeps everything aligned and leaves the uncovered margin transparent.
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotatedWidth = image.width * cos + image.height * sin;
  const rotatedHeight = image.width * sin + image.height * cos;

  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = Math.max(1, Math.round(rotatedWidth));
  rotatedCanvas.height = Math.max(1, Math.round(rotatedHeight));
  const rotatedCtx = rotatedCanvas.getContext("2d")!;
  rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  rotatedCtx.rotate(radians);
  rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = Math.max(1, Math.round(crop.width));
  canvas.height = Math.max(1, Math.round(crop.height));

  ctx.drawImage(rotatedCanvas, -crop.x, -crop.y);

  // Encode in the format the picker demanded. The crop step used to hardcode
  // PNG, so a WebP source came back out as a .png — slots that require WebP
  // (banners) then rejected their own upload, and PNG is several times the size
  // for the same artwork.
  //
  // `toBlob` hands back null for a format the browser cannot encode, so fall
  // back to PNG rather than resolving an undefined blob.
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        canvas.toBlob(
          (pngBlob) =>
            pngBlob
              ? resolve(pngBlob)
              : reject(new Error("Could not encode the cropped image")),
          "image/png",
          quality
        );
      },
      mimeType,
      quality
    );
  });
}
