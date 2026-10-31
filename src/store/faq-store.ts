import { create } from "zustand";
import toast from "react-hot-toast";
import { faqApi } from "@/api/faq/faq.api";
import { FAQ, SetFaqActiveDto } from "@/types/faq";

/** Newest first — the FAQ just added is the one being looked for. */
const byNewest = (list: unknown) =>
  (Array.isArray(list) ? (list as FAQ[]) : []).slice().sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

const apiMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

interface FAQState {
  faqs: FAQ[];
  /** First-load only. Mutations refresh silently so the table never collapses
   *  into a full-panel spinner just because a switch was flipped. */
  loading: boolean;
  error: string | null;

  fetchFaqs: (options?: { silent?: boolean }) => Promise<void>;
  createFaq: (data: Partial<FAQ>) => Promise<void>;
  updateFaq: (id: string, data: Partial<FAQ>) => Promise<void>;
  deleteFaq: (id: string) => Promise<void>;
  setFaqActive: (id: string, data: SetFaqActiveDto) => Promise<void>;
  seedDefaultFaqs: () => Promise<void>;
}

export const useFaqStore = create<FAQState>((set, get) => ({
  faqs: [],
  loading: true,
  error: null,

  fetchFaqs: async ({ silent } = {}) => {
    try {
      if (!silent) set({ loading: true });
      set({ error: null });

      const res = await faqApi.getAll();
      set({ faqs: byNewest(res.data) });
    } catch (error: any) {
      const message = apiMessage(error, "Failed to load FAQs");
      set({ error: message });
      toast.error(message);
    } finally {
      set({ loading: false });
    }
  },

  // Mutations re-read the list silently: the rows are already on screen and the
  // caller shows a toast, so swapping them for a spinner is pure flicker.
  createFaq: async (data) => {
    await faqApi.create(data);
    await get().fetchFaqs({ silent: true });
  },

  updateFaq: async (id, data) => {
    await faqApi.update(id, data);
    await get().fetchFaqs({ silent: true });
  },

  deleteFaq: async (id) => {
    await faqApi.delete(id);
    await get().fetchFaqs({ silent: true });
  },

  seedDefaultFaqs: async () => {
    try {
      set({ loading: true });
      await faqApi.seedDefaults();
      await get().fetchFaqs({ silent: true });
      toast.success("Default FAQs added");
    } catch (error: any) {
      const message = apiMessage(error, "Failed to add default FAQs");
      console.error("Seed failed", error);
      set({ error: message });
      toast.error(message);
    } finally {
      set({ loading: false });
    }
  },

  /* ✅ toggle active */
  // Toasts live here: the switch is flipped straight from a table row, with no
  // dialog in between to report what happened.
  setFaqActive: async (id, data) => {
    const question = get().faqs.find((f) => f.id === id)?.questionEn;
    const label = question ? `"${question}"` : "FAQ";

    // optimistic update
    set((state) => ({
      faqs: state.faqs.map((f) =>
        f.id === id ? { ...f, isActive: data.isActive } : f
      ),
    }));

    try {
      await faqApi.setActive(id, data);
      toast.success(`${label} ${data.isActive ? "activated" : "deactivated"}`);
    } catch (error: any) {
      // rollback on failure
      await get().fetchFaqs({ silent: true });
      toast.error(apiMessage(error, "Failed to update FAQ status"));
      throw error;
    }
  },
}));
