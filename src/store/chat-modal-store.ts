import { create } from "zustand";

type ChatView = "chat";

interface ChatModalState {
  open: boolean;
  view: ChatView;
  openModal: (view?: ChatView) => void;
  closeModal: () => void;
}

export const useChatModal = create<ChatModalState>((set) => ({
  open: false,
  view: "chat",

  openModal: (view = "chat") => set({ open: true, view }),
  closeModal: () => set({ open: false }),
}));
