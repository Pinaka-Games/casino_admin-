"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Smartphone,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import MessageDetailDrawer from "./components/MessageDetailDrawer";
import HistoryFiltersPanel from "./components/HistoryFiltersPanel";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import {
  listMessages,
  sortAudiences,
  type AdminMessage,
  type AdminMessageStatus,
  type MessageAudience,
  type MessageChannel,
} from "@/api/messaging/messaging.api";
import { getApiErrorMessage } from "@/api/messaging/error-message";

const CHANNEL_TABS: { label: string; value: MessageChannel | "" }[] = [
  { label: "All", value: "" },
  { label: "Message", value: "MESSAGE" },
  { label: "Mail", value: "MAIL" },
  { label: "SMS", value: "SMS" },
];

const AUDIENCE_OPTIONS: { label: string; value: MessageAudience | "all" }[] = [
  { label: "All audiences", value: "all" },
  { label: "Players", value: "PLAYER" },
  { label: "Agents", value: "AGENT" },
  { label: "Sub-Agents", value: "SUBAGENT" },
  { label: "Employees", value: "EMPLOYEE" },
];

const STATUS_OPTIONS: { label: string; value: AdminMessageStatus | "all" }[] = [
  { label: "Any status", value: "all" },
  { label: "Sent", value: "SENT" },
  { label: "Partial", value: "PARTIAL" },
  { label: "Sending", value: "SENDING" },
  { label: "Queued", value: "QUEUED" },
  { label: "Failed", value: "FAILED" },
];

