import { create } from "zustand";
import toast from "react-hot-toast";
import { Banner } from "@/types/banner";
import { bannerApi } from "@/api/banners/banner";

/** Newest first. The listing is a work queue — the banner just added is the one
 *  the operator is looking for, not the one added months ago. */
const byNewest = (list: Banner[]) =>
  [...list].sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

const toBannerList = (data: unknown) =>
  byNewest(Array.isArray(data) ? (data as Banner[]) : []);

const apiMessage = (error: unknown, fallback: string) => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

interface BannerState {
  banners: Banner[];
  loading: boolean;

  fetchBanners: () => Promise<void>;
  createBanner: (data: Partial<Banner>) => Promise<void>;
  updateBanner: (id: string, data: Partial<Banner>) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  toggleActive: (id: string, isActive: boolean) => Promise<void>;
  seedDefaultBanners: () => Promise<void>;
}

export const useBannerStore = create<BannerState>((set, get) => ({
  banners: [],
  loading: false,

  /* ================= FETCH ================= */
  fetchBanners: async () => {
    try {
      set({ loading: true });

      const data = await bannerApi.getAll();

      set({
        banners: toBannerList(data),
        loading: false,
      });
    } catch (error) {
      console.error("Fetch banners failed", error);
      set({ loading: false });
      toast.error(apiMessage(error, "Failed to load banners"));
    }
  },

  /* ================= CREATE ================= */
  // Errors are re-thrown, not swallowed: the page decides what the operator
  // sees, and a silently failing save looked exactly like a successful one.
  createBanner: async (payload) => {
    try {
      await bannerApi.create(payload);
      const updated = await bannerApi.getAll();
      set({ banners: toBannerList(updated) });
    } catch (error) {
      console.error("Create banner failed", error);
      throw error;
    }
  },

  /* ================= UPDATE ================= */
  updateBanner: async (id, payload) => {
    try {
      await bannerApi.update(id, payload);
      const updated = await bannerApi.getAll();
      set({ banners: toBannerList(updated) });
    } catch (error) {
      console.error("Update banner failed", error);
      throw error;
    }
  },

  /* ================= DELETE ================= */
  deleteBanner: async (id) => {
    try {
      await bannerApi.remove(id);
      set((state) => ({
        banners: state.banners.filter((b) => b.id !== id),
      }));
    } catch (error) {
      console.error("Delete banner failed", error);
      throw error;
    }
  },

  /* ================= TOGGLE ACTIVE ================= */
  // Optimistic: the switch answers immediately, then rolls back with an error
  // toast if the server disagrees.
  toggleActive: async (id, isActive) => {
    const previous = get().banners;

    set((state) => ({
      banners: state.banners.map((b) => (b.id === id ? { ...b, isActive } : b)),
    }));

    try {
      await bannerApi.toggleActive(id, isActive);
      const banner = previous.find((b) => b.id === id);
      const label = banner?.titleEn ? `"${banner.titleEn}"` : "Banner";
      toast.success(`${label} ${isActive ? "activated" : "deactivated"}`);
    } catch (error) {
      console.error("Toggle active failed", error);
      set({ banners: previous });
      toast.error(apiMessage(error, "Failed to update banner status"));
    }
  },

  seedDefaultBanners: async () => {
    try {
      await bannerApi.seedDefaults();
      const updated = await bannerApi.getAll();
      set({ banners: toBannerList(updated) });
      toast.success("Default banners added");
    } catch (error) {
      console.error("Seed default banners failed", error);
      toast.error(apiMessage(error, "Failed to add default banners"));
    }
  },
}));
