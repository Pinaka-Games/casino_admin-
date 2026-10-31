"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCalendarDate } from "@/lib/calendar-date";

// Mock sub-agent data — same as used in detail page
// TODO: Accept user prop and show real data from API
interface SubAgentBasicInfoProps {
  user: {
    id: string;
    username: string;
    name?: string;
    displayName?: string;
    email?: string;
    isActive: boolean;
    referralCode?: string;
    commissionPercentage?: number;
    joinedAt?: string;
    gender?: string;
    dateOfBirth?: string;
    phone?: string;
  };
}

function Info({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[176px_1fr] gap-3 sm:gap-6 items-start py-1 sm:py-0">
      <span className="text-xs sm:text-sm font-normal text-[#9c999d]">{label}:</span>
      <span className={`text-xs sm:text-sm font-medium break-all ${green ? "text-green-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

function InfoSkeleton() {
  return (
    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[176px_1fr] gap-3 sm:gap-6 items-center py-1 sm:py-0">
      <Skeleton className="h-4 w-24 sm:w-32 bg-gray-700/40" />
      <Skeleton className="h-4 w-32 sm:w-40 bg-gray-700/30" />
    </div>
  );
}

export default function SubAgentBasicInfoTab({ user }: SubAgentBasicInfoProps) {
  if (!user) {
    return (
      <div className="px-0 sm:px-5 grid grid-cols-1 md:grid-cols-2 gap-y-4 sm:gap-y-5 gap-x-6 md:gap-x-12">
        {Array.from({ length: 8 }).map((_, i) => (
          <InfoSkeleton key={`info-skeleton-${i}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="px-0 sm:px-5 grid grid-cols-1 md:grid-cols-2 gap-y-4 sm:gap-y-5 gap-x-6 md:gap-x-12 text-sm text-white">
      <Info label="Username" value={user.username || "N/A"} />
      <Info label="Full Name" value={user.name || "N/A"} />
      <Info label="Display Name" value={user.displayName || "N/A"} />
      <Info label="Email" value={user.email || "N/A"} />
      <Info label="Status" value={user.isActive ? "Active" : "Inactive"} green={user.isActive} />
      <Info
        label="Gender"
        value={
          user.gender
            ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1)
            : "N/A"
        }
      />
      <Info
        label="Date of Birth"
        value={formatCalendarDate(user.dateOfBirth)}
      />
      <Info label="Phone" value={user.phone || "N/A"} />
      <Info label="Sub-Agent Referral Code" value={user.referralCode || "N/A"} />
      {/* <Info
        label="Commission Rate"
        value={user.commissionPercentage !== undefined ? `${user.commissionPercentage}%` : "N/A"}
      /> */}
      <Info
        label="Joined Date"
        value={user.joinedAt ? new Date(user.joinedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
      />
    </div>
  );
}
