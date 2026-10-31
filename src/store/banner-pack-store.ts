import { create } from "zustand";

import { BannerPack } from "@/types/banner-pack";
import { bannerPackApi } from "@/api/bannerpack/banner-pack.api";


interface BannerPackState {
  bannerPacks: BannerPack[];

  fetchBannerPacks: () => Promise<void>;
  createBannerPack: (data: any) => Promise<void>;
  updateBannerPack: (id: string, data: any) => Promise<void>;
  deleteBannerPack: (id: string) => Promise<void>;
  toggleBannerPack: (id: string) => Promise<void>;
}

export const useBannerPackStore = create<BannerPackState>((set) => ({

  bannerPacks: [],


  /* ================= FETCH ================= */

  fetchBannerPacks: async () => {
    const res = await bannerPackApi.getAll();

    set({
      bannerPacks: res.data,
    });
  },


  /* ================= CREATE ================= */

  createBannerPack: async (data) => {
    const res = await bannerPackApi.create(data);

    set((state) => ({
      bannerPacks: [res.data, ...state.bannerPacks],
    }));
  },


  /* ================= UPDATE ================= */

  updateBannerPack: async (id, data) => {
    const res = await bannerPackApi.update(id, data);

    set((state) => ({
      bannerPacks: state.bannerPacks.map((p) =>
        p.id === id ? res.data : p
      ),
    }));
  },


  /* ================= DELETE ================= */

  deleteBannerPack: async (id) => {
    await bannerPackApi.delete(id);

    set((state) => ({
      bannerPacks: state.bannerPacks.filter((p) => p.id !== id),
    }));
  },


  /* ================= TOGGLE ================= */

  toggleBannerPack: async (id) => {
    const res = await bannerPackApi.toggle(id);

    set((state) => ({
      bannerPacks: state.bannerPacks.map((p) =>
        p.id === id ? { ...p, isActive: res.data.isActive } : p
      ),
    }));
  },
}));