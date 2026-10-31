import { create } from "zustand";
import toast from "react-hot-toast";
import {
  getMyAgentNotifications,
  getUnreadByRole,
  markAgentNotificationsRead,
  markAllAgentNotificationsRead,
  deleteAgentNotification,
  AgentNotification,
  NotificationActorType,
  UnreadByRole,
} from "@/api/notification/agent-notification.api";

/**
 * Full-page notification inbox.
 *
 * Deliberately separate from `agent-notification-store` (the header bell):
 * the bell appends pages for infinite scroll and carries no filter state,
 * while the inbox is server-paginated and replaces rows on every filter
 * change. Both read the same `/agent-notification/me` endpoint — which is
 * the current employee's own inbox, and for an admin that inbox is where
 * platform-wide user/agent events are fanned out to.
 */

interface InboxParams {
  page?: number;
  senderType?: NotificationActorType | "";
  type?: string;
  search?: string;
  isRead?: boolean;
}

interface NotificationInboxState {
  rows: AgentNotification[];
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;

  searchQuery: string;
  senderTypeFilter: NotificationActorType | "";
  typeFilter: string;
  unreadOnly: boolean;

  counts: UnreadByRole;

  fetchInbox: (params?: InboxParams) => Promise<void>;
  fetchCounts: () => Promise<void>;
  setPage: (page: number) => void;
  setSearch: (query: string) => void;
  setSenderTypeFilter: (senderType: NotificationActorType | "") => void;
  setTypeFilter: (type: string) => void;
  setUnreadOnly: (unreadOnly: boolean) => void;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const emptyCounts: UnreadByRole = {
  total: 0,
  user: 0,
  agent: 0,
  admin: 0,
  system: 0,
};

const initialState = {
  rows: [] as AgentNotification[],
  total: 0,
  currentPage: 1,
  pageSize: 15,
  totalPages: 0,
  isLoading: false,
  error: null as string | null,
  searchQuery: "",
  senderTypeFilter: "" as NotificationActorType | "",
  typeFilter: "",
  unreadOnly: false,
  counts: emptyCounts,
};

export const useNotificationInboxStore = create<NotificationInboxState>(
  (set, get) => ({
    ...initialState,

    fetchInbox: async (params?: InboxParams) => {
      set({ isLoading: true, error: null });
      try {
        const {
          currentPage,
          pageSize,
          searchQuery,
          senderTypeFilter,
          typeFilter,
          unreadOnly,
        } = get();

        const senderType =
          params?.senderType !== undefined
            ? params.senderType
            : senderTypeFilter;
        const type = params?.type !== undefined ? params.type : typeFilter;
        const onlyUnread =
          params?.isRead !== undefined ? !params.isRead : unreadOnly;

        const result = await getMyAgentNotifications({
          page: params?.page ?? currentPage,
          limit: pageSize,
          search: params?.search ?? searchQuery,
          // Empty string means "all" — omit rather than send a blank enum.
          senderType: senderType || undefined,
          type: type || undefined,
          isRead: onlyUnread ? false : undefined,
        });

        set({
          rows: result.data,
          total: result.total,
          currentPage: result.page,
          totalPages: result.totalPages,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch notifications";
        set({ isLoading: false, error: msg, rows: [], total: 0 });
      }
    },

    fetchCounts: async () => {
      try {
        const counts = await getUnreadByRole();
        set({ counts });
      } catch {
        // Counts are decorative — a failure here must not blank the inbox.
      }
    },

    setPage: (page) => {
      set({ currentPage: page });
      get().fetchInbox({ page });
    },

    setSearch: (query) => {
      set({ searchQuery: query, currentPage: 1 });
      get().fetchInbox({ search: query, page: 1 });
    },

    setSenderTypeFilter: (senderType) => {
      set({ senderTypeFilter: senderType, currentPage: 1 });
      get().fetchInbox({ senderType, page: 1 });
    },

    setTypeFilter: (type) => {
      set({ typeFilter: type, currentPage: 1 });
      get().fetchInbox({ type, page: 1 });
    },

    setUnreadOnly: (unreadOnly) => {
      set({ unreadOnly, currentPage: 1 });
      get().fetchInbox({ isRead: unreadOnly ? false : undefined, page: 1 });
    },

    markRead: async (ids) => {
      if (!ids.length) return;
      try {
        set((state) => ({
          rows: state.rows.map((n) =>
            ids.includes(n.id) ? { ...n, isRead: true } : n,
          ),
        }));
        await markAgentNotificationsRead(ids);
        await get().fetchCounts();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to mark as read",
        );
        get().fetchInbox();
      }
    },

    markAllRead: async () => {
      try {
        set((state) => ({
          rows: state.rows.map((n) => ({ ...n, isRead: true })),
          counts: emptyCounts,
        }));
        await markAllAgentNotificationsRead();
        toast.success("All notifications marked as read");
        await get().fetchCounts();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to mark all as read",
        );
        get().fetchInbox();
      }
    },

    remove: async (id) => {
      try {
        await deleteAgentNotification(id);
        toast.success("Notification deleted");
        await get().fetchInbox();
        await get().fetchCounts();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to delete notification",
        );
      }
    },

    clearError: () => set({ error: null }),
    reset: () => set(initialState),
  }),
);
