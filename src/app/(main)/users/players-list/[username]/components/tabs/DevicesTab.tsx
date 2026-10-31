"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import { Monitor, Smartphone, Tablet, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TableSkeleton from "@/components/TableSkeleton";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import {
  getPlayerSessions,
  revokePlayerSession,
  revokeAllPlayerSessions,
  type PlayerSessionRow,
  type PlayerSessionsResponse,
} from "@/api/session/session.api";

/** Rough age of a session, for the "2 hours ago" column. */
function timeAgo(iso: string | null): string {
  if (!iso) return "never used";

  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 90) return "active now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function DeviceIcon({ type }: { type: PlayerSessionRow["deviceType"] }) {
  const className = "w-4 h-4 text-white/70";
  if (type === "desktop") return <Monitor className={className} />;
  if (type === "mobile") return <Smartphone className={className} />;
  if (type === "tablet") return <Tablet className={className} />;
  return <Globe className={className} />;
}

/**
 * Staff view of where a player is signed in, with per-device revoke.
 *
 * Built for the cases support actually receives: "someone else is using my
 * account", account-sharing investigations, and responsible-gaming reviews
 * where knowing which devices are live matters.
 *
 * Read-and-revoke only. There is no way to create a session from here — staff
 * must never be able to mint a player session and act as them.
 */



export default function DevicesTab({ username }: { username: string }) {
  // The [username] route param is the user's UUID (same as every other tab).
  const userId = username;

  const [data, setData] = useState<PlayerSessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  /** Session id currently being revoked — disables just that row's button. */
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await getPlayerSessions(userId);
      setData(res);
    } catch {
      toast.error("Could not load this player's devices.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = async (session: PlayerSessionRow) => {
    setRevoking(session.sessionId);
    try {
      const res = await revokePlayerSession(session.sessionId);
      toast.success(res.message || "Device signed out.");
      await load();
    } catch {
      toast.error("Could not sign that device out.");
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      const res = await revokeAllPlayerSessions(userId);
      toast.success(res.message || "All devices signed out.");
      await load();
    } catch {
      toast.error("Could not sign the player out.");
    } finally {
      setRevokingAll(false);
    }
  };

  const devices = data?.devices ?? [];


  // The two timestamps sort — "who is on right now" and "when did this device
  // first appear" are what an admin checking a shared account asks.
  const { sort, toggle } = useTableSort<"lastActive" | "signedIn">();
  const visibleDevices = useSortedRows(devices, sort, {
    lastActive: (row) => (row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : null),
    signedIn: (row) => new Date(row.createdAt).getTime(),
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-40 bg-gray-700/40" />
        <div className="overflow-hidden rounded-lg border border-white/5">
          <TableSkeleton rows={3} cols={6} />
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold">
            Active sessions{" "}
            <span className="text-white/50 font-normal">
              ({devices.length} of {data?.limit ?? 0}
              {/* Only name the tier when the allowance actually came from it.
                  In DEFAULT mode the number is platform-wide, and attributing
                  it to a plan would send support down the wrong path. */}
              {data?.mode === "SUBSCRIPTION" && data?.planName
                ? ` — ${data.planName}`
                : data?.mode === "DEFAULT"
                  ? " — platform default"
                  : ""}
              )
            </span>
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Devices this player is currently signed in on. Signing one out takes
            effect immediately — they will need to log in again on that device.
          </p>
        </div>

        {devices.length > 0 && (
          <button
            type="button"
            onClick={handleRevokeAll}
            disabled={revokingAll}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {revokingAll ? "Signing out…" : "Sign out all devices"}
          </button>
        )}
      </div>

      {/* Shadow mode: the data is real but the limit is not being applied yet,
          so the header count must not be read as an enforced ceiling. */}
      {data && !data.enforced && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Device limits are not currently enforced — this player can exceed the
          number shown. Enable it in Settings → System Configuration → Security.
        </p>
      )}

      {visibleDevices.length === 0 ? (
        <NoData />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-white/50 border-b border-white/10">
                <th className="py-2 pr-4 font-medium">Device</th>
                <th className="py-2 pr-4 font-medium">IP</th>
                <th className="py-2 pr-4 font-medium">Country</th>
                <SortableTh
                  label="Last active"
                  sortKey="lastActive"
                  sort={sort}
                  onToggle={toggle}
                  className="py-2 pr-4 font-medium"
                />
                <SortableTh
                  label="Signed in"
                  sortKey="signedIn"
                  sort={sort}
                  onToggle={toggle}
                  className="py-2 pr-4 font-medium"
                />
                <th className="py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleDevices.map((session) => (
                <tr
                  key={session.sessionId}
                  className="border-b border-white/5 text-white/80"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <DeviceIcon type={session.deviceType} />
                      <span>{session.deviceLabel || session.deviceType}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {session.ip || "—"}
                  </td>
                  <td className="py-3 pr-4">{session.countryCode || "—"}</td>
                  <td className="py-3 pr-4">{timeAgo(session.lastSeenAt)}</td>
                  <td className="py-3 pr-4">
                    {new Date(session.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRevoke(session)}
                      disabled={revoking === session.sessionId}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                    >
                      {revoking === session.sessionId
                        ? "Signing out…"
                        : "Sign out"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
