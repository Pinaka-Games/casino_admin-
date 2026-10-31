import api from "../config/axios.config";
import { Banner } from "@/types/banner";

const BASE = "/banners";

export const bannerApi = {
  getAll: async (): Promise<Banner[]> => {
    const res = await api.get<Banner[]>(BASE);
    return res.data;
  },

  create: async (payload: Partial<Banner>): Promise<Banner> => {
    const res = await api.post(BASE, payload);
    return res.data;
  },

  update: async (id: string, payload: Partial<Banner>): Promise<Banner> => {
    const res = await api.patch(`${BASE}/${id}`, payload);
    return res.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },

  toggleActive: async (id: string, isActive: boolean): Promise<void> => {
    await api.patch(`${BASE}/${id}/active`, { isActive });
  },

  seedDefaults: async () => {
    await api.post(`${BASE}/bannerseed`);
  },
};