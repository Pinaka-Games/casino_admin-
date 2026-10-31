import {
  Announcement,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from "@/types/announcement";
import api from "../config/axios.config";
export const announcementsApi = {
  getAll: () => api.get<Announcement[]>("/announcements"),

  getOne: (id: string) => api.get<Announcement>(`/announcements/${id}`),

  create: (data: CreateAnnouncementDto) =>
    api.post<Announcement>("/announcements", data),

  update: (id: string, data: UpdateAnnouncementDto) =>
    api.patch<Announcement>(`/announcements/${id}`, data),

  delete: (id: string) =>
    api.delete(`/announcements/${id}`),

  setActive: (id: string, data: { isActive: boolean }) =>
    api.patch<Announcement>(`/announcements/${id}`, data),

  seedDefaults: async () => {
    const res = await api.post("/announcements/announcementseed");
    return res.data;
  },
};
