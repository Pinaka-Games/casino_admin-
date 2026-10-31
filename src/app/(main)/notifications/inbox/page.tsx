"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import { useNotificationInboxStore } from "@/store/notification-inbox-store";
import { useClearSearchOnLeave } from "@/hooks/use-clear-search-on-leave";
import type { NotificationActorType } from "@/api/notification/agent-notification.api";

// Sender-role filter — this is the "who is it from" axis the admin filters on.
const ROLE_OPTIONS: { label: string; value: NotificationActorType | "" }[] = [
  { label: "All Roles", value: "" },
  { label: "Users", value: "USER" },
  { label: "Agents", value: "AGENT" },
  { label: "Sub-Agents", value: "SUBAGENT" },
  { label: "Admins", value: "ADMIN" },
  { label: "System", value: "SYSTEM" },
];

const roleBadgeClass = (role: string) => {
  switch (role) {
    case "USER":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "AGENT":
      return "bg-purple-500/15 text-purple-300 border-purple-500/30";
    case "SUBAGENT":
      return "bg-teal-500/15 text-teal-300 border-teal-500/30";
    case "ADMIN":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    default:
      return "bg-gray-500/15 text-gray-300 border-gray-500/30";
  }
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

export default function NotificationInboxPage() {
  const {
    rows,
    total,
    currentPage,
    pageSize,
    totalPages,
    isLoading,
    error,
    searchQuery,
    senderTypeFilter,
    unreadOnly,
    counts,
    fetchInbox,
    fetchCounts,
    setPage,
    setSearch,
    setSenderTypeFilter,
    setUnreadOnly,
    markRead,
    markAllRead,
    remove,
    clearError,
  } = useNotificationInboxStore();

  // Search text lives in a module-level store, so it survives navigation —
  // clear it on the way out or the next visit opens pre-filtered.
  useClearSearchOnLeave(() =>
    useNotificationInboxStore.setState({ searchQuery: "", currentPage: 1 }),
  );

  const [searchInput, setSearchInput] = useState(searchQuery);

  useEffect(() => {
    fetchInbox({ page: 1 });
    fetchCounts();
  }, [fetchInbox, fetchCounts]);

  // 300ms debounce, matching the other admin list pages.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== searchQuery) setSearch(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, searchQuery, setSearch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const summary = useMemo(
    () => [
      { label: "Unread", value: counts.total },
      { label: "From Users", value: counts.user },
      { label: "From Agents", value: counts.agent },
      { label: "System", value: counts.system },
    ],
    [counts],
  );

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg flex items-center justify-between shrink-0">
        <h1 className="text-base font-normal text-white">
          Notifications / Inbox
        </h1>
        <Button
          onClick={() => markAllRead()}
          disabled={counts.total === 0}
          className="bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 h-9"
        >
          Mark all read
        </Button>
      </div>

      {/* Unread summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
        {summary.map((s) => (
          <div
            key={s.label}
            className="bg-[#191D24] rounded-lg px-4 py-3 border border-[#242B35]"
          >
            <p className="text-gray-400 text-xs">{s.label}</p>
            <p className="text-white text-xl font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex flex-wrap items-center gap-3 shrink-0">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search title, message or sender"
          className="h-10 px-3 bg-[#242B35] rounded-lg text-white text-sm w-[280px] outline-none"
        />

        <Select
          value={senderTypeFilter || "all"}
          onValueChange={(v) =>
            setSenderTypeFilter(
              v === "all" ? "" : (v as NotificationActorType),
            )
          }
        >
          <SelectTrigger className="w-[200px] h-10 px-3 border-none bg-[#242B35] rounded-lg text-white text-sm">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a2030] text-white">
            {ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.value || "all"} value={o.value || "all"}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-white text-sm cursor-pointer select-none px-2">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="accent-[#B93DEB] w-4 h-4"
          />
          Unread only
        </label>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#242B35] sticky top-0 z-10">
            <tr className="text-gray-300 text-xs uppercase">
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr
                  key={`sk-${i}`}
                  className={i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}
                >
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-3 bg-[#242B35] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10">
                  <NoData title="No notifications found" />
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((n, index) => (
                <tr
                  key={n.id}
                  className={`${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  } ${!n.isRead ? "border-l-2 border-[#B93DEB]" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] border ${roleBadgeClass(
                          n.senderType,
                        )}`}
                      >
                        {n.senderType}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {n.senderName || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{n.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-sm ${
                        n.isRead ? "text-gray-300" : "text-white font-semibold"
                      }`}
                    >
                      {n.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[420px]">
                    <p className="line-clamp-2">{n.message}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(n.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {!n.isRead && (
                        <button
                          onClick={() => markRead([n.id])}
                          className="text-xs text-[#B93DEB] hover:underline"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => remove(n.id)}
                        className="text-xs text-gray-400 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 shrink-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <p className="text-gray-500 text-xs mt-2 shrink-0">
        Showing {rows.length} of {total} notifications
        {pageSize ? ` · ${pageSize} per page` : ""}
      </p>
    </div>
  );
}
