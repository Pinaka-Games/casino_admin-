// api/sponsorship/sponsorship.ts
import api from "../config/axios.config";
import type {
  Sponsorship,
  CreateSponsorshipDto,
  UpdateSponsorshipDto,
  SetSponsorshipActiveDto,
} from "@/types/sponsorship";

export const sponsorshipApi = {
  getAll: () => api.get<Sponsorship[]>("/sponsorship"),
  getOne: (id: string) => api.get<Sponsorship>(`/sponsorship/${id}`),

  create: (data: CreateSponsorshipDto) =>
    api.post<Sponsorship>("/sponsorship", data),
  update: (id: string, data: UpdateSponsorshipDto) =>
    api.patch<Sponsorship>(`/sponsorship/${id}`, data),

  delete: (id: string) => api.delete(`/sponsorship/${id}`),

  // ✅ backend will implement later
  setActive: (id: string, data: SetSponsorshipActiveDto) =>
    api.patch<Sponsorship>(`/sponsorship/${id}/active`, data),

  seedDefaults: () => api.post("/sponsorship/sponsorshipseed"),
};
