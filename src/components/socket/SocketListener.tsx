"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { useTournamentStore } from "@/store/tournament-store";
import { useFreeSpinGrantsStore } from "@/store/free-spin-grants-store";
import { useAgentNotificationStore } from "@/store/agent-notification-store";
import { useRouter } from "next/navigation";

export default function SocketListener({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, refreshMe, logout } = useAuthStore();
  const { fetchTournaments } = useTournamentStore();

  useEffect(() => {
    if (isAuthenticated !== "authenticated") return;

    disconnectSocket();
    const s = connectSocket();

    // Access changed while this session is open (a role gained/lost permissions,
    // or this employee's roles were re-assigned). Re-read /auth/me so the menu,
    // route guards and buttons reflect the new access immediately — the whole
    // point being that nobody has to hit refresh to find out.
    const onPermissionsUpdated = async (payload: any) => {
      const names: string[] = Array.isArray(payload?.permissions)
        ? payload.permissions.filter(Boolean)
        : [];
      const roleName: string | undefined = payload?.roleName;

      // Name what changed rather than saying "something did". Long lists get
      // trimmed so the toast stays a toast.
      const list =
        names.length > 3
          ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more`
          : names.join(", ");

      const message = (() => {
        switch (payload?.reason) {
          case "role_permissions_added":
            return names.length
              ? `New access granted: ${list}`
              : "New access granted to your role";
          case "role_permissions_removed":
            return names.length
              ? `Access removed: ${list}`
              : "Some access was removed from your role";
          case "role_status_changed":
            return `Your role${roleName ? ` "${roleName}"` : ""} was updated`;
          case "role_deleted":
            return `Your role${roleName ? ` "${roleName}"` : ""} was deleted`;
          case "role_added":
            return `You were added to the role${roleName ? ` "${roleName}"` : ""}`;
          case "role_removed":
            return `You were removed from the role${roleName ? ` "${roleName}"` : ""}`;
          case "roles_changed":
            return "Your roles were updated";
          default:
            return "Your permissions were updated";
        }
      })();

      // Keyed on the emit timestamp: reconnect re-delivery or a double render
      // cannot stack the same notice twice. Without a timestamp there is
      // nothing stable to key on, and the old constant fallback ("now") made
      // every later change reuse the first toast's slot — a second change
      // within the toast's lifetime silently updated it instead of announcing
      // itself, which read as "no toast appeared".
      toast.success(
        message,
        payload?.at ? { id: `permissions-${payload.at}` } : undefined,
      );

      await refreshMe();
      router.refresh();
    };

    const forceLogout = async (msg: string) => {
      toast.error(msg);
      disconnectSocket();
      await logout(); 
      router.replace("/login"); 
    };

    const onAccountUpdated = async (payload: any) => {
      if (payload?.isActive === false) {
        await forceLogout(
          payload?.message ||
            "Your account has been deactivated. Please contact admin.",
        );
        return;
      }
      await refreshMe();
    };

    const onAccountDeleted = async () => {
      await forceLogout("Your account was deleted");
    };

    const onRaffleTicketUpdated = (payload: any) => {
      window.dispatchEvent(new CustomEvent("raffle:ticket-updated", { detail: payload }));
    };

    const onRaffleDrawCompleted = (payload: any) => {
      window.dispatchEvent(new CustomEvent("raffle:draw-completed", { detail: payload }));
    };

    const onFreeSpinGranted = (payload: any) => {
      window.dispatchEvent(new CustomEvent("free-spin:granted", { detail: payload }));
    };

    const onFreeSpinUpdated = (payload: any) => {
      const status = String(payload?.status ?? "").toLowerCase() as
        | "granted"
        | "completed"
        | "cancelled"
        | "expired";
      const casinoBonusId = payload?.casinoBonusId ?? payload?.casino_bonus_id;
      const store = useFreeSpinGrantsStore.getState();
      if (casinoBonusId && status) {
        store.updateGrantStatus(casinoBonusId, status);
      }
      // NOTE: Do NOT call store.fetchGrants() here without a userId.
      // It walks every page of the grants endpoint (100+ requests in production)
      // and fires on EVERY page — including reports — flooding the network and
      // causing report API timeouts. The per-grant updateGrantStatus above
      // already handles the real-time update. The full re-fetch only runs from
      // FreeSpinGrantSection when a specific player's grants are being viewed.
    };

    const onVaultAdminUpdated = (payload: any) => {
      window.dispatchEvent(new CustomEvent("vault:admin-updated", { detail: payload }));
    };

    const onTournamentStatusChanged = (payload: any) => {
      // Refresh data silently to avoid double toasts with manual actions
      fetchTournaments();
    };

    // Race settle finished / status changed in the worker → let the race page refetch.
    const onRaceChanged = (payload: any) => {
      window.dispatchEvent(new CustomEvent("race:refresh", { detail: payload }));
    };

    // --- Agent / sub-agent notification center (admin:{employeeId} room) ---
    //
    // A new notification ALWAYS updates the bell/inbox silently. It only pops a
    // toast when it is a directed human message worth interrupting for — never
    // for system fan-out events (deposit/redeem/kyc/payout/aml/auto-block).
    //
    // Why: those fan-out events go to every admin and are usually triggered by
    // the admin's OWN action, which already showed its own success toast. Auto-
    // toasting them stacked 2-3 toasts on one click. The badge + inbox are the
    // right surface for them; the toast is reserved for someone deliberately
    // messaging THIS user.
    const TOASTABLE_TYPES = new Set([
      "MESSAGE",
      "ANNOUNCEMENT",
      "SYSTEM_MAINTENANCE",
      "PROMOTION",
    ]);
    const onAgentNotificationNew = (payload: any) => {
      const n = payload?.notification;
      if (n) {
        useAgentNotificationStore.getState().addNotification(n);

        // Read the current user from the store (not a closed-over value) so
        // this handler never forces the socket effect to re-subscribe.
        const myId = useAuthStore.getState().user?.id;
        const isDirected = TOASTABLE_TYPES.has(n.type);
        const isSelfSent = n.senderId && myId && n.senderId === myId;
        if (isDirected && !isSelfSent) {
          // Stable id keyed on the notification → the same notification can
          // never toast twice (reconnect re-emit, double render, etc.).
          toast.success(n.title, { id: `agent-notif-${n.id}` });
        }
      }
      if (typeof payload?.unreadCount === "number") {
        useAgentNotificationStore.setState({ unreadCount: payload.unreadCount });
      }
    };

    const onAgentNotificationRead = (payload: any) => {
      const ids: string[] = payload?.notificationIds ?? [];
      if (!ids.length) return;
      useAgentNotificationStore.setState((state) => ({
        notifications: state.notifications.map((n) =>
          ids.includes(n.id) ? { ...n, isRead: true } : n,
        ),
        unreadCount: Math.max(
          0,
          state.unreadCount -
            state.notifications.filter((n) => ids.includes(n.id) && !n.isRead)
              .length,
        ),
      }));
    };

    const onAgentNotificationAllRead = () => {
      useAgentNotificationStore.setState((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    };

    const onAgentNotificationDeleted = (payload: any) => {
      if (payload?.id) {
        useAgentNotificationStore.getState().removeNotification(payload.id);
      }
    };

    // 🔄 Resync after a dropped connection.
    //
    // Socket.IO restores the transport on its own but does NOT replay events
    // that fired while we were offline (laptop sleep, wifi blip, deploy), so
    // new redeem/payout requests raised in that window never reach this tab —
    // they sit invisible behind a stale badge.
    //
    // Count only, deliberately. The bell store's fetchNotifications(1) resets
    // its paginated list, so calling it here would yank an admin mid-scroll
    // back to page 1 (and flip isLoading, disabling "Load more"). It is also
    // redundant: NotificationModal already refetches page 1 every time it
    // opens, so the list self-heals the moment it is looked at. The full-page
    // inbox (useNotificationInboxStore) is intentionally not touched — it
    // carries filter/page state and importing it here would make every admin
    // fetch an inbox they may never open.
    //
    // Listens on the *manager* (`s.io`), not the socket: manager "reconnect"
    // fires only after a lost connection is re-established, never on the first
    // connect. `s.on("connect")` fires on both, so it would double-fetch on
    // mount against the fetchUnreadCount() seed below.
    const onReconnect = () => {
      void useAgentNotificationStore.getState().fetchUnreadCount();
    };

    s.on("agent-notification:new", onAgentNotificationNew);
    s.on("agent-notification:read", onAgentNotificationRead);
    s.on("agent-notification:all-read", onAgentNotificationAllRead);
    s.on("agent-notification:deleted", onAgentNotificationDeleted);
    s.io.on("reconnect", onReconnect);

    s.on("permissions:updated", onPermissionsUpdated);
    s.on("account:updated", onAccountUpdated);
    s.on("account:deleted", onAccountDeleted); 
    s.on("raffle:ticket-updated", onRaffleTicketUpdated);
    s.on("raffle:draw-completed", onRaffleDrawCompleted);
    s.on("tournament:status-changed", onTournamentStatusChanged);
    s.on("race:changed", onRaceChanged);
    s.on("race:completed", onRaceChanged);
    s.on("race:status-changed", onRaceChanged);
    s.on("race:participants-updated", onRaceChanged);
    s.on("free-spin:granted", onFreeSpinGranted);
    s.on("free-spin:updated", onFreeSpinUpdated);
    s.on("vault:admin-updated", onVaultAdminUpdated);

    // debug (optional)
    s.on("connect", () => console.log("✅ socket connected:", s.id));
    s.on("connect_error", (err: any) =>
      console.log("❌ socket connect_error:", err?.message, err),
    );
    s.on("disconnect", (reason) =>
      console.log("⚠️ socket disconnected:", reason),
    );

    // Seed the bell badge for this session.
    useAgentNotificationStore.getState().fetchUnreadCount();

    return () => {
      s.off("agent-notification:new", onAgentNotificationNew);
      s.off("agent-notification:read", onAgentNotificationRead);
      s.off("agent-notification:all-read", onAgentNotificationAllRead);
      s.off("agent-notification:deleted", onAgentNotificationDeleted);
      s.io.off("reconnect", onReconnect);
      s.off("permissions:updated", onPermissionsUpdated);
      s.off("account:updated", onAccountUpdated);
      s.off("account:deleted", onAccountDeleted); 
      s.off("raffle:ticket-updated", onRaffleTicketUpdated);
      s.off("raffle:draw-completed", onRaffleDrawCompleted);
      s.off("tournament:status-changed", onTournamentStatusChanged);
      s.off("race:changed", onRaceChanged);
      s.off("race:completed", onRaceChanged);
      s.off("race:status-changed", onRaceChanged);
      s.off("race:participants-updated", onRaceChanged);
      s.off("free-spin:granted", onFreeSpinGranted);
      s.off("free-spin:updated", onFreeSpinUpdated);
      s.off("vault:admin-updated", onVaultAdminUpdated);
    };
  }, [isAuthenticated, refreshMe, logout, router, fetchTournaments]);

  return <>{children}</>;
}
