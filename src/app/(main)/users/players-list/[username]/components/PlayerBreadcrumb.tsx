"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PlayerBreadcrumb({
  username,
}: {
  username: string;
}) {
  return (
    <div className="bg-[#161A21] px-6 py-3 rounded-lg flex items-center justify-between gap-4">
      <div className="text-md font-mono font-semibold text-gray-100 min-w-0 truncate">
        User /{" "}
        <Link
          href="/users/players-list"
          className="
            text-gray-300
            hover:text-[#B93DEB]
            transition-colors
            duration-200
          "
        >
          Player Listing
        </Link>{" "}
        / <span className="text-white">{username} </span>
      </div>

      <Link
        href="/users/players-list"
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#242B35] hover:bg-[#B93DEB] text-gray-200 hover:text-white text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </Link>
    </div>
  );
}
