"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import type { FilterField, FilterValues } from "@/components/filters/types";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Loader2,
  LogOut,
  Monitor,
  RotateCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getSessionOverview,
  revokePlayerSession,
  revokeAllPlayerSessions,
  type AdminSessionSort,
  type PlayerSessionRow,
  type SessionDeviceType,
  type SessionOverviewResponse,
  type SessionOverviewRow,
} from "@/api/session/session.api";

/* ---------------------------------------------------------------- helpers */

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 90) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DeviceIcon({
  type,
  className = "w-4 h-4",
}: {
  type: SessionDeviceType;
  className?: string;
}) {
  if (type === "desktop") return <Monitor className={className} />;
  if (type === "mobile") return <Smartphone className={className} />;
  if (type === "tablet") return <Tablet className={className} />;
  return <Globe className={className} />;
}

const DEVICE_TYPES: Array<{ value: "" | SessionDeviceType; label: string }> = [
  { value: "", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "unknown", label: "Unknown" },
];

/** The icon alone read as an empty cell, so every type is also named. */
const deviceTypeLabel = (type: SessionDeviceType) =>
  DEVICE_TYPES.find((d) => d.value === type)?.label ?? "Unknown";

const SORTS: Array<{ value: AdminSessionSort; label: string }> = [
  { value: "recent", label: "Most recently active" },
  { value: "devices_desc", label: "Most devices" },
  { value: "devices_asc", label: "Fewest devices" },
  { value: "oldest", label: "Least recently active" },
];

const SESSION_FILTER_DEFAULTS: FilterValues = {
  search: "",
  deviceType: "all",
  minDevices: "1",
  sort: "recent",
};

const SESSION_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "deviceType",
    label: "Device type",
    options: DEVICE_TYPES.map((o) => ({
      value: o.value === "" ? "all" : o.value,
      label: o.label,
    })),
  },
  {
    type: "select",
    key: "minDevices",
    label: "Device count",
    options: [
      { value: "1", label: "Any number of devices" },
      { value: "2", label: "2 or more devices" },
      { value: "3", label: "3 or more devices" },
      { value: "5", label: "5 or more devices" },
    ],
  },
  {
    type: "select",
    key: "sort",
    label: "Sort by",
    options: SORTS.map((o) => ({ value: o.value, label: o.label })),
  },
];

/* ------------------------------------------------------------------ page */

/**
 * Every player signed in anywhere on the platform, grouped by account.
 *
 * The per-player Devices tab answers "where is THIS person signed in". This
 * answers the question that comes first: "who should I be looking at?" — which
 * accounts are on several devices at once, which are over their allowance,
 * which are signed in from more than one country.
 */
