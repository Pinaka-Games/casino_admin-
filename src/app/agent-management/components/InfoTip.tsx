"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InfoTipProps {
  title: string;
  /** One-line subtitle under the title, like the dashboard KPI modals. */
  description?: string;
  /** Icon shown in the colored square next to the title. */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Small "i" icon that opens a centered explainer modal, styled to match the
 * dashboard KPI quick-info dialogs (icon header + definition card). Used
 * across the agent portal to explain terms (NGR, platform fees, commission
 * math) in plain language.
 */
export function InfoTip({ title, description, icon, children }: InfoTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={`About: ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className="shrink-0 cursor-pointer text-gray-600 transition-colors hover:text-white"
      >
        <Info size={12} />
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md border border-[#2A3340] bg-[#171B23] p-0 text-white max-h-[85dvh] overflow-y-auto">
          <DialogHeader className="border-b border-[#2A3340] px-6 py-4">
            <DialogTitle className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#B93DEB]/15 text-[#B93DEB]">
                {icon ?? <Info size={18} />}
              </span>
              <span className="text-lg font-bold">{title}</span>
            </DialogTitle>
            {description && (
              <DialogDescription className="text-gray-400">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="px-6 py-5">
            <div className="rounded-xl border border-white/5 bg-[#1A2027] px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                How it works
              </p>
              <div className="text-sm leading-relaxed text-gray-300 space-y-2">
                {children}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
