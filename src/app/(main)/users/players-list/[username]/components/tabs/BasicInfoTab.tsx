"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";
import KycTab from "./KycTab";
import DevicesTab from "./DevicesTab";
import { profileApi } from "@/api/users/users";
import { UserWithProfile } from "@/types/profile.type";
import { usePresence, resolvePresence } from "@/hooks/use-presence";
import { formatOnlineStatus } from "@/components/OnlineStatus";
import { formatCalendarDate } from "@/lib/calendar-date";

export default function BasicInfoTab({
  username,
}: {
  username: string;
}) {
  const [data, setData] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Live presence — the player signing in or out moves this without a reload.
  const presence = usePresence();
  const live = resolvePresence(presence, data?.id, data);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await profileApi.getUserProfile(username);
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username) fetchProfile();
  }, [username]);

  if (loading) {
    return (
      // A skeleton in the shape of the field grid: the card keeps its size
      // while loading, so the page does not jump when the data lands.
      <div className="rounded-xl border border-gray-800 bg-[#191D24] p-5">
        <Skeleton className="mb-4 h-4 w-24 bg-gray-700/40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 md:gap-y-4 md:gap-x-12">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-6">
              <Skeleton className="h-3 w-24 bg-gray-700/40" />
              <Skeleton className="h-3 w-40 bg-gray-700/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-5 py-8 text-center text-gray-400">
        Profile data not available.
      </div>
    );
  }

  const cardClass =
    "rounded-xl border border-gray-800 bg-[#191D24] p-5 shadow-sm";

  return (
    // Three cards rather than one long page: the profile, the identity check
    // and the sessions are separate questions, and a shared surface made the
    // KYC table read as part of the profile fields above it.
    <div className="space-y-5">
      <section className={cardClass}>
        <h3 className="mb-4 text-md text-gray-400">Basic Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 md:gap-y-4 md:gap-x-12 text-sm">
      <Info label="Full Name" value={data.profile?.fullName || data.name || "N/A"} />
      <Info label="Display Name" value={data.profile?.displayName || "N/A"} />
      {/* <Info label="Gender" value={data.profile?.gender || "N/A"} /> */}
      <Info label="DOB" value={formatCalendarDate(data.profile?.dateOfBirth)} />
      {/* <Info label="Ethnicity" value={data.profile?.ethnicity || "N/A"} /> */}
      <Info
        label="Phone"
        value={data.profile?.phone || "N/A"}
        copyable
        badge={
          data.profile?.phone ? (
            <VerifiedBadge verified={Boolean(data.phoneVerified)} />
          ) : undefined
        }
      />
      <Info
        label="Email"
        value={data.profile?.email || data.entity || "N/A"}
        copyable
        badge={
          data.profile?.email || data.entity ? (
            <VerifiedBadge verified={Boolean(data.emailVerified)} />
          ) : undefined
        }
      />
      <Info
        label="Account Status"
        value={data.isActive ? "Active" : "Inactive"}
        green={data.isActive}
      />
      <Info
        label="Online Status"
        value={formatOnlineStatus(live)}
        green={live.isOnline}
      />
      {/* The zone decides when this player's daily reward, spins and deposit
          limits reset. "Not detected" means they fall back to the platform's
          Default Timezone. */}
      <Info label="Timezone" value={data.timezone || "Not detected"} />
      {/* The IANA string alone does not answer the question support actually
          gets asked — "has their day rolled over yet?" — so show their clock. */}
      <Info label="Local Time" value={formatPlayerLocalTime(data.timezone)} />

      {/* <Info label="Weekly Rescue" value={`${data.profile?.weeklyRescueBonusPercentage || 0}%`} /> */}
        {/* <Info label="Monthly Rescue" value={`${data.profile?.monthlyRescueBonusPercentage || 0}%`} /> */}
        </div>
      </section>

      {/* KYC and Devices used to be tabs of their own. They answer questions
          that come up while reading the profile — "is this person verified, and
          where are they signed in?" — so they sit under it now, each in its own
          card. Both components own their loading and empty states. */}
      <section className={cardClass}>
        <DevicesTab username={username} />
      </section>

      <section className={cardClass}>
        <h3 className="mb-4 text-md text-gray-400">KYC</h3>
        <KycTab username={username} />
      </section>
    </div>
  );
}

/** Current wall-clock where the player is, or a reason there isn't one. */
function formatPlayerLocalTime(timezone?: string | null): string {
  if (!timezone) return "N/A";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
  } catch {
    // A stored value this runtime's ICU does not recognise. Worth surfacing
    // rather than hiding — it means the backend is falling back for this player.
    return `Unknown zone (${timezone})`;
  }
}

/** Proof state of one contact channel, shown beside its value. */
function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase leading-none ${
        verified
          ? "border-green-500/40 bg-green-500/10 text-green-400"
          : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
      }`}
    >
      {verified ? "Verified" : "Not Verified"}
    </span>
  );
}

function Info({
  label,
  value,
  green,
  badge,
  copyable,
}: {
  label: string;
  value: string;
  green?: boolean;
  badge?: ReactNode;
  /** Shows a copy button beside the value — for contact details support reads
   *  out or pastes into another system. */
  copyable?: boolean;
}) {
  // Nothing to copy for a placeholder, and a button that copies the literal
  // string "N/A" is worse than no button.
  const canCopy = copyable && value && value !== "N/A";

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-6">
      <span className="shrink-0 text-md font-normal text-[#9c999d] sm:w-32">{label}:</span>
      <span className={`flex min-w-0 flex-wrap items-center gap-2 ${green ? "text-green-400" : "text-white"}`}>
        {/* `break-words` rather than `break-all`: an address only splits when it
            genuinely cannot fit, instead of mid-word on every line. */}
        <span className="min-w-0 break-words">{value}</span>
        {canCopy && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success("Copied");
            }}
            title={`Copy ${label.toLowerCase()}`}
            className="shrink-0 cursor-pointer text-gray-500 transition-colors hover:text-purple-400"
          >
            <Copy size={13} />
          </button>
        )}
        {badge}
      </span>
    </div>
  );
}
