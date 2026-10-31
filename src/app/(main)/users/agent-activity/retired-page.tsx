"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import UsDateInput from "@/components/UsDateInput";
import { Loader2, Search, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { connectSocket } from "@/lib/socket";
import {
  agentActivityApi,
  ActivityItem,
  ActivitySource,
  ActivityStatus,
} from "@/api/agent-activity/agent-activity.api";

const STATUS_TABS: { label: string; value: ActivityStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Completed", value: "COMPLETED" },
];

const SOURCE_FILTERS: { label: string; value: ActivitySource | "ALL" }[] = [
  { label: "All types", value: "ALL" },
  { label: "Delete", value: "DELETE_REQUEST" },
  { label: "Status", value: "STATUS_REQUEST" },
  { label: "Commission", value: "COMMISSION_CHANGE" },
  { label: "Payout", value: "PAYOUT_REQUEST" },
  { label: "Registration", value: "REGISTRATION" },
];

const STATUS_BADGE: Record<ActivityStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  REJECTED: "bg-red-500/10 text-red-300 border-red-500/30",
  COMPLETED: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  INFO: "bg-gray-500/10 text-gray-300 border-gray-500/30",
};

const SOURCE_BADGE: Record<ActivitySource, string> = {
  DELETE_REQUEST: "bg-red-500/10 text-red-300 border-red-500/30",
  STATUS_REQUEST: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  COMMISSION_CHANGE: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  PAYOUT_REQUEST: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  REGISTRATION: "bg-sky-500/10 text-sky-300 border-sky-500/30",
};

const ROLE_LABEL: Record<ActivityItem["actorRole"], string> = {
  AGENT: "Agent",
  SUBAGENT: "Sub-Agent",
  ADMIN: "Admin",
  SYSTEM: "System",
};

export default function AgentActivityPage() {
  const [tab, setTab] = useState<ActivityStatus | "ALL">("ALL");
  const [source, setSource] = useState<ActivitySource | "ALL">("ALL");
  const [search, setSearch] = useState("");
  // Activity-date bounds; the API applies them before the feed is capped and
  // paged, so a range cannot silently miss older rows.
  const [from_, setFrom] = useState("");
  const [to_, setTo] = useState("");
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentActivityApi.list({
        status: tab === "ALL" ? undefined : tab,
        source: source === "ALL" ? undefined : source,
        search: search.trim() || undefined,
        from: from_ || undefined,
        to: to_ || undefined,
        limit: 100,
      });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
      setTruncated(!!res.data.truncated);
    } catch {
      toast.error("Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [tab, source, search, from_, to_]);

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh — delete flow emits sub-agent-ticket:changed, commission flow
  // emits agent-activity:changed. Both nudge a refetch.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    const s = connectSocket();
    const handler = () => loadRef.current();
    s.on("sub-agent-ticket:changed", handler);
    s.on("agent-activity:changed", handler);
    return () => {
      s.off("sub-agent-ticket:changed", handler);
      s.off("agent-activity:changed", handler);
    };
  }, []);

  const fmt = (d?: string | null) =>
    d
      ? new Date(d).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <div className="min-h-full w-full bg-[#15181E] p-6">
      <div className="bg-[#191D24] mb-4 px-4 py-3 rounded-lg flex items-center justify-between">
        <h1 className="text-sm text-white">Dashboard / All Activity</h1>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Tabs + filters + search */}
      <div className="bg-[#191D24] rounded-lg px-3 py-2 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.value
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as ActivitySource | "ALL")}
            className="h-9 rounded-md bg-[#242B35] border-none px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
          >
            {SOURCE_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <UsDateInput
              value={from_}
              onChange={setFrom}
              className="h-10 rounded-lg border border-white/10 bg-[#242B35] px-3 flex items-center text-sm text-white"
            />
            <span className="text-[11px] uppercase tracking-wider text-white/40">to</span>
            <UsDateInput
              value={to_}
              onChange={setTo}
              className="h-10 rounded-lg border border-white/10 bg-[#242B35] px-3 flex items-center text-sm text-white"
            />
            {(from_ || to_) && (
              <button
                type="button"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                className="rounded-lg bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wider text-white/60 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
              size={14}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username / email / id"
              className="h-9 w-[240px] rounded-md bg-[#242B35] border-none pl-8 pr-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            />
          </div>
        </div>
      </div>

      {truncated && (
        <div className="mb-3 text-[11px] text-amber-300/80 px-1">
          Showing the most recent activity per type — older records are capped.
          Narrow with search or filters to find specific entries.
        </div>
      )}

      {/* Table */}
      <div className="bg-[#191D24] rounded-lg overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Reason / Note</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <Loader2 className="animate-spin text-purple-400 inline" size={24} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500 text-sm">
                  No activity found
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-800/60 hover:bg-[#1a2030] text-xs"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${SOURCE_BADGE[r.source]}`}
                    >
                      {r.typeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-300">{r.actorName ?? "—"}</div>
                    <div className="text-gray-500 text-[10px]">
                      {ROLE_LABEL[r.actorRole]}
                      {r.actorEmail ? ` · ${r.actorEmail}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{r.subjectName ?? "—"}</div>
                    <div className="text-gray-500">{r.subjectEmail ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_BADGE[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono">
                    {r.amount != null ? Number(r.amount).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-[280px]">
                    <span className="line-clamp-3">{r.reason || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    <div>{fmt(r.createdAt)}</div>
                    {r.reviewedAt && (
                      <div className="text-gray-600 text-[10px]">
                        reviewed {fmt(r.reviewedAt)}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && rows.length > 0 && (
        <div className="mt-2 text-[11px] text-gray-500 px-1">
          Showing {rows.length} of {total} activity records
        </div>
      )}
    </div>
  );
}
