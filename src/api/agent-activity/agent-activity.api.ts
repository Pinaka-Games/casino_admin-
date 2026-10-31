import api from "../config/axios.config";

export type ActivityStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "INFO";

export type ActivitySource =
  | "DELETE_REQUEST"
  | "STATUS_REQUEST"
  | "COMMISSION_CHANGE"
  | "PAYOUT_REQUEST"
  | "REGISTRATION";

export interface ActivityItem {
  id: string;
  source: ActivitySource;
  typeLabel: string;
  actorRole: "AGENT" | "SUBAGENT" | "ADMIN" | "SYSTEM";
  actorName?: string;
  actorEmail?: string;
  subjectName?: string;
  subjectEmail?: string;
  status: ActivityStatus;
  amount?: number;
  reason?: string;
  commissions?: {
    proposed?: Record<string, number>;
    previous?: Record<string, number>;
    counter?: Record<string, number>;
  };
  createdAt: string;
  reviewedAt?: string | null;
}

export interface ActivityList {
  items: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
  truncated: boolean;
}

export const agentActivityApi = {
  list: (params?: {
    status?: ActivityStatus | "ALL";
    source?: ActivitySource;
    search?: string;
    /** Activity-date bounds, yyyy-mm-dd, inclusive of both days. */
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => api.get<ActivityList>("/agent-activity", { params }),
};
