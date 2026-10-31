import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { profileApi } from "@/api/users/users";
import { toast } from "react-hot-toast";
import {
  agentPaymentApi,
  AgentPaymentRequest,
  AgentPaymentStatus,
} from "@/api/agent-payment/agent-payment.api";

const AGENT_PAYMENT_SOURCE = "AGENT_PAYMENT";

const mapAgentPaymentStatus = (s: AgentPaymentStatus): string => {
  switch (s) {
    // Sub-agent waiting for parent / sub-agent waiting to add payment details:
    // both should show as PENDING in admin queue — admin can't act yet, no
    // Complete button should appear.
    case AgentPaymentStatus.PENDING_AGENT:
    case AgentPaymentStatus.AGENT_APPROVED:
    case AgentPaymentStatus.PENDING_ADMIN:
      return "PENDING";
    // Legacy two-step flow only — admin pre-approved, needs explicit Complete.
    case AgentPaymentStatus.ADMIN_APPROVED:
      return "APPROVED";
    case AgentPaymentStatus.COMPLETED:
      return "COMPLETED";
    case AgentPaymentStatus.REJECTED_BY_AGENT:
    case AgentPaymentStatus.REJECTED_BY_ADMIN:
      return "REJECTED";
    default:
      return s;
  }
};

const mapAgentPaymentToLegacy = (r: AgentPaymentRequest) => ({
  id: r.id,
  claimType: "AGENT",
  amount: Number(r.amount),
  status: mapAgentPaymentStatus(r.status),
  rawStatus: r.status,
  createdAt: r.createdAt,
  username: r.requester?.username,
  referrerUsername: r.requester?.username,
  subAgent: r.requester
    ? { username: r.requester.username, email: r.requester.email }
    : undefined,
  paymentMethod: r.paymentMethod,
  paymentDetails: r.paymentDetails,
  // Server verdict on whether a real, confirmed payout destination exists (see
  // hasPayoutDestination in the agent-listing page). paymentDetails alone can't
  // tell an abandoned or failed provider payout from a payable one.
  payoutReady: r.payoutReady,
  payoutBlockReason: r.payoutBlockReason,
  payoutProviderStatus: r.payoutProviderStatus,
  payoutReleaseError: r.payoutReleaseError,
  // Needed to tell a real agent rejection from a system close (self-cancel,
  // superseded, unfinished form) — all are stored as REJECTED_BY_AGENT.
  rejectionReason: r.rejectionReason,
  _source: AGENT_PAYMENT_SOURCE,
});

export type PayoutTabStatus = "ALL" | "PENDING" | "PROCESSING" | "APPROVED" | "COMPLETED" | "REJECTED";

interface PayoutRequestState {
  requests: any[];
  isLoading: boolean;
  error: string | null;
  activeTab: PayoutTabStatus;
  searchQuery: string;
  
  // Modal states
  openPayoutRequests: boolean;
  selectedPayoutReq: any | null;
  payoutDetailOpen: boolean;
}

interface PayoutRequestActions {
  /** `silent` skips the loading state — for socket-driven background refreshes. */
  fetchRequests: (opts?: { silent?: boolean }) => Promise<void>;
  setActiveTab: (tab: PayoutTabStatus) => void;
  setSearchQuery: (query: string) => void;
  
  // Modal Actions
  setOpenPayoutRequests: (open: boolean) => void;
  setSelectedPayoutReq: (req: any | null) => void;
  setPayoutDetailOpen: (open: boolean) => void;
  
  // Payout Actions
  handlePayoutAction: (claimId: string, action: "APPROVE" | "REJECT" | "COMPLETE") => Promise<void>;
}

type PayoutRequestStore = PayoutRequestState & PayoutRequestActions;

const initialState: PayoutRequestState = {
  requests: [],
  isLoading: false,
  error: null,
  activeTab: "PENDING",
  searchQuery: "",
  
  openPayoutRequests: false,
  selectedPayoutReq: null,
  payoutDetailOpen: false,
};

export const usePayoutRequestStore = create<PayoutRequestStore>()(
  devtools((set, get) => ({
    ...initialState,

    fetchRequests: async (opts) => {
      if (!opts?.silent) set({ isLoading: true, error: null });
      try {
        const [claimsRes, agentPayRes] = await Promise.allSettled([
          profileApi.getAllClaims(1, 500),
          agentPaymentApi.adminList({ page: 1, limit: 500 }),
        ]);

        const legacy =
          claimsRes.status === "fulfilled"
            ? claimsRes.value.data?.data || []
            : [];
        const agentPay =
          agentPayRes.status === "fulfilled"
            ? (agentPayRes.value.data?.items || []).map(mapAgentPaymentToLegacy)
            : [];

        const merged = [...agentPay, ...legacy].sort((a, b) => {
          const at = new Date(a.createdAt || 0).getTime();
          const bt = new Date(b.createdAt || 0).getTime();
          return bt - at;
        });

        set({ requests: merged, isLoading: false });
      } catch (err: any) {
        set({
          isLoading: false,
          error: err?.message || "Failed to fetch payout requests",
          requests: [],
        });
      }
    },

    setActiveTab: (tab) => set({ activeTab: tab }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setOpenPayoutRequests: (open) => set({ openPayoutRequests: open }),
    
    setSelectedPayoutReq: (req) => set({ selectedPayoutReq: req }),
    
    setPayoutDetailOpen: (open) => set({ payoutDetailOpen: open }),

    handlePayoutAction: async (claimId, action) => {
      const item = get().requests.find((r) => r.id === claimId);
      const isAgentPayment = item?._source === AGENT_PAYMENT_SOURCE;
      let requestPromise: Promise<any>;

      if (isAgentPayment) {
        if (action === "APPROVE") {
          requestPromise = agentPaymentApi.adminApprove(claimId);
        } else if (action === "REJECT") {
          requestPromise = agentPaymentApi.adminReject(claimId, "Admin rejection");
        } else {
          requestPromise = agentPaymentApi.adminComplete(claimId);
        }
      } else if (action === "APPROVE") {
        requestPromise = profileApi.adminApprovePayout(claimId);
      } else if (action === "REJECT") {
        requestPromise = profileApi.adminRejectPayout(claimId, "Admin rejection");
      } else {
        requestPromise = profileApi.adminCompletePayout(claimId);
      }

      await toast.promise(requestPromise, {
        loading: `${action.toLowerCase()}ing request...`,
        success: () => {
          get().fetchRequests();
          set({ payoutDetailOpen: false });
          return `Request ${action.toLowerCase()}ed successfully`;
        },
        error: (err) => {
          // A refused action usually means the request moved on underneath the
          // open modal — e.g. a Breeze page under the auto-release threshold
          // paid out and completed it. Reload so the modal shows the real
          // status (and drops the now-invalid buttons) instead of a stale one.
          void get()
            .fetchRequests()
            .then(() => {
              const fresh = get().requests.find((r) => r.id === claimId);
              if (fresh && get().selectedPayoutReq?.id === claimId) {
                set({ selectedPayoutReq: fresh });
              }
            });
          return err?.response?.data?.message || "Action failed";
        },
      });
    },

  }), { name: "PayoutRequestStore" })
);
