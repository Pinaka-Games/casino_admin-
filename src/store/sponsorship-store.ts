// store/sponsorship-store.ts
import { create } from "zustand";
import toast from "react-hot-toast";
import type {
  Sponsorship,
  CreateSponsorshipDto,
  UpdateSponsorshipDto,
  SetSponsorshipActiveDto,
} from "@/types/sponsorship";
import { sponsorshipApi } from "@/api/sponsorship/sponsorship";

/** Newest first — the entry just added is the one being looked for. */
const byNewest = (list: unknown) =>
  (Array.isArray(list) ? (list as Sponsorship[]) : []).slice().sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

const apiMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

interface SponsorshipState {
  sponsorships: Sponsorship[];
  /** First-load only. Mutations refresh silently so the page never blanks out
   *  behind a full-screen spinner just because a switch was flipped. */
  loading: boolean;
  error: string | null;

  fetchSponsorships: (options?: { silent?: boolean }) => Promise<void>;
  createSponsorship: (data: CreateSponsorshipDto) => Promise<void>;
  updateSponsorship: (id: string, data: UpdateSponsorshipDto) => Promise<void>;
  deleteSponsorship: (id: string) => Promise<void>;

  setSponsorshipActive: (
    id: string,
    data: SetSponsorshipActiveDto
  ) => Promise<void>;

  patchLocal: (id: string, patch: Partial<Sponsorship>) => void;
  getById: (id: string) => Sponsorship | undefined;
  seedDefaults: () => Promise<void>;
}

export const useSponsorshipStore = create<SponsorshipState>((set, get) => ({
  sponsorships: [],
  loading: false,
  error: null,

  patchLocal: (id, patch) => {
    set((state) => ({
      sponsorships: state.sponsorships.map((s) =>
        s.id === id ? ({ ...s, ...patch } as Sponsorship) : s
      ),
    }));
  },

  getById: (id) => get().sponsorships.find((s) => s.id === id),

  fetchSponsorships: async ({ silent } = {}) => {
    if (!silent) set({ loading: true });
    set({ error: null });

    try {
      const response = await sponsorshipApi.getAll();
      set({ sponsorships: byNewest(response.data), loading: false });
    } catch (error: any) {
      const message = apiMessage(error, "Failed to fetch sponsorships");
      set({ error: message, loading: false });
      toast.error(message);
    }
  },

  // Mutations re-read the list silently: the rows are already on screen and the
  // caller shows a toast, so swapping them for a spinner is pure flicker.
  createSponsorship: async (data) => {
    set({ error: null });
    try {
      await sponsorshipApi.create(data);
      await get().fetchSponsorships({ silent: true });
    } catch (error: any) {
      set({ error: apiMessage(error, "Failed to create sponsorship") });
      throw error;
    }
  },

  updateSponsorship: async (id, data) => {
    set({ error: null });
    try {
      await sponsorshipApi.update(id, data);
      await get().fetchSponsorships({ silent: true });
    } catch (error: any) {
      set({ error: apiMessage(error, "Failed to update sponsorship") });
      throw error;
    }
  },

  deleteSponsorship: async (id) => {
    set({ error: null });
    try {
      await sponsorshipApi.delete(id);
      set((state) => ({
        sponsorships: state.sponsorships.filter((s) => s.id !== id),
      }));
    } catch (error: any) {
      set({ error: apiMessage(error, "Failed to delete sponsorship") });
      throw error;
    }
  },

  setSponsorshipActive: async (id, data) => {
    set({ error: null });
    try {
      await sponsorshipApi.setActive(id, data);
      await get().fetchSponsorships({ silent: true });
    } catch (error: any) {
      set({ error: apiMessage(error, "Failed to update status") });
      throw error;
    }
  },

  seedDefaults: async () => {
    set({ loading: true, error: null });

    try {
      await sponsorshipApi.seedDefaults();
      await get().fetchSponsorships({ silent: true });
      toast.success("Default sponsorships added");
    } catch (error: any) {
      const message = apiMessage(error, "Failed to seed sponsorship defaults");
      set({ error: message });
      toast.error(message);
    } finally {
      set({ loading: false });
    }
  },
}));