export default function DeviceSessionsPage() {
  const [data, setData] = useState<SessionOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [deviceType, setDeviceType] = useState<"" | SessionDeviceType>("");
  const [minDevices, setMinDevices] = useState(1);
  const [sort, setSort] = useState<AdminSessionSort>("recent");
  const [page, setPage] = useState(1);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState<string | null>(null);
  const [pendingRevokeAll, setPendingRevokeAll] =
    useState<SessionOverviewRow | null>(null);

  // Debounce the search box so a filter isn't fired on every keystroke — this
  // query groups and counts across the whole session table.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSessionOverview({
        search,
        deviceType: deviceType || undefined,
        minDevices,
        sort,
        page,
        limit: 20,
      });
      setData(res);
    } catch {
      toast.error("Could not load device sessions.");
    } finally {
      setLoading(false);
    }
  }, [search, deviceType, minDevices, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (userId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleRevokeOne = async (
    row: SessionOverviewRow,
    session: PlayerSessionRow
  ) => {
    setRevoking(session.sessionId);
    try {
      const res = await revokePlayerSession(session.sessionId);
      toast.success(res.message || "Device signed out.");
      await load();
    } catch {
      toast.error("Could not sign this device out.");
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async (row: SessionOverviewRow) => {
    setRevoking(row.userId);
    try {
      const res = await revokeAllPlayerSessions(row.userId);
      toast.success(res.message || "All devices signed out.");
      setPendingRevokeAll(null);
      await load();
    } catch {
      toast.error("Could not sign the player out.");
    } finally {
      setRevoking(null);
    }
  };

  const rows = data?.rows ?? [];
  // Counts only what the sheet owns — the search box has its own field and no
  // longer belongs in the Filters button's badge.
  const activeFilterCount = useMemo(
    () =>
      (deviceType ? 1 : 0) +
      (minDevices > 1 ? 1 : 0) +
      (sort !== "recent" ? 1 : 0),
    [deviceType, minDevices, sort]
  );

  return (
    <div className="p-3 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Device Sessions</h1>
          {/* <p className="mt-1 text-sm text-white/50">
            Everyone currently signed in, grouped by account. Revoking signs that
            device out immediately.
          </p> */}
        </div>
        {/* <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-lg border border-[#2C323D] bg-[#242B35] px-3 py-2 text-sm text-white/80 transition-colors hover:text-white"
        >
          <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button> */}
      </div>

      {/* Headline counts. Deliberately unaffected by the filters below — they
          describe the platform, not the current query. */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Players signed in", value: data?.summary.usersSignedIn },
          { label: "Active sessions", value: data?.summary.activeSessions },
          {
            label: "On more than one device",
            value: data?.summary.multiDeviceUsers,
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-white/10 bg-[#161A21] p-4"
          >
            <p className="text-xs uppercase tracking-wide text-white/40">
              {tile.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-white tabular-nums">
              {tile.value ?? "—"}
            </p>
          </div>
        ))}
      </div> */}

      <FilterToolbar
        className="mb-4"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search email, phone or username"
        activeCount={activeFilterCount}
        onOpenFilters={() => setSheetOpen(true)}
      />

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Session Filters"
        description="Narrow which players and devices the list shows."
        fields={SESSION_FILTER_FIELDS}
        values={{
          deviceType: deviceType === "" ? "all" : deviceType,
          minDevices: String(minDevices),
          sort,
        }}
        defaults={SESSION_FILTER_DEFAULTS}
        onApply={(values) => {
          const nextType = values.deviceType ?? "all";
          setDeviceType((nextType === "all" ? "" : nextType) as "" | SessionDeviceType);
          setMinDevices(Number(values.minDevices ?? 1) || 1);
          setSort((values.sort ?? "recent") as AdminSessionSort);
          setPage(1);
        }}
      />

      {/* Table */}
      <div className="rounded-xl border border-white/10 bg-[#161A21] overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sessions…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10">
            <NoData />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50">
                  <th className="w-8 py-3 pl-4" />
                  <th className="py-3 pr-4 font-medium">Player</th>
                  <th className="py-3 pr-4 font-medium">Devices</th>
                  <th className="py-3 pr-4 font-medium">Types</th>
                  <th className="py-3 pr-4 font-medium">Countries</th>
                  <th className="whitespace-nowrap py-3 pr-4 font-medium">Last active</th>
                  <th className="whitespace-nowrap py-3 pl-4 pr-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOpen = expanded.has(row.userId);
                  return (
                    // Fragment must carry the key, not the rows inside it — a
                    // bare <> cannot, and React would then re-key every row on
                    // each expand/collapse.
                    <Fragment key={row.userId}>
                      <tr className="border-b border-white/5 text-white/80 hover:bg-white/[0.02]">
                        <td className="py-3 pl-4">
                          <button
                            type="button"
                            onClick={() => toggle(row.userId)}
                            aria-label={isOpen ? "Hide devices" : "Show devices"}
                            aria-expanded={isOpen}
                            className="text-white/50 transition-colors hover:text-white"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 pr-4">
                          {/* Both lines copy: support pastes a username into
                              one system and the email into another, and the
                              row is a link, so selecting the text by hand
                              navigates instead. */}
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/users/players-list/${row.userId}`}
                              className="font-medium text-white hover:text-[#C97DEA]"
                            >
                              {row.username || "—"}
                            </Link>
                            <CopyButton value={row.username} size={12} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-white/45">{row.entity}</span>
                            <CopyButton value={row.entity} size={12} />
                          </div>
                        </td>

                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                              row.overLimit
                                ? "bg-red-500/15 text-red-300"
                                : "bg-white/10 text-white/80"
                            }`}
                            title={
                              row.planName
                                ? `Allowance ${row.deviceLimit} (${row.planName})`
                                : `Allowance ${row.deviceLimit}`
                            }
                          >
                            {row.deviceCount} / {row.deviceLimit}
                          </span>
                          {row.overLimit && (
                            <span className="ml-2 text-xs text-red-300">
                              over limit
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/60">
                            {row.deviceTypes.map((t) => (
                              <span key={t} className="inline-flex items-center gap-1 text-xs">
                                <DeviceIcon type={t} />
                                {deviceTypeLabel(t)}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 pr-4">
                          {row.countries.length ? (
                            <span
                              className={
                                // More than one country at once is the signal an
                                // account-sharing investigation starts from.
                                row.countries.length > 1
                                  ? "text-amber-300"
                                  : "text-white/70"
                              }
                            >
                              {row.countries.join(", ")}
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>

                        <td className="whitespace-nowrap py-3 pr-4 text-white/70">
                          {timeAgo(row.lastActiveAt)}
                        </td>

                        <td className="py-3 pl-4 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => setPendingRevokeAll(row)}
                            disabled={revoking === row.userId}
                            className="whitespace-nowrap rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                          >
                            {revoking === row.userId
                              ? "Signing out…"
                              : "Sign out all devices"}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-[#12161C]">
                          <td />
                          <td colSpan={6} className="px-0 py-3 pr-4">
                            <div className="flex flex-col gap-2">
                              {row.devices.map((session) => (
                                <div
                                  key={session.sessionId}
                                  className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-[#191D24] px-3 py-2"
                                >
                                  <DeviceIcon
                                    type={session.deviceType}
                                    className="h-4 w-4 text-white/60"
                                  />
                                  <span className="min-w-[160px] text-white/85">
                                    {session.deviceLabel || session.deviceType}
                                  </span>
                                  <span className="font-mono text-xs text-white/45">
                                    {session.ip || "—"}
                                  </span>
                                  <span className="text-xs text-white/45">
                                    {session.countryCode || "—"}
                                  </span>
                                  <span className="text-xs text-white/45">
                                    active {timeAgo(session.lastSeenAt)}
                                  </span>
                                  <span className="text-xs text-white/35">
                                    since{" "}
                                    {new Date(session.createdAt).toLocaleString()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeOne(row, session)}
                                    disabled={revoking === session.sessionId}
                                    className="ml-auto rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                                  >
                                    {revoking === session.sessionId
                                      ? "Signing out…"
                                      : "Sign out this device"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
            <span className="text-white/50">
              Page {data.page} of {data.totalPages} · {data.total} player
              {data.total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1 || loading}
                className="rounded-lg border border-[#2C323D] bg-[#242B35] px-3 py-1.5 text-white/80 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={data.page >= data.totalPages || loading}
                className="rounded-lg border border-[#2C323D] bg-[#242B35] px-3 py-1.5 text-white/80 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Signing a player out of every device is irreversible and immediately
          visible to them, so it gets a real confirmation rather than the
          browser's window.confirm — which cannot be styled, renders the origin
          as its title, and on some platforms blocks the whole window. */}
      <AlertDialog
        open={Boolean(pendingRevokeAll)}
        onOpenChange={(next) => !next && setPendingRevokeAll(null)}
      >
        <AlertDialogContent className="max-w-[460px] overflow-hidden rounded-xl border border-[#2A2F3A] bg-[#15181E] p-0 text-white">
          <div className="p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F43F5E]/15 text-[#F43F5E]">
                  <LogOut size={17} />
                </span>
                Sign out all devices?
              </AlertDialogTitle>
              <AlertDialogDescription className="pt-3 text-sm leading-relaxed text-gray-400">
                <span className="font-medium text-white">
                  {pendingRevokeAll?.username ||
                    pendingRevokeAll?.entity ||
                    "This player"}
                </span>{" "}
                will be signed out of{" "}
                <span className="font-medium text-white">
                  {pendingRevokeAll?.deviceCount ?? 0}{" "}
                  {pendingRevokeAll?.deviceCount === 1 ? "device" : "devices"}
                </span>{" "}
                immediately, and will need to log in again.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="mt-5 flex flex-row items-center justify-end gap-2">
              <AlertDialogCancel
                disabled={Boolean(revoking)}
                className="h-9 rounded-md border-[#2A2F3A] bg-[#242B35] px-4 text-sm text-white hover:bg-[#2A2F3A] dark:border-[#2A2F3A] dark:bg-[#242B35] dark:hover:bg-[#2A2F3A]"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={Boolean(revoking)}
                onClick={(event) => {
                  // Hold the dialog open until the request resolves, so a
                  // failure leaves the operator here rather than back on a list
                  // that still shows the sessions they thought they ended.
                  event.preventDefault();
                  if (pendingRevokeAll) void handleRevokeAll(pendingRevokeAll);
                }}
                className="h-9 gap-1.5 rounded-md bg-[#F43F5E] px-4 text-sm font-medium text-white hover:bg-[#E11D48]"
              >
                {revoking ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <LogOut size={14} />
                )}
                Sign out all devices
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
