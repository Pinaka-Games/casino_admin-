"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Clipboard API first; the textarea fallback covers plain-HTTP dev/staging
 * hosts, where `navigator.clipboard` does not exist.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or not focused — try the fallback.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Small icon button that copies one value. It sits inside clickable rows and
 * cards, so the click never reaches them: copying must not open the player.
 */
export default function CopyValueButton({
  value,
  what,
  size = 12,
  className = "",
}: {
  value: string | null | undefined;
  /** Names the value for screen readers: "Copy email". */
  what: string;
  size?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const text = value?.trim() ?? "";
  if (!text) return null;

  return (
    <button
      type="button"
      aria-label={`Copy ${what}`}
      title={`Copy ${what}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void copyText(text).then((ok) => {
          if (ok) {
            setCopied(true);
            toast.success("Copied");
          } else {
            toast.error("Couldn't copy — select the text and copy it manually.");
          }
        });
      }}
      className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded p-0.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-[#B93DEB] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B93DEB] ${className}`}
    >
      {copied ? <Check size={size} className="text-[#04AD37]" /> : <Copy size={size} />}
    </button>
  );
}
