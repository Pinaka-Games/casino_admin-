"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageIcon, LayoutTemplate } from "lucide-react";

/**
 * First step of "new banner": which kind is being made.
 *
 * The two flows have almost nothing in common — one composes copy over stock
 * artwork, the other uploads four finished images — so asking up front is much
 * clearer than one form with half its fields greyed out.
 */
export function BannerTypeDialog({
  open,
  onOpenChange,
  onPickContent,
  onPickImage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickContent: () => void;
  onPickImage: () => void;
}) {
  const options = [
    {
      icon: LayoutTemplate,
      title: "Create from scratch",
      detail:
        "Upload one image and compose the title, subtitle, amount and button over it. The player app lays out the text.",
      onClick: onPickContent,
    },
    {
      icon: ImageIcon,
      title: "Add banner images",
      detail:
        "Supply finished artwork — desktop and mobile, for English and Spanish. Shown edge to edge with no text drawn over it.",
      onClick: onPickImage,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#101318] text-white w-[92vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">New banner</DialogTitle>
        </DialogHeader>

        <p className="-mt-1 text-xs text-gray-400">
          Pick how this banner is built.
        </p>

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((option) => (
            <button
              key={option.title}
              type="button"
              onClick={option.onClick}
              className="group rounded-xl border border-gray-800 bg-[#191D24] p-4 text-left transition-colors hover:border-purple-500/60 hover:bg-[#1D222B]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300">
                <option.icon size={18} />
              </span>
              <p className="mt-3 text-sm font-semibold text-white">
                {option.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                {option.detail}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
