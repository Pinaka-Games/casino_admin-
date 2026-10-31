"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Banner } from "@/types/banner";

/**
 * Renders a banner the way the player site's hero does, so an operator can
 * check the result before it goes live instead of saving and reloading the
 * front end to find the title wrapping or the art covering the copy.
 *
 * Deliberately mirrors HeroSection's layout on the player app: text column on
 * the left (~46%), artwork anchored right (~55%), dark gradient over the left
 * portion. Kept as a plain copy rather than a shared component because the two
 * apps do not share a component library — if the hero changes materially, this
 * needs the same edit.
 */
export function BannerPreviewDialog({
  open,
  onOpenChange,
  banner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner?: Banner | null;
}) {
  const [lang, setLang] = React.useState<"en" | "es">("en");
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");

  React.useEffect(() => {
    if (open) {
      setLang("en");
      setDevice("desktop");
    }
  }, [open]);

  if (!banner) return null;

  const isEn = lang === "en";
  const title = (isEn ? banner.titleEn : banner.titleEs) || "";
  const subtitle = (isEn ? banner.subtitleEn : banner.subtitleEs) || "";
  const oneLine = (isEn ? banner.oneLineEn : banner.oneLineEs) || "";
  const amount = (isEn ? banner.amountEn : banner.amountEs) || "";
  const suffix = (isEn ? banner.amountSuffixEn : banner.amountSuffixEs) || "";
  const buttonText = (isEn ? banner.buttonTextEn : banner.buttonTextEs) || "";

  const missing = !title && !subtitle && !oneLine;

  const isImageBanner = banner.bannerType === "IMAGE";
  const imageSrc = isEn
    ? device === "desktop"
      ? banner.imageDesktopEn || banner.imageUrl
      : banner.imageMobileEn || banner.imageDesktopEn || banner.imageUrl
    : device === "desktop"
      ? banner.imageDesktopEs || banner.imageUrl
      : banner.imageMobileEs || banner.imageDesktopEs || banner.imageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15181E] text-white w-[92vw] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-base">Banner preview</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 -mt-1">
          <Button
            size="sm"
            variant={isEn ? "default" : "outline"}
            className={isEn ? "bg-[#B93DEB] hover:bg-[#A32ED4]" : ""}
            onClick={() => setLang("en")}
          >
            English
          </Button>
          <Button
            size="sm"
            variant={!isEn ? "default" : "outline"}
            className={!isEn ? "bg-[#B93DEB] hover:bg-[#A32ED4]" : ""}
            onClick={() => setLang("es")}
          >
            Spanish
          </Button>
          <span className="ml-auto text-[11px] text-gray-500">
            Approximate — actual size varies with the player&apos;s screen
          </span>
        </div>

        {/* IMAGE-ONLY BANNER — the artwork is the banner, so preview it as the
            player sees it: nothing drawn over it, and per device because the
            two files are cropped differently. */}
        {isImageBanner ? (
          <>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={device === "desktop" ? "default" : "outline"}
                className={device === "desktop" ? "bg-[#B93DEB] hover:bg-[#A32ED4]" : ""}
                onClick={() => setDevice("desktop")}
              >
                Desktop
              </Button>
              <Button
                size="sm"
                variant={device === "mobile" ? "default" : "outline"}
                className={device === "mobile" ? "bg-[#B93DEB] hover:bg-[#A32ED4]" : ""}
                onClick={() => setDevice("mobile")}
              >
                Mobile
              </Button>
            </div>

            <div
              className={`mx-auto w-full overflow-hidden rounded-lg bg-[#0F131A] ${
                device === "desktop" ? "aspect-[5/1.3]" : "max-w-[420px] aspect-video"
              }`}
            >
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-500">
                  No {device} image for {isEn ? "English" : "Spanish"}
                </div>
              )}
            </div>
          </>
        ) : (
        <>
        {/* HERO — mirrors the player home page banner */}
        <div className="relative w-full overflow-hidden rounded-lg bg-[#0F131A] aspect-[5/1.6]">
          {/* Artwork, right side.

              The art is masked rather than simply positioned: an <img> ends on a
              hard vertical edge, which read as a seam down the middle of the
              banner. Fading its own alpha to nothing over the first third means
              there is no edge to see, whatever the artwork is. */}
          {banner.imageUrl && (
            <div
              className="absolute right-0 top-0 h-full w-[62%]"
              style={{
                maskImage:
                  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 18%, #000 45%)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 18%, #000 45%)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Copy-side wash: same base colour as the panel, so the text sits on
              solid ground on the left and the art carries the right. Sharing the
              colour is what stops a visible band where the two meet. */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#0F131A_0%,#0F131A_34%,rgba(15,19,26,0.75)_50%,rgba(15,19,26,0)_72%)]" />

          {/* Vertical falloff, as on the player site */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0F131A]/70 via-transparent to-[#0F131A]/40" />

          {/* Copy column */}
          <div className="relative z-10 flex h-full w-[52%] flex-col justify-center gap-1 px-6 py-4">
            <h1 className="text-white font-bold leading-[1.1] text-[26px]">
              {title || <span className="text-gray-600">Title</span>}
              {subtitle && (
                <span className="mt-1 block text-[19px]">{subtitle}</span>
              )}
              {oneLine && (
                <span className="mt-2 block text-[17px] font-semibold text-[#CA6BEF]">
                  {oneLine}
                </span>
              )}
            </h1>

            {(amount || suffix) && (
              <div className="mt-1 flex items-baseline gap-2">
                {amount && (
                  <span className="text-[#CA6BEF] font-semibold text-[18px]">
                    {amount}
                  </span>
                )}
                {suffix && (
                  <span className="text-white text-[15px] whitespace-nowrap">
                    {suffix}
                  </span>
                )}
              </div>
            )}

            {buttonText && (
              <button
                type="button"
                className="mt-3 h-11 w-[170px] shrink-0 rounded-lg border-2 border-white/40 bg-[#212730] text-[15px] font-medium text-white"
              >
                {buttonText}
              </button>
            )}
          </div>
        </div>

        </>
        )}

        {!isImageBanner && missing && (
          <p className="text-xs text-amber-400">
            No text set for {isEn ? "English" : "Spanish"} — players on that
            language would see artwork with no copy.
          </p>
        )}

        {/* Image banners are display-only — no button, no destination — so the
            action row would only ever show placeholders. */}
        {!isImageBanner && (
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
          <div className="rounded border border-gray-800 bg-[#191D24] px-3 py-2">
            <span className="text-gray-500">
              {isImageBanner ? "Tap action: " : "Button action: "}
            </span>
            <span className="text-gray-200">{banner.actionType}</span>
          </div>
          <div className="rounded border border-gray-800 bg-[#191D24] px-3 py-2">
            <span className="text-gray-500">Destination: </span>
            <span className="text-gray-200">{banner.link || "—"}</span>
          </div>
        </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
