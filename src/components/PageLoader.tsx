"use client";

import { Loader2 } from "lucide-react";

export default function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B0E13] text-white">
      <Loader2 className="h-10 w-10 animate-spin text-[#B93DEB] mb-4" />
      {/* <p className="text-sm font-medium animate-pulse"></p> */}
    </div>
  );
}
