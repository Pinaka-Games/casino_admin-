import api from "../config/axios.config";
import { buildCoinflowReturnUrl } from "@/lib/coinflow-return";
import type { CoinflowWithdrawSpeed } from "@/app/agent-management/components/coinflow-payout-rails";

export interface AgentCoinflowPayout {
  id: string;
  agentPaymentRequestId: string;
  clientReferenceId: string;
  coinflowSessionId?: string | null;
  status: string;
  pendingStatus?: string | null;
  amountMinor: number;
  fundingCurrency: string;
  releaseMethod: "MANUAL" | "AUTOMATIC";
  livemode: boolean;
  // Hosted Coinflow withdraw URL — embedded in an iframe so the requester can
  // link a bank account, debit card or on-chain wallet.
  url?: string | null;
  payoutMethod?: string | null;
  /** Coinflow rail the requester chose (only a bank account has a choice). */
  payoutSpeed?: string | null;
  last4?: string | null;
  walletAddress?: string | null;
  transactionHash?: string | null;
  customerConfirmedAtMs?: number | null;
  releasedAt?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmAgentCoinflowPayoutBody {
  account?: string;
  payoutMethod?: string;
  walletAddress?: string;
  withdrawalId?: string;
  // Rail the requester chose. Kept server-side only when the destination they
  // linked supports it — a US bank is the one kind with a real choice.
  payoutSpeed?: CoinflowWithdrawSpeed;
}

// A destination the requester linked with Coinflow (from Get Withdrawer). `type`
// is a canonical backend token — BANK_ACCOUNT | IBAN | CARD | PAYPAL | VENMO |
// PIX | EFT | INTERAC — kept as a plain string so a new Coinflow rail cannot
// break the build.
export interface AgentCoinflowPayoutMethod {
  type: string;
  token: string;
  last4?: string | null;
  label: string;
  /** Rails this destination can be released over, default first. */
  speeds?: CoinflowWithdrawSpeed[];
  /**
   * False when Coinflow still returns the destination but it can no longer be
   * paid to — the single-slot wallet rails (PayPal, Venmo) come back flagged
   * once the link is dropped or replaced. Listed so it can be re-linked rather
   * than vanishing; never selectable. Undefined on older responses = available.
   */
  available?: boolean;
}

export interface AgentCoinflowPayoutMethodsResponse {
  methods: AgentCoinflowPayoutMethod[];
  /** True only for an APPROVED Coinflow verification. */
  verified: boolean;
  verificationStatus?:
    | "pending"
    | "partial-approval"
    | "approved"
    | "rejected"
    | "expired"
    | null;
  /** Coinflow answered 451 — the requester must verify before any payout. */
  verificationRequired?: boolean;
  verificationLink?: string | null;
  /**
   * Set when the lookup failed for a reason that is ours (credentials, Coinflow
   * down). Distinct from "nothing linked yet", which is an empty list, no error.
   */
  error?: string | null;
}

export const agentCoinflowApi = {
  // Create (or reuse) the hosted Coinflow payout page for a request.
  // successReturnUrl is attached HERE rather than at each call site: it is the
  // same value every time, and the one place a caller could forget it is the one
  // that leaves the agent stranded wherever the server's fallback points.
  createPayout: (
    agentPaymentRequestId: string,
    opts?: { customerEmail?: string; fundingCurrency?: string },
  ) =>
    api.post<AgentCoinflowPayout>("agent-coinflow/payouts", {
      agentPaymentRequestId,
      successReturnUrl: buildCoinflowReturnUrl(),
      ...opts,
    }),

  // Direct agent: open a hosted Coinflow page WITHOUT first creating a payout
  // request. The agent payment request is created only when confirm() links a
  // real destination, so abandoning the form leaves no empty request.
  createDraftPayout: (
    amount: number,
    opts?: { note?: string; customerEmail?: string; fundingCurrency?: string },
  ) =>
    api.post<AgentCoinflowPayout>("agent-coinflow/payouts/draft", {
      amount,
      successReturnUrl: buildCoinflowReturnUrl(),
      ...opts,
    }),

  // Confirm the destination the requester linked in the hosted page. The account
  // token/method are resolved server-side, so the body is usually empty.
  confirm: (payoutId: string, body: ConfirmAgentCoinflowPayoutBody = {}) =>
    api.post<AgentCoinflowPayout>(
      `agent-coinflow/payouts/${payoutId}/confirm`,
      body,
    ),

  // The destinations the requester has linked, so they can choose WHICH one gets
  // paid and (for a bank account) how fast, instead of the backend silently
  // taking whichever Coinflow listed first.
  getMethods: (payoutId: string) =>
    api.get<AgentCoinflowPayoutMethodsResponse>(
      `agent-coinflow/payouts/${payoutId}/methods`,
    ),

  // Unlink a destination at Coinflow; answers with the refreshed list.
  deleteMethod: (payoutId: string, token: string) =>
    api.delete<AgentCoinflowPayoutMethodsResponse>(
      `agent-coinflow/payouts/${payoutId}/methods/${encodeURIComponent(token)}`,
    ),

  getByRequest: (requestId: string) =>
    api.get<AgentCoinflowPayout>(
      `agent-coinflow/payouts/by-request/${requestId}`,
    ),

  adminRelease: (id: string) =>
    api.post<AgentCoinflowPayout>(`agent-coinflow/payouts/${id}/release`),

  adminRefresh: (id: string) =>
    api.post<AgentCoinflowPayout>(`agent-coinflow/payouts/${id}/refresh`),
};
