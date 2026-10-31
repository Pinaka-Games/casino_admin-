import api from "../config/axios.config";
import { WaitlistEntry } from "@/types/waitlist";

export const waitlistApi = {
    getAll: () => api.get<WaitlistEntry[]>("/waitlist/entries"),

    updateStatus: (id: string | number, status: string) =>
        api.put(`/waitlist/entries/status/${id}`, { status }),

    getGlobalSettings: () => api.get("/waitlist/settings"),

    updateGlobalStatus: (status: string) => api.put("/waitlist/status", { status }),

    getOne: (id: string | number) => api.get<WaitlistEntry>(`/waitlist/entries/${id}`),
};
