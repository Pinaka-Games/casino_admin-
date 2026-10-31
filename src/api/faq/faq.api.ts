import api from "../config/axios.config";
import { FAQ, SetFaqActiveDto } from "@/types/faq";

export const faqApi = {
  getAll: () => api.get<FAQ[]>("/faqs"),

  create: (data: Partial<FAQ>) =>
    api.post<FAQ>("/faqs", data),

  update: (id: string, data: Partial<FAQ>) =>
    api.patch<FAQ>(`/faqs/${id}`, data),

  delete: (id: string) =>
    api.delete(`/faqs/${id}`),

  setActive: (id: string, data: SetFaqActiveDto) =>
    api.patch<FAQ>(`/faqs/${id}`, data),
  
  seedDefaults: () =>
    api.post("/faqs/faqseed"),
};