/** Badge colour + short label per pool, matching the compose screen. */
const AUDIENCE_BADGE: Record<MessageAudience, string> = {
  AGENT: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  SUBAGENT: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  EMPLOYEE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  PLAYER: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

const AUDIENCE_SHORT: Record<MessageAudience, string> = {
  AGENT: "Agent",
  SUBAGENT: "Sub",
  EMPLOYEE: "Staff",
  PLAYER: "Player",
};

const statusClass = (status: AdminMessageStatus) => {
  switch (status) {
    case "SENT":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "PARTIAL":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "FAILED":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "SENDING":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    default:
      return "bg-gray-500/15 text-gray-300 border-gray-500/30";
  }
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

/** Icon and label per channel, shared by the list rows. */
const CHANNEL_META: Record<
  MessageChannel,
  { label: string; icon: typeof Mail; className: string }
> = {
  MESSAGE: {
    label: "Message",
    icon: MessageSquare,
    className: "text-purple-300",
  },
  MAIL: { label: "Mail", icon: Mail, className: "text-blue-300" },
  SMS: { label: "SMS", icon: Smartphone, className: "text-emerald-300" },
};

/** First line of the body, for the list row — mail bodies are HTML. */
const excerpt = (message: AdminMessage) => {
  const text =
    message.channel === "MAIL"
      ? message.body.replace(/<[^>]+>/g, " ")
      : message.body;
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 120)}…` : clean;
};

/**
 * Everything admins have sent, on one table — both channels.
 *
 * In-app sends previously left their only trace in the recipient's own inbox
 * and mail left none at all, so this page is the first place the question "what
 * did we send, to whom, and did it land?" can be answered.
 */
export default function SentMessagesPage() {
  const router = useRouter();

  const [rows, setRows] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [channel, setChannel] = useState<MessageChannel | "">("");
  const [audience, setAudience] = useState<MessageAudience | "all">("all");
  const [status, setStatus] = useState<AdminMessageStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selected, setSelected] = useState<AdminMessage | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /** How many panel filters are narrowing the list right now. */
  const activeFilterCount =
    (audience === "all" ? 0 : 1) +
    (status === "all" ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  // 300ms debounce, matching the other admin list pages.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMessages({
        channel: channel || undefined,
        audience: audience === "all" ? undefined : audience,
        status: status === "all" ? undefined : status,
        search: debouncedSearch,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 20,
      });
      setRows(res.data);
      setTotalPages(res.totalPages);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load sent history"));
    } finally {
      setLoading(false);
    }
  }, [channel, audience, status, debouncedSearch, dateFrom, dateTo, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // The header's global Refresh is the only refresh control now, so this page
  // has to answer it — router.refresh() alone would not refetch client state.
  useGlobalRefresh(load);

  const resetFilters = () => {
    setChannel("");
    setAudience("all");
    setStatus("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      {/* Header — this page is opened from Compose, so it leads with a way
          back there rather than a sidebar entry. Refreshing is the header's
          global button; a second one here would just be another thing to keep
          in sync. */}
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg flex items-center justify-between gap-3 shrink-0">
        <h1 className="text-base font-normal text-white">
          Notifications / Sent history
        </h1>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => router.push("/notifications/send")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to compose
        </Button>
      </div>

      {/* Toolbar — channel and search are used on nearly every visit and stay
          inline; audience, status and dates live in the right-hand panel, where
          they no longer wrap the row on a narrow window. */}
      <div className="bg-[#191D24] rounded-lg p-3 md:p-4 mb-3 md:mb-4 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search leads, matching the other list screens in the panel. */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, body or sender"
            className="h-10 flex-1 min-w-[220px] bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm outline-none"
          />

          <div className="flex gap-1 bg-[#242B35] rounded-lg p-1">
            {CHANNEL_TABS.map((t) => (
              <button
                key={t.value || "all"}
                onClick={() => {
                  setPage(1);
                  setChannel(t.value);
                }}
                className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                  channel === t.value
                    ? "bg-[#B93DEB] text-white"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            className="h-10"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
            {/* Count of what is hidden in the panel, so an active filter can
                never silently explain an empty table. */}
            {activeFilterCount > 0 && (
              <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-[#B93DEB] text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {activeFilterCount > 0 && (
            <Button variant="outline" className="h-10" onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-[#191D24] rounded-lg overflow-hidden flex flex-col">
        <div className="grid grid-cols-[110px_minmax(0,1fr)_130px_150px_160px_90px] gap-3 px-4 py-3 text-[11px] uppercase tracking-wide text-gray-400 border-b border-[#242B35] shrink-0">
          <span>Channel</span>
          <span>Subject</span>
          <span>Audience</span>
          <span>Delivery</span>
          <span>Sent</span>
          <span className="text-right">Actions</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-gray-500 text-sm p-4">Loading…</p>
          ) : rows.length === 0 ? (
            <NoData title="Nothing sent yet" />
          ) : (
            rows.map((m, i) => (
              <div
                key={m.id}
                className={`grid grid-cols-[110px_minmax(0,1fr)_130px_150px_160px_90px] gap-3 px-4 py-3 items-center ${
                  i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                }`}
              >
<span className="flex items-center gap-2 text-xs text-gray-300">
                  {(() => {
                    const meta = CHANNEL_META[m.channel];
                    const Icon = meta?.icon ?? MessageSquare;
                    return (
                      <>
                        <Icon className={`w-4 h-4 ${meta?.className ?? ""}`} />
                        {meta?.label ?? m.channel}
                      </>
                    );
                  })()}
                </span>

                <div className="min-w-0">
                  <p className="text-white text-sm truncate">{m.subject}</p>
                  <p className="text-gray-500 text-xs truncate">
                    {excerpt(m)}
                  </p>
                </div>

                <span className="text-xs text-gray-300">
                  {/* A send can span pools, so this is a list, not a value. */}
                  <span className="flex flex-wrap gap-1">
                    {sortAudiences(m.audiences ?? []).map((a) => (
                      <span
                        key={a}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${AUDIENCE_BADGE[a]}`}
                      >
                        {AUDIENCE_SHORT[a] ?? a}
                      </span>
                    ))}
                  </span>
                  <span className="block text-[11px] text-gray-500 mt-1">
                    {m.mode === "ALL" ? "everyone" : `${m.totalRecipients} picked`}
                  </span>
                </span>

                <div className="flex flex-col gap-1">
                  <span
                    className={`w-fit text-[10px] px-2 py-0.5 rounded border ${statusClass(m.status)}`}
                  >
                    {m.status}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {m.sentCount} sent
                    {m.failedCount ? ` · ${m.failedCount} failed` : ""}
                    {m.skippedCount ? ` · ${m.skippedCount} skipped` : ""}
                  </span>
                </div>

                <span className="text-xs text-gray-400">
                  {formatDate(m.createdAt)}
                  <span className="block text-[11px] text-gray-500 truncate">
                    {m.senderName ?? "—"}
                  </span>
                </span>

                <div className="text-right">
                  <button
                    onClick={() => setSelected(m)}
                    className="text-[#B93DEB] text-xs hover:underline"
                  >
                    View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[#242B35] shrink-0">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>

      <HistoryFiltersPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={{ audience, status, dateFrom, dateTo }}
        onChange={(next) => {
          setPage(1);
          if (next.audience !== undefined) setAudience(next.audience);
          if (next.status !== undefined) setStatus(next.status);
          if (next.dateFrom !== undefined) setDateFrom(next.dateFrom);
          if (next.dateTo !== undefined) setDateTo(next.dateTo);
        }}
        onReset={resetFilters}
        audienceOptions={AUDIENCE_OPTIONS}
        statusOptions={STATUS_OPTIONS}
      />

      <MessageDetailDrawer
        message={selected}
        onClose={() => setSelected(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
