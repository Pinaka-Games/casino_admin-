import { create } from "zustand";
import {
  getMyAgentNotifications,
  getAgentUnreadCount,
  markAgentNotificationsRead,
  markAllAgentNotificationsRead,
  deleteAgentNotification,
  AgentNotification,
} from "@/api/notification/agent-notification.api";
import { useAuthStore } from "@/store/auth-store";

interface AgentNotificationState {
  notifications: AgentNotification[];
  unreadCount: number;
  isLoading: boolean;
  page: number;
  hasMore: boolean;

  fetchNotifications: (page?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string | string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addNotification: (notification: AgentNotification) => void;
  removeNotification: (id: string) => void;
  reset: () => void;
}

export const useAgentNotificationStore = create<AgentNotificationState>(
  (set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    page: 1,
    hasMore: true,

    fetchNotifications: async (page = 1) => {
      if (useAuthStore.getState().isAuthenticated !== "authenticated") {
        set({ notifications: [], unreadCount: 0, isLoading: false, hasMore: false });
        return;
      }

      if (page === 1) set({ isLoading: true });

      try {
        const response = await getMyAgentNotifications({ page, limit: 20 });

        set((state) => ({
          notifications:
            page === 1
              ? response.data
              : [...state.notifications, ...response.data],
          page: response.page,
          hasMore: response.page < response.totalPages,
          isLoading: false,
        }));
      } catch (error: any) {
        if (error?.response?.status !== 401) {
          console.error("Failed to fetch agent notifications", error);
        }
        set({ isLoading: false });
      }
    },

    fetchUnreadCount: async () => {
      if (useAuthStore.getState().isAuthenticated !== "authenticated") {
        set({ unreadCount: 0 });
        return;
      }
      try {
        const { count } = await getAgentUnreadCount();
        set({ unreadCount: count });
      } catch (error: any) {
        if (error?.response?.status !== 401) {
          console.error("Failed to fetch agent unread count", error);
        }
      }
    },

    markAsRead: async (id: string | string[]) => {
      const ids = Array.isArray(id) ? id : [id];

      try {
        set((state) => {
          const newNotifications = state.notifications.map((n) =>
            ids.includes(n.id) ? { ...n, isRead: true } : n
          );

          const readCount = state.notifications.filter(
            (n) => ids.includes(n.id) && !n.isRead
          ).length;

          return {
            notifications: newNotifications,
            unreadCount: Math.max(0, state.unreadCount - readCount),
          };
        });

        await markAgentNotificationsRead(ids);
      } catch (error) {
        console.error("Failed to mark as read", error);
      }
    },

    markAllAsRead: async () => {
      try {
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            isRead: true,
          })),
          unreadCount: 0,
        }));

        await markAllAgentNotificationsRead();
      } catch (error) {
        console.error("Failed to mark all as read", error);
      }
    },

    deleteNotification: async (id: string) => {
      try {
        const state = get();
        const notification = state.notifications.find((n) => n.id === id);

        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount:
            notification && !notification.isRead
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
        }));

        await deleteAgentNotification(id);
      } catch (error) {
        console.error("Failed to delete notification", error);
      }
    },

    addNotification: (notification: AgentNotification) => {
      set((state) => {
        // guard against duplicate socket emits
        if (state.notifications.some((n) => n.id === notification.id)) {
          return state;
        }
        return {
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        };
      });
    },

    removeNotification: (id: string) => {
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount:
            notification && !notification.isRead
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
        };
      });
    },

    reset: () => {
      set({
        notifications: [],
        unreadCount: 0,
        page: 1,
        hasMore: true,
        isLoading: false,
      });
    },
  })
);
