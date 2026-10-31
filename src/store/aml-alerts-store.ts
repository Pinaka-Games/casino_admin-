import { create } from "zustand";
import {
  assignAmlAlert,
  escalateAmlAlert,
  getAmlAlert,
  listAmlAlerts,
  updateAmlAlertStatus,
  type AmlAlertRow,
  type AmlAlertListParams,
  type AmlAlertStatus,
  type AmlSeverity,
} from "@/api/compliance/aml.api";

interface AmlFilters {
  search: string;
  status: string;
  severity: string;
  assignedTo: string;
}

interface AmlAlertsState {
  rows: AmlAlertRow[];
  total: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  isDetailsLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AmlFilters;
  appliedFilters: AmlAlertListParams;
  selected: AmlAlertRow | null;
}

interface AmlAlertsActions {
  fetchList: (params?: AmlAlertListParams) => Promise<void>;
  applyFilters: () => Promise<void>;
  setPage: (page: number) => void;
  setFilter: <K extends keyof AmlFilters>(key: K, value: AmlFilters[K]) => void;
  fetchDetails: (id: string) => Promise<AmlAlertRow | null>;
  setSelected: (row: AmlAlertRow | null) => void;
  changeStatus: (id: string, status: AmlAlertStatus) => Promise<void>;
  assign: (id: string, assignedTo: string) => Promise<void>;
  escalate: (id: string, body?: { summary?: string; priority?: AmlSeverity }) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

type AmlAlertsStore = AmlAlertsState & AmlAlertsActions;

const initialFilters: AmlFilters = {
  search: "",
  status: "",
  severity: "",
  assignedTo: "",
};

const initialState: AmlAlertsState = {
  rows: [],
  total: 0,
  currentPage: 1,
  pageSize: 10,
  isLoading: false,
  isDetailsLoading: false,
  isMutating: false,
  error: null,
  filters: initialFilters,
  appliedFilters: { page: 1, limit: 10 },
  selected: null,
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null) {
    const responseMessage = (error as { response?: { data?: { message?: unknown } } })
      .response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
};

const buildParams = (filters: AmlFilters, page: number, limit: number): AmlAlertListParams => ({
  page,
  limit,
  search: filters.search.trim() || undefined,
  status: filters.status.trim() || undefined,
  severity: filters.severity.trim() || undefined,
  assignedTo: filters.assignedTo.trim() || undefined,
});

export const useAmlAlertsStore = create<AmlAlertsStore>((set, get) => ({
  ...initialState,

  fetchList: async (params?: AmlAlertListParams) => {
    set({ isLoading: true, error: null });
    try {
      const { appliedFilters, currentPage, pageSize } = get();
      const payload: AmlAlertListParams = {
        ...appliedFilters,
        page: params?.page ?? currentPage,
        limit: params?.limit ?? pageSize,
        ...params,
      };

      const result = await listAmlAlerts(payload);

      set({
        rows: result.rows || [],
        total: result.total || 0,
        currentPage: result.page || payload.page || 1,
        appliedFilters: {
          ...payload,
          page: result.page || payload.page || 1,
          limit: result.limit || payload.limit || pageSize,
        },
        isLoading: false,
        error: null,
      });
    } catch (err) {
      set({
        rows: [],
        total: 0,
        isLoading: false,
        error: getErrorMessage(err, "Failed to fetch AML alerts"),
      });
    }
  },

  applyFilters: async () => {
    const { filters, pageSize } = get();
    const next = buildParams(filters, 1, pageSize);
    set({ currentPage: 1, appliedFilters: next });
    await get().fetchList(next);
  },

  setPage: (page: number) => {
    set({ currentPage: page });
    void get().fetchList({ ...get().appliedFilters, page });
  },

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  fetchDetails: async (id: string) => {
    set({ isDetailsLoading: true, error: null });
    try {
      const details = await getAmlAlert(id);
      set({ selected: details, isDetailsLoading: false });
      return details;
    } catch (err) {
      set({
        isDetailsLoading: false,
        error: getErrorMessage(err, "Failed to load AML alert details"),
      });
      return null;
    }
  },

  setSelected: (row) => set({ selected: row }),

  // Apply a mutation, patch the row in the list + the open detail, keep counts fresh.
  changeStatus: async (id, status) => {
    set({ isMutating: true, error: null });
    try {
      const updated = await updateAmlAlertStatus(id, status);
      patchRow(set, get, updated);
    } catch (err) {
      set({ error: getErrorMessage(err, "Failed to update status") });
      throw err;
    } finally {
      set({ isMutating: false });
    }
  },

  assign: async (id, assignedTo) => {
    set({ isMutating: true, error: null });
    try {
      const updated = await assignAmlAlert(id, assignedTo);
      patchRow(set, get, updated);
    } catch (err) {
      set({ error: getErrorMessage(err, "Failed to assign alert") });
      throw err;
    } finally {
      set({ isMutating: false });
    }
  },

  escalate: async (id, body) => {
    set({ isMutating: true, error: null });
    try {
      await escalateAmlAlert(id, body);
      // Escalation flips status to ESCALATED server-side; refresh the row.
      const refreshed = await getAmlAlert(id);
      patchRow(set, get, refreshed);
    } catch (err) {
      set({ error: getErrorMessage(err, "Failed to escalate alert") });
      throw err;
    } finally {
      set({ isMutating: false });
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}));

function patchRow(
  set: (partial: Partial<AmlAlertsState>) => void,
  get: () => AmlAlertsStore,
  updated: AmlAlertRow,
) {
  const { rows, selected } = get();
  set({
    rows: rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
    selected: selected && selected.id === updated.id ? { ...selected, ...updated } : selected,
  });
}
