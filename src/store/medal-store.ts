import { create } from "zustand";
import api from "@/api/config/axios.config";
import { toast } from "react-hot-toast";

interface MedalState {
    medals: any[];
    loading: boolean;
    fetchMedals: () => Promise<void>;
    createMedal: (data: any) => Promise<boolean>;
    updateMedal: (id: string, data: any) => Promise<boolean>;
    stats: any | null;
    statsLoading: boolean;
    fetchStats: () => Promise<void>;
    leaderboard: any[];
    fetchLeaderboard: () => Promise<void>;
    achievers: any[];
    fetchAchievers: (medalId: string) => Promise<void>;
    userMedals: any[];
    userMedalsLoading: boolean;
    fetchUserMedals: (userId: string) => Promise<void>;
    deleteMedal: (id: string) => Promise<void>;
    seedMedals: () => Promise<void>;
}

export const useMedalStore = create<MedalState>((set) => ({
    medals: [],
    loading: false,
    stats: null,
    statsLoading: false,
    leaderboard: [],
    achievers: [],
    userMedals: [],
    userMedalsLoading: false,
    fetchMedals: async () => {
        set({ loading: true });
        try {
            const response = await api.get("/getall-medals");
            set({ medals: response.data, loading: false });
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to fetch medals");
            set({ loading: false });
        }
    },
    fetchStats: async () => {
        set({ statsLoading: true });
        try {
            const response = await api.get("/get-stats");
            set({ stats: response.data, statsLoading: false });
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to fetch stats");
            set({ statsLoading: false });
        }
    },
    fetchLeaderboard: async () => {
        try {
            const response = await api.get("/leaderboard");
            set({ leaderboard: response.data });
        } catch (error: any) {
            toast.error("Failed to fetch leaderboard");
        }
    },
    fetchAchievers: async (medalId) => {
        try {
            const response = await api.get(`/medals/${medalId}/achievers`);
            set({ achievers: response.data });
        } catch (error: any) {
            toast.error("Failed to fetch achievers");
        }
    },
    fetchUserMedals: async (userId) => {
        set({ userMedalsLoading: true });
        try {
            const response = await api.get(`/medals/user/${userId}`);
            set({ userMedals: response.data, userMedalsLoading: false });
        } catch (error: any) {
            toast.error("Failed to fetch user medals");
            set({ userMedalsLoading: false });
        }
    },
    createMedal: async (data) => {
        try {
            await api.post("/create-medals", data);
            toast.success("Medal created successfully");
            const { fetchMedals } = useMedalStore.getState();
            await fetchMedals();
            return true;
        } catch (error: any) {
            const msg = error.response?.data?.message || "Failed to create medal";
            toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
            return false;
        }
    },
    updateMedal: async (id, data) => {
        try {
            await api.patch(`/medals/${id}`, data);
            toast.success("Medal updated successfully");
            const { fetchMedals } = useMedalStore.getState();
            await fetchMedals();
            return true;
        } catch (error: any) {
            const msg = error.response?.data?.message || "Failed to update medal";
            toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
            return false;
        }
    },
    deleteMedal: async (id) => {
        try {
            await api.delete(`/medals/${id}`);
            toast.success("Medal deleted successfully");
            const { fetchMedals } = useMedalStore.getState();
            await fetchMedals();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to delete medal");
        }
    },
    seedMedals: async () => {
        try {
            await api.post("/medals/seed");
            toast.success("Medals seeded successfully");
            const { fetchMedals } = useMedalStore.getState();
            await fetchMedals();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to seed medals");
        }
    },
}));
