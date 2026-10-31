"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Loader2 } from "lucide-react";
import { cashBundleApi } from "@/api/cashbundle/cashbundle.api";
import { CASH_BUNDLE_FALLBACK_IMAGE } from "@/config/cashbundle-image-presets";

/**
 * Admin-side preview of the discounted-bundle pop-up players get after login.
 *
 * The player site is a SEPARATE Next app, so its `BundleSaleModal` cannot be
 * imported here — this mirrors its header and card layout instead. Treat it as
 * a faithful representation of the COPY and overall shape, not a pixel-exact
 * render: if the player-side modal is restyled, this needs the same change.
 * That is the cost of previewing across two apps, and it is why the preview
 * deliberately focuses on the parts an admin actually edits.
 *
 * Bundles are the real promoted ones, so the admin sees what will genuinely be
 * shown rather than invented placeholder data.
 */

interface PreviewBundle {
  id: string;
  name: string;
  coins: number;
  price: number;
  discountedPrice: number;
  badge: string | null;
  freeCash: string;
  image: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Draft (possibly unsaved) headline the admin is typing. */
  title: string;
  /** Draft sub-line. Blank renders nothing, matching the player site. */
  subtitle: string;
}

export default function BundleSalePreviewModal({ open, onClose, title, subtitle }: Props) {
  const [bundles, setBundles] = useState<PreviewBundle[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    cashBundleApi
      .getAll()
      .then((all) => {
        if (cancelled) return;

        // Same selection the player pop-up makes: active bundles that are on
        // sale AND flagged to be promoted.
        const promoted = all
          .filter(
            (b) =>
              b.isActive &&
              b.discountEnabled &&
              b.promoteOnHome &&
              Number(b.discountValue) > 0,
          )
          .slice(0, 3)
          .map((b): PreviewBundle => {
            const price = Number(b.price) || 0;
            const dValue = Number(b.discountValue) || 0;
            const rawOff = b.discountType === "percentage" ? (price * dValue) / 100 : dValue;
            const off = Math.min(rawOff, price);
            const percentOff = price > 0 ? Math.round((off / price) * 100) : 0;
            // Only null/undefined means "legacy, use price". An explicit 0 is a
            // deliberate coins-only bundle and must stay 0 — matches the
            // backend's `resolveBundleWulfCash` and the player site.
            const grantedCash =
              b.wulfCashAmount === null || b.wulfCashAmount === undefined
                ? price
                : Number(b.wulfCashAmount) || 0;
            const combined = grantedCash + (Number(b.bonusWulfCash) || 0);

            return {
              id: b.id,
              name: b.name,
              coins: Number(b.wulfCoinAmount) || 0,
              price,
              discountedPrice: Math.max(0, price - off),
              badge:
                off > 0
                  ? b.discountType === "flat"
                    ? `$${off.toFixed(2)}`
                    : `${percentOff}%`
                  : null,
              freeCash: combined % 1 === 0 ? String(combined) : combined.toFixed(2),
              image:
                b.icon && (b.icon.startsWith("http") || b.icon.startsWith("/"))
                  ? b.icon
                  : CASH_BUNDLE_FALLBACK_IMAGE,
            };
          });

        setBundles(promoted);
      })
      .catch(() => {
        if (!cancelled) setBundles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const biggest = bundles?.length
    ? Math.max(...bundles.map((b) => b.price - b.discountedPrice))
    : 0;

  // `{savings}` is substituted the same way the player site does it, so the
  // admin sees the real resolved sentence rather than the raw placeholder.
  const resolvedSubtitle = subtitle
    ? subtitle.replace(/\{savings\}/gi, `$${biggest.toFixed(2)}`)
    : "";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-[#B93DEB]/40 bg-[#12161D] shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
        {/* Banner making clear this is a preview, not the live pop-up. */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#B93DEB]/10 px-4 py-2">
          <p className="text-xs font-semibold text-[#D9A6F5]">
            Preview — how players will see this pop-up. Unsaved changes included.
          </p>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/40 text-white/70 transition hover:bg-black/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── HEADER (mirrors the player pop-up) ── */}
        <div
          className="px-6 pb-5 pt-7 text-center"
          style={{
            background:
              "linear-gradient(180deg, rgba(185,61,235,0.22) 0%, rgba(185,61,235,0) 100%)",
          }}
        >
          <span className="inline-block rounded-full bg-[#B93DEB] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">
            Limited time
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
            {title.trim() || "Pay less get more"}
          </h2>
          {resolvedSubtitle && (
            <p className="mt-1 text-sm text-gray-400">{resolvedSubtitle}</p>
          )}
        </div>

        {/* ── BUNDLE CARDS ── */}
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : bundles && bundles.length > 0 ? (
            <div className="flex justify-center gap-3 overflow-x-auto">
              {bundles.map((b) => (
                <div
                  key={b.id}
                  className="relative flex w-[200px] shrink-0 flex-col overflow-hidden rounded-lg border border-[#2A2D34] bg-[#191D24]"
                >
                  {b.badge && (
                    <div
                      className="pointer-events-none absolute right-0 top-0 z-20 flex flex-col items-center justify-center rounded-bl-lg px-2.5 py-1.5 leading-none text-[#3A2405]"
                      style={{
                        background:
                          "linear-gradient(135deg,#FBC409 0%,#FAEC4A 48%,#FAC308 100%)",
                      }}
                    >
                      <span className="text-base font-extrabold">{b.badge}</span>
                      <span className="mt-0.5 text-[9px] font-bold tracking-wide">OFF</span>
                    </div>
                  )}

                  <div className="flex items-center justify-center py-4">
                    <Image
                      src={b.image}
                      alt={b.name}
                      width={90}
                      height={90}
                      unoptimized
                      className="h-auto w-[70%] object-contain"
                    />
                  </div>

                  <div className="px-2 text-center">
                    <p className="truncate text-xl font-semibold text-white">
                      {b.coins.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">Wulf Coin</p>
                  </div>

                  <div className="px-3 pb-3 pt-2">
                    {/* Hidden on a coins-only bundle, same as the player card. */}
                    {Number(b.freeCash) > 0 && (
                      <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#04AD37]/70 bg-[#04AD37]/10 px-2 py-2 text-[13px] font-semibold">
                        <span className="rounded bg-[#04AD37] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                          + Free
                        </span>
                        <span className="font-extrabold text-white">{b.freeCash}</span>
                        <span className="text-sm text-[#04AD37]">Wulf Cash</span>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className="text-sm text-gray-500 line-through">
                        ${b.price.toFixed(2)}
                      </span>
                      <span className="text-lg font-bold text-white">
                        ${b.discountedPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Not an error: it is the honest answer, and it tells the admin the
            // pop-up will not appear at all in this state.
            <div className="rounded-lg border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-white">
                No bundles are currently promoted
              </p>
              <p className="mt-1 text-xs text-gray-400">
                This pop-up only appears when a bundle is active, has a discount
                enabled, and has &quot;Promote on home&quot; switched on. Your copy
                above is still saved and will be used once one qualifies.
              </p>
            </div>
          )}
        </div>

        {/* ── FOOTER (mirrors the player pop-up: opt-out only) ── */}
        <div className="flex justify-center px-6 pb-6">
          <span className="text-xs text-gray-500 underline underline-offset-4">
            Don&apos;t show me offers again
          </span>
        </div>
      </div>
    </div>
  );
}
