"use client";

import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { connectSocket, onSocketInstance } from "@/lib/socket";

export type PresenceState = {
  isOnline: boolean;
  /** ISO string. Only sent when an account goes offline. */
  lastSeenAt?: string | null;
};

export type PresenceMap = Record<string, PresenceState>;

type PresenceEvent = {
  employeeId?: string;
  userId?: string;
  isOnline?: boolean;
  lastSeenAt?: string | null;
};

/**
 * Live online/offline state for every kind of account, keyed by id.
 *
 * Agents, sub-agents and admins arrive on `presence:employee`; players on
 * `presence:user`. Both are kept in one map — the ids are UUIDs from separate
 * tables and never collide — so a screen listing either kind reads it the same
 * way.
 *
 * The listings still render whatever the API returned for the first paint;
 * this supplies OVERRIDES for accounts whose state has changed since, so the
 * Online Status column moves on its own instead of waiting for a refresh:
 *
 *   const { isOnline, lastSeenAt } = resolvePresence(presence, row.id, row);
 *
 * `onResync` fires after a dropped connection is restored. Socket.IO does not
 * replay events missed while the tab was offline, so the overrides and the
 * rows underneath them are both stale at that point — the overrides are
 * dropped here and the caller should refetch.
 */
export function usePresence(onResync?: () => void) {
  const [presence, setPresence] = useState<PresenceMap>({});

  // Kept in a ref so callers can pass an inline arrow without re-subscribing
  // the socket on every render. Written in an effect, not during render.
  const onResyncRef = useRef(onResync);
  useEffect(() => {
    onResyncRef.current = onResync;
  });

  useEffect(() => {
    const onPresence = (payload: PresenceEvent) => {
      const id = payload?.employeeId || payload?.userId;
      if (!id) return;
      const next: PresenceState = {
        isOnline: Boolean(payload?.isOnline),
        lastSeenAt: payload?.lastSeenAt ?? null,
      };
      setPresence((prev) => {
        const current = prev[id];
        if (
          current &&
          current.isOnline === next.isOnline &&
          current.lastSeenAt === next.lastSeenAt
        ) {
          return prev;
        }
        return { ...prev, [id]: next };
      });
    };

    const resync = () => {
      setPresence({});
      onResyncRef.current?.();
    };

    // Re-bound whenever SocketListener replaces the connection, otherwise this
    // page keeps listening to a socket that was thrown away when the session
    // resolved — and the column would go back to needing a refresh.
    let bound: Socket | null = null;

    const detach = () => {
      bound?.off("presence:employee", onPresence);
      bound?.off("presence:user", onPresence);
      bound?.io.off("reconnect", resync);
      bound = null;
    };

    const attach = (socket: Socket) => {
      detach();
      bound = socket;
      socket.on("presence:employee", onPresence);
      socket.on("presence:user", onPresence);
      socket.io.on("reconnect", resync);
    };

    attach(connectSocket());
    const unsubscribe = onSocketInstance((socket) => {
      attach(socket);
      // A fresh connection means events fired in the gap were missed.
      resync();
    });

    return () => {
      detach();
      unsubscribe();
    };
  }, []);

  return presence;
}

/** Live presence for one account, falling back to what the API returned. */
export function resolvePresence(
  presence: PresenceMap,
  id?: string,
  fallback?: {
    isOnline?: boolean;
    onlineStatus?: string;
    lastSeenAt?: string | Date | null;
  } | null,
): PresenceState {
  const live = id ? presence[id] : undefined;
  if (live) {
    return {
      isOnline: live.isOnline,
      // A live "online" carries no timestamp; keep the stored one so the row
      // still has something to show if they go offline before the next fetch.
      lastSeenAt: live.lastSeenAt ?? toIso(fallback?.lastSeenAt),
    };
  }

  return {
    isOnline:
      String(fallback?.onlineStatus ?? "").toLowerCase() === "online" ||
      Boolean(fallback?.isOnline),
    lastSeenAt: toIso(fallback?.lastSeenAt),
  };
}

function toIso(value?: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
