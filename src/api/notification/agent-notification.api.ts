import api from "@/api/config/axios.config";

export type NotificationActorType =
  | "SYSTEM"
  | "ADMIN"
  | "AGENT"
  | "SUBAGENT"
  | "USER";

export interface AgentNotification {
  id: string;
  recipientId: string;
  recipientType: NotificationActorType;
  senderId: string | null;
  senderType: NotificationActorType;
  senderName: string | null;
  type: string;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  type?: string;
  senderType?: NotificationActorType;
  search?: string;
  isRead?: boolean;
}

export interface UnreadByRole {
  total: number;
  user: number;
  agent: number;
  admin: number;
  system: number;
}

export interface AgentNotificationResponse {
  data: AgentNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const getMyAgentNotifications = async (params?: NotificationQuery) => {
  // Strip undefined/empty so a blank filter never reaches the API as ""
  const clean = Object.fromEntries(
    Object.entries(params || {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );
  const response = await api.get("/agent-notification/me", { params: clean });
  return response.data as AgentNotificationResponse;
};

export const getAgentUnreadCount = async () => {
  const response = await api.get("/agent-notification/me/unread-count");
  return response.data as { count: number };
};

// Unread counts split by sender role — powers the inbox filter tabs.
export const getUnreadByRole = async () => {
  const response = await api.get("/agent-notification/me/unread-by-role");
  return response.data as UnreadByRole;
};

export const markAgentNotificationsRead = async (notificationIds: string[]) => {
  const response = await api.patch("/agent-notification/mark-read", {
    notificationIds,
  });
  return response.data;
};

export const markAllAgentNotificationsRead = async () => {
  const response = await api.patch("/agent-notification/mark-all-read");
  return response.data;
};

export const deleteAgentNotification = async (id: string) => {
  const response = await api.delete(`/agent-notification/${id}`);
  return response.data;
};

// Send a notification: Admin→Agent, Admin→Sub-agent, or Agent→(own) Sub-agent.
export const sendAgentNotification = async (payload: {
  recipientId: string;
  title: string;
  message: string;
  type?: string;
  data?: any;
  expiresAt?: string;
}) => {
  const response = await api.post("/agent-notification/send", payload);
  return response.data as AgentNotification;
};

// ---------------------------------------------------------------------------
// Player (user) notifications — admin-authored, sent outward to players.
// Separate backend controller from the staff notification routes above.
// ---------------------------------------------------------------------------

export interface PlayerRecipient {
  id: string;
  username: string;
  email: string;
}

// Search active players for the recipient picker.
export const searchPlayers = async (search?: string, limit = 50) => {
  const response = await api.get("/user-notification/recipients", {
    params: { search: search || undefined, limit },
  });
  return response.data as {
    data: PlayerRecipient[];
    total: number;
    returned: number;
  };
};

// How many active players an "everyone" send would reach.
export const getPlayerAudienceCount = async () => {
  const response = await api.get("/user-notification/audience-count");
  return response.data as { count: number };
};

export const sendUserNotification = async (payload: {
  audience: "SELECTED" | "ALL";
  userIds?: string[];
  title: string;
  message: string;
  sourceType?: string;
  data?: any;
  expiresAt?: string;
}) => {
  const response = await api.post("/user-notification/send", payload);
  return response.data as {
    audience: string;
    sent?: number;
    skipped?: number;
    requested?: number;
    queued?: boolean;
    estimatedRecipients?: number;
    message?: string;
  };
};

// Admin-only broadcast to a whole audience.
export const broadcastAgentNotification = async (payload: {
  audience: "AGENTS" | "SUBAGENTS" | "ALL";
  title: string;
  message: string;
  type?: string;
  data?: any;
  expiresAt?: string;
}) => {
  const response = await api.post("/agent-notification/broadcast", payload);
  return response.data as { sent: number };
};
