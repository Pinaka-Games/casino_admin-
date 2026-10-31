import { create } from "zustand";
import { waitlistApi } from "@/api/waitlist/waitlist.api";
import { WaitlistEntry } from "@/types/waitlist";

interface WaitlistState {
    entries: WaitlistEntry[];
    selectedEntry: WaitlistEntry | null;
    loading: boolean;
    error: string | null;

    globalStatus: string;

    // Actions
    fetchEntries: () => Promise<void>;
    fetchGlobalStatus: () => Promise<void>;
    updateGlobalStatus: (status: string) => Promise<void>;
    updateEntryStatus: (id: string | number, status: "pending" | "verified" | "approved" | "rejected" | "converted" | "blocked") => Promise<any>;
    setSelectedEntry: (entry: WaitlistEntry | null) => void;
    clearError: () => void;
}

export const useWaitlistStore = create<WaitlistState>((set, get) => ({
    entries: [],
    selectedEntry: null,
    loading: false,
    error: null,
    globalStatus: "CLOSED",

    fetchEntries: async () => {
        set({ loading: true, error: null });
        try {
            const response = await waitlistApi.getAll();
            // Map backend 'phone' to frontend 'mobileNo'
            const rawEntries = Array.isArray(response.data) ? response.data : (response.data as any).data ?? [];
            const mappedEntries = rawEntries.map((entry: any) => ({
                ...entry,
                mobileNo: entry.phone || "",
                referralCount: entry.referralCount || 0,
                isConverted: !!entry.isConverted,
            }));
            set({ entries: mappedEntries, loading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || "Failed to fetch waitlist entries",
                loading: false,
            });
        }
    },

    fetchGlobalStatus: async () => {
        try {
            const response = await waitlistApi.getGlobalSettings();
            set({ globalStatus: response.data.status });
        } catch (error) {
            console.error("Failed to fetch global status", error);
        }
    },

    updateGlobalStatus: async (status: string) => {
        set({ loading: true, error: null });
        try {
            await waitlistApi.updateGlobalStatus(status);
            set({ globalStatus: status, loading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || "Failed to update global status",
                loading: false,
            });
            throw error;
        }
    },

    updateEntryStatus: async (id, status) => {
        try {
            const response = await waitlistApi.updateStatus(id, status);

            // ✅ Only update that single entry locally
            set((state) => ({
                entries: state.entries.map((entry) =>
                    entry.id === id ? { ...entry, status } : entry
                ),
            }));

            return response.data;
        } catch (error: any) {
            set({
                error:
                    error.response?.data?.message ||
                    `Failed to update status to ${status}`,
            });
            throw error;
        }
    },


    setSelectedEntry: (entry) => {
        set({ selectedEntry: entry });
    },

    clearError: () => {
        set({ error: null });
    },
}));
