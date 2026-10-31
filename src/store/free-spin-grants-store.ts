import { create } from "zustand";
import { FreeSpin, FreeSpinGrant } from "@/types/free-spin";
import { FreeSpinAPI } from "@/api";
import toast from "react-hot-toast";

interface FreeSpinGrantsState {
  grants: FreeSpinGrant[];
  configs: FreeSpin[];           // active configs for the grant dropdown
  loadingGrants: boolean;
  loadingConfigs: boolean;
  isGranting: boolean;
  isCancelling: boolean;

  fetchGrants: (userId?: string) => Promise<void>;
  fetchActiveConfigs: () => Promise<void>;
  grantSpins: (configId: string, userId: string) => Promise<void>;
  cancelGrant: (casinoBonusId: string) => Promise<void>;

  // Real-time: called by socket listener
  prependGrant: (grant: FreeSpinGrant) => void;
  updateGrantStatus: (casinoBonusId: string, status: FreeSpinGrant["status"]) => void;
}

const extractErrorMessage = (error: unknown): string => {
  // Check various error response formats
  const errorObj = error as any;
  
  // axios/fetch error response
  if (errorObj?.response?.data?.message) {
    const msg = errorObj.response.data.message;
    return Array.isArray(msg) ? msg.join(", ") : String(msg);
  }
  
  // direct message property
  if (errorObj?.message) {
    return String(errorObj.message);
  }
  
  // error as string
  if (typeof errorObj === "string") {
    return errorObj;
  }
  
  // fallback
  return "An unexpected error occurred";
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  const extracted = extractErrorMessage(error);
  return extracted || fallback;
};

const getEnhancedErrorMessage = (error: unknown): string => {
  const statusCode = (error as any)?.response?.status;
  const message = extractErrorMessage(error);

  // Handle subscription-related errors (403)
  if (statusCode === 403) {
    if (message && message.toLowerCase().includes("subscription")) {
      return `❌ Subscription Required\n\n${message}\n\nPlease ensure the user has an active subscription plan before granting free spins.`;
    }
    return `⛔ Access Denied\n\n${message || "You don't have permission to perform this action."}`;
  }

  // Handle not found (404)
  if (statusCode === 404) {
    return `❌ Not Found\n\n${message || "The user or configuration could not be found. Please check the details and try again."}`;
  }

  // Handle bad request (400)
  if (statusCode === 400) {
    return `⚠️ Invalid Request\n\n${message || "Please check the submitted data and try again."}`;
  }

  // Handle server errors (5xx)
  if (statusCode && statusCode >= 500) {
    return `🔴 Server Error\n\nThe server encountered an error. Please try again later.\n\n${message ? `(${message})` : ""}`;
  }

  // Default: return the original message or a generic message
  return message || "❌ Failed to perform this action. Please try again.";
};

export const useFreeSpinGrantsStore = create<FreeSpinGrantsState>((set, get) => ({
  grants: [],
  configs: [],
  loadingGrants: false,
  loadingConfigs: false,
  isGranting: false,
  isCancelling: false,

  /* ================= FETCH GRANTS ================= */
  fetchGrants: async (userId) => {
    // Without a userId the endpoint returns ALL grants for ALL users.
    // Walking every page (100+ in production) floods the network and blocks
    // other API calls. Bail early — the store is always used for one player.
    if (!userId) return;

    try {
      set({ loadingGrants: true });

      // This store backs the ACTIVITY LOG, which is meant to be the complete
      // record and pages client-side. It used to take a single page of 100
      // allocations, so everything older than the newest 100 was simply never
      // fetched — the log looked short and no error was shown. The endpoint
      // caps a page at 100, so the pages are walked until the reported total is
      // covered.
      const PAGE_SIZE = 100;
      // Bounded so a bad `total` can never spin forever; 100 pages is 10k
      // allocations, far past anything the log needs to show at once.
      const MAX_PAGES = 100;

      const collected: FreeSpinGrant[] = [];
      let page = 1;
      // `total` counts ALLOCATIONS while `data` holds grant ROWS — a three-game
      // allocation is one towards the total and three rows here. Paging has to
      // be driven by the page count, never by comparing rows against the total,
      // or a page full of multi-game allocations looks complete far too early.
      let pageCount = 1;

      do {
        const res = await FreeSpinAPI.getPlayerFreeSpinGrants({
          userId,
          page,
          limit: PAGE_SIZE,
        });
        const rows = res.data ?? [];
        collected.push(...rows);
        pageCount = Math.ceil((res.total ?? 0) / PAGE_SIZE) || 1;

        // An empty page means the server has nothing more, whatever the total
        // claims.
        if (!rows.length) break;
        page += 1;
      } while (page <= pageCount && page <= MAX_PAGES);

      set({ grants: collected, loadingGrants: false });
    } catch (error) {
      console.error("Fetch free spin grants failed", error);
      set({ loadingGrants: false });
    }
  },

  /* ================= FETCH ACTIVE CONFIGS ================= */
  fetchActiveConfigs: async () => {
    try {
      set({ loadingConfigs: true });
      const data = await FreeSpinAPI.getAllFreeSpins(true);
      set({ configs: Array.isArray(data) ? data : [], loadingConfigs: false });
    } catch (error) {
      console.error("Fetch active free spin configs failed", error);
      set({ loadingConfigs: false });
    }
  },

  /* ================= GRANT ================= */
  grantSpins: async (configId, userId) => {
    set({ isGranting: true });
    try {
      const grant = await FreeSpinAPI.grantFreeSpins(configId, userId);
      // Optimistic prepend — socket will also fire but duplicate guard handles it
      set((state) => {
        const exists = state.grants.some((g) => g.id === grant.id);
        return exists ? {} : { grants: [grant, ...state.grants] };
      });
      toast.success("✅ Free spins granted successfully", {
        duration: 4000,
      });
    } catch (error) {
      const errorMessage = getEnhancedErrorMessage(error);
      console.error("[Grant Free Spins Error]", {
        config_id: configId,
        user_id: userId,
        status: (error as any)?.response?.status,
        message: errorMessage,
        raw_error: error,
      });
      toast.error(errorMessage, {
        duration: 6000,
      });
      throw error;
    } finally {
      set({ isGranting: false });
    }
  },

  /* ================= CANCEL ================= */
  cancelGrant: async (casinoBonusId) => {
    set({ isCancelling: true });
    try {
      await FreeSpinAPI.cancelFreeSpins(casinoBonusId);
      set((state) => ({
        grants: state.grants.map((g) =>
          g.sourceTransactionId === casinoBonusId
            ? { ...g, status: "cancelled" as const }
            : g
        ),
      }));
      toast.success("✅ Free spin grant cancelled successfully", {
        duration: 4000,
      });
    } catch (error) {
      const errorMessage = getEnhancedErrorMessage(error);
      console.error("[Cancel Grant Error]", {
        casino_bonus_id: casinoBonusId,
        status: (error as any)?.response?.status,
        message: errorMessage,
        raw_error: error,
      });
      toast.error(errorMessage, {
        duration: 6000,
      });
      throw error;
    } finally {
      set({ isCancelling: false });
    }
  },

  /* ================= REAL-TIME (socket) ================= */
  prependGrant: (grant) => {
    set((state) => {
      const exists = state.grants.some((g) => g.id === grant.id);
      return exists ? {} : { grants: [grant, ...state.grants] };
    });
  },

  updateGrantStatus: (casinoBonusId, status) => {
    set((state) => ({
      grants: state.grants.map((g) =>
        g.sourceTransactionId === casinoBonusId ? { ...g, status } : g
      ),
    }));
  },
}));
