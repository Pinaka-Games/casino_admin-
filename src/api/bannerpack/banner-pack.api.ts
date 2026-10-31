import api from "../config/axios.config";

import {
  BannerPack,
  CreateBannerPackDto,
  UpdateBannerPackDto,
} from "@/types/banner-pack";

export const bannerPackApi = {

  /* ================= GET ALL ================= */

  getAll: () =>
    api.get<BannerPack[]>("/banner-packs"),

  getPublicPacks: () =>
    api.get<BannerPack[]>("/banner-packs/public"),

  /* ================= GET ONE ================= */

  getOne: (id: string) =>
    api.get<BannerPack>(`/banner-packs/${id}`),

  /* ================= CREATE ================= */

  create: (data: CreateBannerPackDto) =>
    api.post<BannerPack>("/banner-packs", data),

  /* ================= UPDATE ================= */

  update: (id: string, data: UpdateBannerPackDto) =>
    api.patch<BannerPack>(`/banner-packs/${id}`, data),

  /* ================= DELETE ================= */

  delete: (id: string) =>
    api.delete(`/banner-packs/${id}`),

  /* ================= FOLDERS ================= */

  createFolder: (packId: string, name: string) =>
    api.post(`/banner-packs/${packId}/folders`, { name }),

  deleteFolder: (folderId: string) =>
    api.delete(`/banner-packs/folders/${folderId}`),

  updateFolder: (folderId: string, name: string) =>
    api.patch(`/banner-packs/folders/${folderId}`, { name }),

  getFolders: (packId: string) =>
    api.get(`/banner-packs/${packId}/folders`),

  getDetails: (id: string) =>
    api.get<BannerPack>(`/banner-packs/${id}/details`),

  /* ================= TOGGLE ACTIVE ================= */

  toggle: (id: string) =>
    api.patch(`/banner-packs/${id}/toggle`),

  /* ================= DOWNLOAD ================= */

  download: (id: string) =>
    api.get(`/banner-packs/${id}/download`, {
      responseType: "blob",
    }),

  /* ================= UPLOAD FILE ================= */

  uploadFiles: (packId: string, files: File[], folderId?: string) => {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });
    
    if (folderId) formData.append("folderId", folderId);

    return api.post(
      `/banner-packs/${packId}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },

  deleteFile: (fileId: string) =>
    api.delete(`/banner-packs/files/${fileId}`),

  downloadFileBlob: (fileId: string) =>
    api.get(`/banner-packs/files/${fileId}/download`, {
      responseType: "blob",
    }),

};