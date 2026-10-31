"use client";

import Image from "next/image";
import { X } from "lucide-react";

interface PreviewTemplate {
  title?: string;
  contents?: string;
  imageUrl?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  template: PreviewTemplate | null;
}

/**
 * Admin-side preview of a message template — renders it exactly like the
 * user-side pop-up (text left, image right) so admins see what players will
 * get. Backdrop is blurred.
 */
export default function MessageTemplatePreviewModal({ open, onClose, template }: Props) {
  if (!open || !template) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[860px] h-[320px] overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0F131A] shadow-[0_36px_120px_-30px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#191D24] text-white/70 transition hover:border-violet-300/30 hover:bg-violet-500/20 hover:text-white"
          aria-label="Close preview"
        >
          <X size={20} />
        </button>

        {/* small "preview" tag so it's clear this is not the live pop-up */}
        <span className="absolute left-4 top-4 z-20 rounded-full bg-purple-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-300">
          Preview
        </span>

        <div className="relative z-10 flex h-full flex-col overflow-hidden bg-[#0F131A] lg:flex-row">
          {/* LEFT — text */}
          <div className="flex flex-1 flex-col justify-center gap-3 px-6 py-8 sm:px-10 lg:w-[48%] lg:px-10 lg:py-10">
            <h2 className="text-left text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
              {template.title || "Untitled"}
            </h2>
            <div className="max-w-[480px]">
              <div className="text-left text-sm leading-6 text-gray-400 sm:text-[15px] max-h-[150px] overflow-y-auto pr-1 scrollbar-hide whitespace-pre-line">
                {template.contents}
              </div>
            </div>
          </div>

          {/* RIGHT — image (inset from the edges; right gutter keeps the close
              button off the image) */}
          <div className="relative h-full flex-shrink-0 bg-[#0F131A] lg:w-[48%] p-4 pr-16">
            <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#0F131A]">
              {template.imageUrl ? (
                <Image
                  src={template.imageUrl}
                  alt={template.title || "Template"}
                  fill
                  unoptimized
                  className="object-contain object-center"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-28 w-28 rounded-[30px] border border-white/10" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
