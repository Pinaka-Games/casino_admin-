"use client";

import { PresenceState } from "@/hooks/use-presence";

/**
 * "Online", or "Offline" with when the account was last connected.
 *
 * Shared by the player, agent and sub-agent listings so all three read the
 * same — a green word alone tells an admin nothing about an account that went
 * quiet three weeks ago versus three minutes ago.
 */
export default function OnlineStatus({
  isOnline,
  lastSeenAt,
  className = "",
  variant = "text",
}: PresenceState & { className?: string; variant?: "text" | "pill" }) {
  const exact = formatExact(lastSeenAt);

  return (
    <div className={`flex flex-col items-center leading-tight ${className}`}>
      {variant === "pill" ? (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            isOnline
              ? "bg-[#04AD37]/15 text-[#04AD37] border border-[#04AD37]/30"
              : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              isOnline ? "bg-[#04AD37]" : "bg-gray-400"
            }`}
          />
          {isOnline ? "Online" : "Offline"}
        </span>
      ) : (
        <span
          className={`text-xs font-medium ${
            isOnline ? "text-[#04AD37]" : "text-gray-400"
          }`}
        >
          {isOnline ? "Online" : "Offline"}
        </span>
      )}

      {/* Only while offline: "last seen" next to a green Online reads as a
          contradiction, and the answer then is simply "now". Relative reads
          faster at a glance, with the exact stamp one hover away rather than
          eating a second column. */}
      {!isOnline && exact ? (
        <span className="mt-0.5 text-[10px] text-gray-500" title={exact}>
          {formatRelative(lastSeenAt)}
        </span>
      ) : null}
    </div>
  );
}

/** e.g. "2 hours ago" — the at-a-glance form. */
export function formatRelative(value?: string | Date | null) {
  const date = toDate(value);
  if (!date) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  // Clock skew between the API and this browser can put "last seen" a few
  // seconds into the future; that is not worth rendering as a negative age.
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  // Past a month "51d ago" stops meaning anything — show the date.
  return date.toLocaleDateString();
}

/** e.g. "13/08/2026, 10:24" — the tooltip / CSV form. */
export function formatExact(value?: string | Date | null) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString();
}

/** "Online" or "Offline (last seen …)" — flattened for CSV export. */
export function formatOnlineStatus({ isOnline, lastSeenAt }: PresenceState) {
  if (isOnline) return "Online";
  const exact = formatExact(lastSeenAt);
  return exact ? `Offline (last seen ${exact})` : "Offline";
}

function toDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}
