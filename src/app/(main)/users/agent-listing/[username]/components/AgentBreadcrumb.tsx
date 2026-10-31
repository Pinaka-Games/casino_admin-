"use client";

import { UserWithProfile } from "@/types/profile.type";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AgentBreadcrumb({
  user,
}: {
  user: UserWithProfile;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-3">
      <button
        onClick={() => router.back()}
        className="flex self-start items-center gap-1.5 rounded-lg bg-[#161A21] border border-white/10 px-3 py-2 text-sm text-gray-300 md:self-auto hover:text-white hover:border-[#B93DEB]/40 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex-1 bg-[#161A21] px-3 py-3 rounded-lg text-md font-mono font-semibold text-gray-100 break-words md:px-6">
        User /{" "}
        <Link
          href="/users/agent-listing"
          className="text-gray-300 hover:text-[#B93DEB] transition-colors duration-200"
        >
          Agent Listing
        </Link>{" "}
        / <span className="text-white">{user.name || user.username || "Agent"} (ID: {user.id.slice(0, 8)})</span>
      </div>
    </div>
  );
}
