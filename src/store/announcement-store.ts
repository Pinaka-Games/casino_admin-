import { create } from "zustand";
import toast from "react-hot-toast";
import {
  Announcement,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from "@/types/announcement";
import { announcementsApi } from "@/api/announcements/announcement";

/** Newest first — the announcement just published is the one being checked on. */
const byNewest = (list: unknown) =>
  (Array.isArray(list) ? (list as Announcement[]) : []).slice().sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

interface AnnouncementState {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;

  fetchAnnouncements: () => Promise<void>;
  createAnnouncement: (data: CreateAnnouncementDto) => Promise<void>;
  updateAnnouncement: (
    id: string,
    data: UpdateAnnouncementDto
  ) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;

  // ✅ NEW
  setAnnouncementActive: (id: string, isActive: boolean) => Promise<void>;

  // ✅ optional but useful
  patchLocal: (id: string, patch: Partial<Announcement>) => void;
  seedAnnouncements: () => Promise<void>;
}

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  announcements: [],
  loading: false,
  error: null,

  patchLocal: (id, patch) => {
    set((state) => ({
      announcements: state.announcements.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    }));
  },

  fetchAnnouncements: async () => {
    set({ loading: true, error: null });
    try {
      const response = await announcementsApi.getAll();
      set({ announcements: byNewest(response.data), loading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to fetch announcements";
      set({ error: message, loading: false });
      toast.error(message);
    }
  },

  createAnnouncement: async (data) => {
    set({ loading: true, error: null });
    try {
      await announcementsApi.create(data);
      await get().fetchAnnouncements();
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to create announcement",
        loading: false,
      });
      throw error;
    }
  },

  updateAnnouncement: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await announcementsApi.update(id, data);
      await get().fetchAnnouncements();
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to update announcement",
        loading: false,
      });
      throw error;
    }
  },

  deleteAnnouncement: async (id) => {
    set({ loading: true, error: null });
    try {
      await announcementsApi.delete(id);
      set((state) => ({
        announcements: state.announcements.filter((a) => a.id !== id),
        loading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to delete announcement",
        loading: false,
      });
      throw error;
    }
  },

  // ✅ TOGGLE ACTIVE (same pattern as sponsorship)
  // Toasts live here: the switch is flipped straight from a table row, with no
  // dialog in between to report what happened.
  setAnnouncementActive: async (id, isActive) => {
    const title = get().announcements.find((a) => a.id === id)?.title;
    const label = title ? `"${title}"` : "Announcement";

    try {
      await announcementsApi.update(id, { isActive });
      await get().fetchAnnouncements();
      toast.success(`${label} ${isActive ? "activated" : "deactivated"}`);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to update status";
      set({ error: message });
      toast.error(message);
      throw error;
    }
  },

  seedAnnouncements: async () => {
    try {
      await announcementsApi.seedDefaults();
      await get().fetchAnnouncements();
      toast.success("Default announcements added");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to add default announcements";
      set({ error: message });
      toast.error(message);
    }
  },
}));
