"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Field reference for the banner form.
 *
 * Every field here maps to a specific line of the hero banner on the player
 * site, and which line is which is not obvious from the input names alone —
 * "One Line Text" and "Subtitle" both read like a second heading. Spelling out
 * where each one lands is what stops banners going live with the amount in the
 * subtitle slot.
 */
const FIELD_HELP: { field: string; where: string; detail: string }[] = [
  {
    field: "Image",
    where: "Right side of the banner",
    detail:
      "WebP only (max 1 MB), 17:10. Sits behind the text on desktop and fills the right half — keep the focal point away from the left edge or the copy will cover it.",
  },
  {
    field: "Title",
    where: "Largest line, top",
    detail: "The headline, e.g. “Stay Untamed”. Max 50 characters.",
  },
  {
    field: "Subtitle",
    where: "Directly under the title",
    detail:
      "Second line at a smaller size, e.g. “Sign Up & Get Up to”. Optional. Max 50 characters.",
  },
  {
    field: "One Line Text",
    where: "Purple accent line",
    detail:
      "Short tagline under the subtitle, shown in the brand purple. Optional. Max 50 characters.",
  },
  {
    field: "Amount",
    where: "Purple figure",
    detail:
      "The number itself, e.g. “20,000.00”. Leave blank for banners that aren't about a value.",
  },
  {
    field: "Suffix",
    where: "Beside the amount",
    detail: "Trailing words for the amount, e.g. “in Casino”.",
  },
  {
    field: "Button Text",
    where: "Call-to-action button",
    detail: "e.g. “Claim Now”. Two or three words. Max 50 characters.",
  },
  {
    field: "Button Action",
    where: "What the button does",
    detail:
      "Go to a page, open sign-up or login, open the daily streak or bundle sale popup, or sign-up with a referral code prefilled. Only “Go to a page” uses the Destination field.",
  },
  {
    field: "Referral Code",
    where: "Referral sign-up only",
    detail:
      "The code prefilled into the sign-up form when the player taps the button, so they never have to type it.",
  },
  {
    field: "Destination",
    where: "Go to a page only",
    detail:
      "Where the button sends the player. Pick a page from the live player menu or the profile tabs, or choose “Custom link” to type any path (e.g. /en/promotions) or full URL.",
  },
  {
    field: "Display Order",
    where: "Carousel position",
    detail: "Lower numbers show first. Banners rotate every 2 seconds.",
  },
  {
    field: "Active",
    where: "Visibility",
    detail:
      "Off hides the banner from the player site immediately. With no active banners, the site shows a default welcome banner.",
  },
  {
    field: "English / Spanish",
    where: "Both tabs",
    detail:
      "Each language is stored separately and the player sees the one matching their site language. Fill both — an empty Spanish tab shows blank text to Spanish players.",
  },
];

export function BannerInfoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15181E] text-white w-[92vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Banner fields explained</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-gray-400 -mt-2">
          Where each field lands on the home page hero banner.
        </p>

        {/* Two columns: the list is 12 short entries, so a single
            column made the modal a long scroll for no reason. */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELD_HELP.map((row) => (
            <div
              key={row.field}
              className="rounded-lg border border-gray-800 bg-[#191D24] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">{row.field}</span>
                <span className="shrink-0 rounded border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
                  {row.where}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                {row.detail}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
