import api from "../config/axios.config";
import { ApiBundleResponse, CreateCashBundleDto, UpdateCashBundleDto } from "@/types/cashbundletypes";

export const cashBundleApi = {
  // GET ALL BUNDLES
  getAll: async (): Promise<ApiBundleResponse[]> => {
    const response = await api.get("/coin-bundles/all");
    return response.data;
  },

  // GET ONE BUNDLE
  getOne: async (id: string): Promise<ApiBundleResponse> => {
    const response = await api.get(`/coin-bundles/${id}`);
    return response.data;
  },

  // CREATE BUNDLE
  create: async (data: CreateCashBundleDto): Promise<ApiBundleResponse> => {
    const response = await api.post("/coin-bundles/create", data);
    return response.data;
  },

  // UPDATE BUNDLE
  update: async (id: string, data: UpdateCashBundleDto): Promise<ApiBundleResponse> => {
    const response = await api.patch(`/coin-bundles/${id}`, data);
    return response.data;
  },

  // DELETE BUNDLE
  delete: async (id: string): Promise<void> => {
    await api.delete(`/coin-bundles/${id}`);
  },

  // RESTART DISCOUNT WINDOW — force a fresh per-user campaign start from now.
  restartDiscount: async (id: string): Promise<ApiBundleResponse> => {
    const response = await api.post(`/coin-bundles/${id}/discount/restart`);
    return response.data;
  },

  // BULK REORDER — persists the drag-and-drop sequence.
  //
  // Sends the WHOLE list with its new indexes rather than just the moved card:
  // the server then never has to infer the resulting sequence, and two admins
  // reordering at once produce one coherent order instead of a half-merge.
  reorder: async (
    updates: { id: string; displayOrder: number }[],
  ): Promise<{ success: boolean; updated: number }> => {
    const response = await api.put("/coin-bundles/reorder", { updates });
    return response.data;
  },
};
