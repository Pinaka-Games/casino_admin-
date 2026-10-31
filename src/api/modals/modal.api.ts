import api from "../config/axios.config";

/** Audience visibility for a managed modal. */
export type ModalAudience = "all" | "guest" | "authenticated";

/** Behavior config for one existing promotional modal. */
export interface AdminModal {
  id: string;
  key: string;
  title: string;
  description: string | null;
  audience: ModalAudience;
  /** Seconds to wait after the previous modal closes before showing this one. */
  delaySeconds: number;
  displayOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Patchable fields (order is persisted via reorder, not here). */
export interface UpdateModalPayload {
  title?: string;
  description?: string;
  audience?: ModalAudience;
  delaySeconds?: number;
  enabled?: boolean;
}

/** Human-readable labels for the audience options. */
export const AUDIENCE_OPTIONS: { value: ModalAudience; label: string; hint: string }[] = [
  { value: "all", label: "Both", hint: "Guests and logged-in players" },
  { value: "authenticated", label: "Authenticated", hint: "Only logged-in players" },
  { value: "guest", label: "Guest", hint: "Only logged-out visitors" },
];

/** All managed modals, in display order. */
export const getModals = async (): Promise<AdminModal[]> =>
  (await api.get<AdminModal[]>("/modals")).data;

/** Persist the display sequence (ids in the desired order). */
export const reorderModals = async (ids: string[]) =>
  (await api.put("/modals/reorder", { ids })).data;

/** Update a single modal's behavior. */
export const updateModal = async (id: string, data: UpdateModalPayload): Promise<AdminModal> =>
  (await api.patch<AdminModal>(`/modals/${id}`, data)).data;
