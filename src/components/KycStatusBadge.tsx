"use client";

import { Flag } from "lucide-react";

// Shared KYC status badge — same color scheme as the KYC Listing page.
// `adminApproved` adds a flag icon (hover → "Approved by admin") marking a
// manual admin override.

const MAP: Record<string, { label: string; cls: string }> = {
  APPROVED: {
    label: "Approved",
    cls: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  PENDING_REVIEW: {
    label: "Pending",
    cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  IN_PROGRESS: {
    label: "In Progress",
    cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  NOT_STARTED: {
    label: "Not Started",
    cls: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  },
};

export default function KycStatusBadge({
  status,
  adminApproved,
}: {
  status?: string;
  adminApproved?: boolean;
}) {
  const s = MAP[status || "NOT_STARTED"] || MAP.NOT_STARTED;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${s.cls}`}
      >
        {s.label}
      </span>
      {adminApproved && (
        <span className="relative group inline-flex items-center">
          <Flag
            size={14}
            className="text-purple-400 fill-purple-400/40 cursor-pointer"
          />
          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-[#0b0f14] px-2 py-1 text-[11px] font-medium text-purple-200 border border-purple-500/40 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
            Approved by admin
          </span>
        </span>
      )}
    </span>
  );
}
