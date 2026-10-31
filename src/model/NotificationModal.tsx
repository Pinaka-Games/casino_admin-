"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { notificationcross, notificationperson } from "@/assets/icons";
import { useAgentNotificationStore } from "@/store/agent-notification-store";
import type { AgentNotification } from "@/api/notification/agent-notification.api";

type NotificationFilter = "all" | "unread" | "read";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Compact relative time, matching the player app: "Just now", "5 min ago",
// "23h ago", "3d ago", "2mo ago", "1y ago".
function formatTimeAgo(iso: string) {
  if (!iso) return "";

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

// Who sent it — surfaced so an agent can tell a platform notice from a
// message sent by their parent agent.
function senderLabel(n: AgentNotification) {
  switch (n.senderType) {
    case "ADMIN":
      return "Admin";
    case "AGENT":
      return "Your Agent";
    case "SUBAGENT":
      return "Sub-agent";
    default:
      return "System";
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const TrashIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const DoubleCheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.5 12.5l4.5 4.5 9-9" />
    <path d="M7.5 12.5l4.5 4.5 9-9" />
  </svg>
);

const BellEmptyIcon = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

// ─── Detail ───────────────────────────────────────────────────────────────────

/**
 * Full view of a single notification.
 *
 * The list truncates the message to two lines, so anything longer than a
 * sentence was previously unreadable — this is where the whole body lives.
 * Mirrors the player app's detail sheet so both products behave the same.
 */
function NotificationDetail({
  notification,
  onBack,
  onMarkRead,
  onDelete,
}: {
  notification: AgentNotification;
  onBack: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isUnread = !notification.isRead;

  const handleDelete = () => {
    onDelete(notification.id);
    // The row no longer exists, so returning to the list is the only sane
    // destination — staying here would render a deleted notification.
    onBack();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm"
        onClick={onBack}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4">
        <div className="max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-white/8 bg-[#1a1d24] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 bg-[#1d232b] px-4 py-3.5">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[13px] text-gray-400 transition-colors hover:text-white"
            >
              <ArrowLeftIcon />
              <span>Back</span>
            </button>
            <span className="text-[11px] text-gray-500">
              {formatTimeAgo(notification.createdAt)}
            </span>
          </div>

          {/* Body */}
          <div className="px-5 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative">
                <div className="h-11 w-11 overflow-hidden rounded-full ring-2 ring-white/8">
                  <Image
                    src={notificationperson}
                    alt={senderLabel(notification)}
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                </div>
                {isUnread && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1a1d24] bg-[#B93DEB]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-tight text-white">
                  {notification.title}
                </p>
                <span
                  className={`text-[11px] font-medium ${
                    isUnread ? "text-[#D08BF2]" : "text-gray-500"
                  }`}
                >
                  {isUnread ? "Unread" : "Read"}
                </span>
              </div>
            </div>

            {/* Full message — no truncation here, unlike the list row. */}
            <div className="mb-4 rounded-xl bg-[#0f1116] px-4 py-3.5">
              <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.65] text-gray-300">
                {notification.message}
              </p>
            </div>

            {/* Provenance — admin-side only; the player app has no equivalent. */}
            <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-md bg-[#B93DEB]/15 px-2 py-1 font-semibold uppercase tracking-wide text-[#D08BF2]">
                {senderLabel(notification)}
              </span>
              {notification.senderName && (
                <span className="text-gray-500">
                  from {notification.senderName}
                </span>
              )}
              <span className="rounded-md bg-white/5 px-2 py-1 text-gray-400">
                {notification.type}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {isUnread && (
                <button
                  onClick={() => onMarkRead(notification.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#B93DEB] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#a52fd6]"
                >
                  <CheckIcon />
                  Mark as Read
                </button>
              )}
              <button
                onClick={handleDelete}
                className={`flex items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-[13px] font-semibold text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 ${
                  isUnread ? "px-4" : "flex-1"
                }`}
              >
                <TrashIcon size={13} />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onOpen,
  onDelete,
  mobile,
}: {
  notification: AgentNotification;
  onOpen: (n: AgentNotification) => void;
  onDelete: (id: string) => void;
  mobile: boolean;
}) {
  const isUnread = !notification.isRead;

  return (
    <div
      // Opens the detail view. Deliberately does NOT mark as read here — the
      // row preview truncates to two lines, so a click is "I want to read
      // this", not "I have read this". Marking happens in the detail view.
      onClick={() => onOpen(notification)}
      className={[
        "group relative flex gap-3 rounded-xl px-4 py-3 my-2 cursor-pointer transition-colors duration-150",
        mobile
          ? "bg-[#1A1F2E] hover:bg-[#1e2535]"
          : "mx-3 bg-[#15181d] hover:bg-[#0d0e11]",
      ].join(" ")}
    >
      {/* Unread rail */}
      {isUnread && (
        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[#B93DEB]" />
      )}

      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className={`${mobile ? "h-10 w-10" : "h-9 w-9"} overflow-hidden rounded-full ring-2 ring-white/5`}
        >
          <Image
            src={notificationperson}
            alt={senderLabel(notification)}
            width={mobile ? 40 : 36}
            height={mobile ? 40 : 36}
            className="h-full w-full object-cover"
          />
        </div>
        {isUnread && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 bg-[#B93DEB] ${
              mobile ? "border-[#1A1F2E]" : "border-[#15181d]"
            }`}
          />
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`truncate font-semibold leading-snug ${
              mobile ? "text-[14px]" : "text-[13px]"
            } ${isUnread ? "text-white" : "text-gray-400"}`}
          >
            {notification.title}
          </h3>
          <span
            className={`shrink-0 whitespace-nowrap text-gray-500 ${
              mobile ? "text-[11px]" : "text-[10.5px]"
            }`}
          >
            {formatTimeAgo(notification.createdAt)}
          </span>
        </div>

        <p
          className={`mt-0.5 line-clamp-2 leading-snug text-gray-500 ${
            mobile ? "text-[12.5px]" : "text-[11.5px]"
          }`}
        >
          {notification.message}
        </p>

        <div className="mt-1.5 flex items-center gap-2">
          {/* Admin-only: who sent this */}
          <span
            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${
              isUnread
                ? "bg-[#B93DEB]/15 text-[#D08BF2]"
                : "bg-white/5 text-gray-500"
            }`}
          >
            {senderLabel(notification)}
          </span>

          <button
            type="button"
            title="Delete"
            aria-label="Delete notification"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            className={`ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-gray-600 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 ${
              mobile
                ? "opacity-70"
                : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
          >
            <TrashIcon size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function NotificationHeader({
  mobile,
  unreadCount,
  onClose,
  onMarkAllRead,
}: {
  mobile: boolean;
  unreadCount: number;
  onClose: () => void;
  onMarkAllRead: () => void;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between border-b border-white/5 ${
        mobile ? "bg-[#0F131A] px-4 py-4" : "bg-[#1d232b] px-4 py-3.5"
      }`}
    >
      <div className="flex items-center gap-2">
        <h2
          className={`font-semibold text-white ${
            mobile ? "text-[18px]" : "text-[16px]"
          }`}
        >
          Notification
        </h2>
        {unreadCount > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#B93DEB] px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium text-gray-400 transition-colors hover:bg-[#B93DEB]/10 hover:text-[#B93DEB]"
          >
            <DoubleCheckIcon />
            <span className="hidden sm:inline">Mark all as read</span>
            <span className="sm:hidden">Mark all</span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications"
          className={`flex cursor-pointer items-center justify-center rounded-full bg-black/60 transition-colors hover:bg-black/80 ${
            mobile ? "h-9 w-9" : "h-8 w-8"
          }`}
        >
          <Image
            src={notificationcross}
            alt=""
            width={20}
            height={20}
            className="h-4 w-4 object-contain"
          />
        </button>
      </div>
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

function NotificationTabs({
  mobile,
  active,
  onChange,
  allCount,
  unreadCount,
  readCount,
}: {
  mobile: boolean;
  active: NotificationFilter;
  onChange: (f: NotificationFilter) => void;
  allCount: number;
  unreadCount: number;
  readCount: number;
}) {
  const tabs: { id: NotificationFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: allCount },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "read", label: "Read", count: readCount },
  ];

  return (
    <div
      className={`shrink-0 px-3 pt-3 pb-1 ${
        mobile ? "bg-[#0F131A]" : "bg-[#1d232b]"
      }`}
    >
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] transition-all duration-200 ${
                isActive
                  ? "bg-[#242B35] font-bold text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-lg px-1.5 text-[10.5px] font-bold ${
                    isActive
                      ? "bg-[#B93DEB] text-white"
                      : "bg-[#B93DEB]/15 text-gray-400"
                  }`}
                >
                  {tab.count > 99 ? "99+" : tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

function NotificationList({
  mobile,
  items,
  activeFilter,
  isLoading,
  hasMore,
  onOpen,
  onDelete,
  onLoadMore,
}: {
  mobile: boolean;
  items: AgentNotification[];
  activeFilter: NotificationFilter;
  isLoading: boolean;
  hasMore: boolean;
  onOpen: (n: AgentNotification) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
}) {
  const emptyMessage =
    activeFilter === "unread"
      ? "No unread notifications"
      : activeFilter === "read"
        ? "No read notifications"
        : "You're all caught up";

  return (
    <div
      className={`admin-notif-scroll min-h-0 flex-1 overflow-y-auto ${
        mobile 
          ? "bg-[#0F131A] px-3 pb-6 pt-1" 
          : "bg-[#1d232b] py-1 md:max-lg:max-h-[55vh]"
      }`}
    >
      {items.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
          <BellEmptyIcon />
          <p className="text-[13px]">{emptyMessage}</p>
        </div>
      ) : (
        <>
          {items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onOpen={onOpen}
              onDelete={onDelete}
              mobile={mobile}
            />
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoading}
              className="mx-auto my-2 block cursor-pointer rounded-lg px-4 py-2 text-[11.5px] font-medium text-gray-400 transition-colors hover:bg-[#B93DEB]/10 hover:text-[#B93DEB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}

      {isLoading && (
        <div className="flex justify-center py-5">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#B93DEB]" />
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function NotificationModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    page,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useAgentNotificationStore();

  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Refresh history each time the center is opened.
  useEffect(() => {
    if (isOpen) fetchNotifications(1);
  }, [isOpen, fetchNotifications]);

  // Land back on "All" (and on the list, not a stale detail) next time.
  const handleClose = () => {
    setActiveFilter("all");
    setSelectedId(null);
    onClose();
  };

  // Tab counts describe the rows currently loaded, so they always agree with
  // what the list can actually show. The header badge keeps using the store's
  // server-side unread total.
  const localUnreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );
  const localReadCount = notifications.length - localUnreadCount;

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "unread") return notifications.filter((n) => !n.isRead);
    if (activeFilter === "read") return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, activeFilter]);

  // Resolved from the live array rather than held as a snapshot, so the detail
  // reflects socket updates (and flips to "Read" the moment it is marked).
  // Resolves to null if the row is deleted or drops out of the loaded page.
  const selected = selectedId
    ? (notifications.find((n) => n.id === selectedId) ?? null)
    : null;

  if (!isOpen) return null;

  const headerProps = {
    unreadCount,
    onClose: handleClose,
    onMarkAllRead: markAllAsRead,
  };

  const tabsProps = {
    active: activeFilter,
    onChange: setActiveFilter,
    allCount: notifications.length,
    unreadCount: localUnreadCount,
    readCount: localReadCount,
  };

  const listProps = {
    items: filteredNotifications,
    activeFilter,
    isLoading,
    hasMore,
    onOpen: (n: AgentNotification) => setSelectedId(n.id),
    onDelete: deleteNotification,
    onLoadMore: () => fetchNotifications(page + 1),
  };

  return (
    <>
      {/* Backdrop - Desktop only */}
      <div
        className="fixed inset-0 hidden bg-black/50 md:block md:max-lg:z-[9998] lg:z-1000"
        onClick={handleClose}
      />

      {/* Desktop dropdown */}
      <div className="fixed right-10 top-[66px] hidden flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#1a1d24] shadow-2xl md:flex md:max-lg:w-[390px] md:max-lg:z-[9999] lg:w-[400px] lg:z-1001 lg:max-h-[calc(100vh-96px)]">
        <NotificationHeader mobile={false} {...headerProps} />
        <NotificationTabs mobile={false} {...tabsProps} />
        <NotificationList mobile={false} {...listProps} />
      </div>

      {/* Mobile fullscreen */}
      <div className="fixed inset-0 z-1001 flex flex-col overflow-hidden bg-[#0F131A] md:hidden">
        <NotificationHeader mobile={true} {...headerProps} />
        <NotificationTabs mobile={true} {...tabsProps} />
        <NotificationList mobile={true} {...listProps} />
      </div>

      {/* Detail — layered above both the desktop dropdown and mobile sheet. */}
      {selected && (
        <NotificationDetail
          notification={selected}
          onBack={() => setSelectedId(null)}
          onMarkRead={markAsRead}
          onDelete={deleteNotification}
        />
      )}

      {/* Scoped globally by the unique class name so it still reaches the
          list rendered by the child component. */}
      <style jsx global>{`
        .admin-notif-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .admin-notif-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .admin-notif-scroll::-webkit-scrollbar-thumb {
          background: #2a2f3a;
          border-radius: 4px;
        }
        .admin-notif-scroll::-webkit-scrollbar-thumb:hover {
          background: #3d4455;
        }
      `}</style>
    </>
  );
}
