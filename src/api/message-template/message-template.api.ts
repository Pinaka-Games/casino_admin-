import api from "../config/axios.config";
import {
  MessageTemplate,
  CreateMessageTemplateDto,
  UpdateMessageTemplateDto,
} from "@/types/message-template";

const BASE = "/message-templates";

export const messageTemplateApi = {
  getAll: () =>
    api.get<MessageTemplate[]>(BASE),

  getTypes: () =>
    api.get<string[]>(`${BASE}/types`),

  create: (data: CreateMessageTemplateDto) =>
    api.post<MessageTemplate>(BASE, data),

  update: (id: string, data: UpdateMessageTemplateDto) =>
    api.patch<MessageTemplate>(`${BASE}/${id}`, data),

  delete: (id: string) =>
    api.delete(`${BASE}/${id}`),

  toggleActive: (id: string, isActive: boolean) =>
    api.patch(`${BASE}/${id}/active`, { isActive }),
};