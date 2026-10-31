"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children directly into document.body via a Portal.
 * This avoids issues with parent transforms / overflow-hidden in Sidebar layouts
 * where position:fixed elements get offset incorrectly.
 *
 * Pass `onClose` to also get Escape-to-close.
 */

// Nested/stacked modals each mount a portal — without a counter the first one
// to unmount would restore body scroll while another is still open.
let openPortals = 0;

export default function ModalPortal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Portals need a client-side mount flag; rendering createPortal during SSR
    // or first hydration pass throws. This is the one legitimate setState here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    openPortals += 1;
    document.body.style.overflow = "hidden";

    return () => {
      setMounted(false);
      openPortals = Math.max(0, openPortals - 1);
      if (openPortals === 0) {
        document.body.style.overflow = "unset";
      }
    };
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
