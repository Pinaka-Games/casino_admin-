"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Go back one page" for the admin header.
 *
 * It only appears once the operator has actually moved somewhere inside the
 * panel — a back button on the page they landed on would walk them out of the
 * app (usually into the login redirect). Depth is counted from route changes:
 * a normal navigation pushes, a browser/back-button navigation pops, and
 * `popstate` is what tells the two apart.
 */
export default function HeaderBackButton({
  className = "",
  label = "Go Back",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const depth = useRef(0);
  const firstRender = useRef(true);
  const poppingBack = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const onPopState = () => {
      poppingBack.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    // The entry page is depth 0 — nothing behind it that belongs to us.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    if (poppingBack.current) {
      poppingBack.current = false;
      depth.current = Math.max(0, depth.current - 1);
    } else {
      depth.current += 1;
    }
    setCanGoBack(depth.current > 0);
  }, [pathname]);

  if (!canGoBack) return null;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => router.back()}
      title="Back to the previous page"
      className={`rounded-lg border-gray-600 text-gray-200 hover:bg-[#242B35] ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
