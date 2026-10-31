import { create } from "zustand";
import { messageTemplateApi } from "@/api/message-template/message-template.api";
import { CreateMessageTemplateDto, MessageTemplate, UpdateMessageTemplateDto } from "@/types/message-template";
import toast from "react-hot-toast";

interface State {
  templates: MessageTemplate[];
  types: string[];
  loading: boolean;
  error: string | null;

  fetchTemplates: () => Promise<void>;
  fetchTypes: () => Promise<void>;
  createTemplate: (data: CreateMessageTemplateDto) => Promise<void>;
  updateTemplate: (id: string, data: UpdateMessageTemplateDto) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  toggleActive: (id: string, isActive: boolean) => Promise<void>;
}

export const useMessageTemplateStore = create<State>((set, get) => ({
  templates: [],
  types: [],
  loading: false,
  error: null,

  fetchTemplates: async () => {
    const { loading } = get();
    if (loading) return;
    try {
      set({ loading: true });
      const res = await messageTemplateApi.getAll();
      set({ templates: res.data, loading: false });
    } catch {
      toast.error("Failed to load templates");
      set({ loading: false });
    }
  },

  fetchTypes: async () => {
    try {
      const res = await messageTemplateApi.getTypes();
      set({ types: res.data });
    } catch {
      set({ loading: false });
    }
  },

  createTemplate: async (data) => {
    try {
      await messageTemplateApi.create(data);
      await get().fetchTemplates();
  
      toast.success("Template created successfully");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create template");
      throw error;
    }
  },

  updateTemplate: async (id, data) => {
    try {
      await messageTemplateApi.update(id, data);
      await get().fetchTemplates();
  
      toast.success("Template updated successfully");
    } catch (error: any) {
      toast.error("Failed to update template");
      throw error;
    }
  },

  deleteTemplate: async (id) => {
    try {
      await messageTemplateApi.delete(id);
  
      set((state) => ({
        templates: state.templates.filter(t => t.id !== id),
      }));
  
      toast.success("Template deleted successfully");
    } catch {
      toast.error("Failed to delete template");
    }
  },

  toggleActive: async (id, isActive) => {
    try {
      await messageTemplateApi.toggleActive(id, isActive);
  
      set((state) => ({
        templates: state.templates.map(t =>
          t.id === id ? { ...t, isActive } : t
        ),
      }));
  
      toast.success(
        isActive
          ? "Template activated"
          : "Template deactivated"
      );
    } catch {
      toast.error("Failed to update status");
    }
  },
}));
