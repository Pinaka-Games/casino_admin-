"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface InfoSection {
  heading: string;
  /** Optional sentence under the heading, before the items. */
  intro?: string;
  items: React.ReactNode[];
}

interface InfoButtonProps {
  /** Dialog title. Also the button's accessible name. */
  title: string;
  description?: string;
  sections: InfoSection[];
  /** Text beside the icon. Icon-only when omitted. */
  label?: string;
  className?: string;
}

/**
 * An "i" button that opens a read-only explanation.
 *
 * For screens whose behaviour is only partly visible in their own controls —
 * where some of what happens is fixed in code and some is configured on the
 * page — so an operator can see every rule in one place instead of inferring
 * the fixed half from what the form happens not to offer.
 *
 * Painted with the admin's hex palette rather than shadcn's semantic tokens,
 * which this app's dark theme leaves as generic greys.
 */
export default function InfoButton({
  title,
  description,
  sections,
  label,
  className = "",
}: InfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={label ? "default" : "icon"}
        aria-label={title}
        title={title}
        onClick={() => setOpen(true)}
        className={`gap-2 border-[#2F3743] bg-[#242B35] text-white/80 hover:bg-[#2C3441] hover:text-white ${className}`}
      >
        <Info className="h-4 w-4 text-[#C05CFF]" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-[#242B35] bg-[#191D24] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Info className="h-5 w-5 text-[#C05CFF]" /> {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-white/55">{description}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {sections.map((section) => (
              <section
                key={section.heading}
                className="rounded-lg border border-[#2F3743] bg-[#242B35] p-4"
              >
                <h3 className="text-sm font-semibold text-white">{section.heading}</h3>
                {section.intro && (
                  <p className="mt-1 text-xs text-white/45">{section.intro}</p>
                )}
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/80 marker:text-[#C05CFF]">
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
