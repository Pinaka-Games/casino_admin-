import api from "../config/axios.config";
export interface AgentBreezePage {
  id: string;
  agentPaymentRequestId: string;
  clientReferenceId: string;
  breezePageId?: string | null;
  status: string;
  pendingStatus?: string | null;
  amountMinor: number;
  fundingCurrency: string;
  releaseMethod: "MANUAL" | "AUTOMATIC";
  livemode: boolean;
  url?: string | null;
  payoutMethod?: string | null;
  bankAccountLast4?: string | null;
  cardLast4?: string | null;
  walletAddress?: string | null;
  customerConfirmedAtMs?: number | null;
  // Backend's own "there is a destination to pay" verdict — the same condition
  // adminReleasePage enforces. Gate the Release button on it rather than
  // re-deriving it, so the UI can't offer an action the API would reject.
  releaseReady?: boolean;
  releasedAt?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
export const agentBreezeApi = {
  createPage: (agentPaymentRequestId: string, opts?: { customerEmail?: string }) =>
    api.post<AgentBreezePage>("agent-breeze/pages", {
      agentPaymentRequestId,
      ...opts,
    }),

  // Direct agent: open a hosted Breeze page WITHOUT first creating a payout
  // request. The request is materialized server-side when Breeze reports the
  // agent linked/confirmed a payout method, so abandoning the page leaves none.
  createDraftPage: (
    amount: number,
    opts?: { note?: string; customerEmail?: string },
  ) =>
    api.post<AgentBreezePage>("agent-breeze/pages/draft", {
      amount,
      ...opts,
    }),

  // Re-pull MY in-flight Breeze pages now, instead of waiting for the webhook /
  // 5-min reconcile. Safe to call repeatedly.
  syncMine: () => api.post<{ synced: number }>("agent-breeze/pages/sync-mine"),

  getByRequest: (requestId: string) =>
    api.get<AgentBreezePage>(`agent-breeze/pages/by-request/${requestId}`),

  adminRelease: (id: string) =>
    api.post<AgentBreezePage>(`agent-breeze/pages/${id}/release`),

  adminRefresh: (id: string) =>
    api.post<AgentBreezePage>(`agent-breeze/pages/${id}/refresh`),
};
