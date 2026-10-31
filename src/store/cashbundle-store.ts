// store/cashbundle-store.ts
import { create } from "zustand";
import { CashBundle, ApiBundleResponse, CreateCashBundleDto, UpdateCashBundleDto } from "@/types/cashbundletypes";
import { cashBundleApi } from "@/api/cashbundle/cashbundle.api";
import toast from "react-hot-toast";
import { CASH_BUNDLE_FALLBACK_IMAGE } from "@/config/cashbundle-image-presets";

// Helper: Map API response to UI model
const mapApiToUi = (b: ApiBundleResponse): CashBundle => {
  const isUrl = b.icon && (b.icon.startsWith("http") || b.icon.startsWith("/") || b.icon.startsWith("blob:"));

  return {
    id: b.id,
    name: b.name,
    description: b.description,
    coins: b.wulfCoinAmount,
    free: b.bonusWulfCash,
    bonusWageringMultiplier: Number(b.bonusWageringMultiplier ?? 1),
    price: b.price,
    // Legacy bundles have no stored grant — default to price so the field shows
    // the 1:1 amount they have always issued, now editable.
    wulfCashAmount:
      b.wulfCashAmount === null || b.wulfCashAmount === undefined
        ? Number(b.price)
        : Number(b.wulfCashAmount),
    discountEnabled: Boolean(b.discountEnabled),
    discountType: b.discountType ?? null,
    discountValue: b.discountValue === null || b.discountValue === undefined
      ? null
      : Number(b.discountValue),
    discountDurationValue:
      b.discountDurationValue === null || b.discountDurationValue === undefined
        ? null
        : Number(b.discountDurationValue),
    discountDurationUnit: b.discountDurationUnit ?? null,
    discountStartedAt: b.discountStartedAt ?? null,
    promoteOnHome: Boolean(b.promoteOnHome),
    isWelcomeOffer: Boolean(b.isWelcomeOffer),
    freeSpinConfigId: b.freeSpinConfigId ?? null,
    isActive: b.isActive,
    displayOrder: b.displayOrder,
    image: isUrl ? b.icon! : CASH_BUNDLE_FALLBACK_IMAGE,
  };
};

// Helper: Map UI model to API body
export const mapUiToApiBody = (bundle: CashBundle): CreateCashBundleDto => ({
  name: bundle.name,
  description: bundle.description ?? "",
  wulfCoinAmount: Number(bundle.coins),
  bonusWulfCash: Number(bundle.free),
  bonusWageringMultiplier: Number(bundle.bonusWageringMultiplier ?? 1),
  price: Number(bundle.price),
  wulfCashAmount: Number(bundle.wulfCashAmount),
  discountEnabled: Boolean(bundle.discountEnabled),
  // Only sent when the sale is on, so a disabled sale's leftover terms never
  // reach the backend's chargeable-price validation.
  ...(bundle.discountEnabled && bundle.discountType
    ? {
      discountType: bundle.discountType,
      discountValue: Number(bundle.discountValue ?? 0),
      // Per-user window, ALWAYS sent — as a pair, and as explicit nulls when the
      // admin picks "No limit".
      //
      // These used to be omitted in the no-limit case. The update endpoint
      // patches with Object.assign, so an omitted key leaves the stored value
      // untouched: switching a live "1 hour" sale to No limit saved nothing, and
      // players kept counting down against the old window. Same failure the
      // freeSpinConfigId comment below describes — clearing a field requires
      // sending null, not sending nothing.
      //
      // Sent as a pair because the backend rejects a value without a unit, and
      // vice versa.
      ...(Number(bundle.discountDurationValue) > 0 && bundle.discountDurationUnit
        ? {
          discountDurationValue: Number(bundle.discountDurationValue),
          discountDurationUnit: bundle.discountDurationUnit,
        }
        : {
          discountDurationValue: null,
          discountDurationUnit: null,
        }),
    }
    : {}),
  // A bundle with no live discount has nothing to promote, so the flag is forced
  // off rather than left dangling for a future discount to silently switch on.
  promoteOnHome: Boolean(bundle.discountEnabled && bundle.promoteOnHome),
  // NOT gated on discountEnabled, unlike promoteOnHome above: a welcome offer
  // is the bundle itself, not its sale, so it must survive a campaign ending.
  isWelcomeOffer: Boolean(bundle.isWelcomeOffer),
  displayOrder: Number(bundle.displayOrder ?? 1),
  icon: typeof bundle.image === "string" && bundle.image.trim().length > 0
    ? bundle.image
    : CASH_BUNDLE_FALLBACK_IMAGE,
  // Always sent, including as an explicit null — that is how the wiring is
  // cleared. Omitting it would leave a removed template still attached.
  freeSpinConfigId: bundle.freeSpinConfigId ?? null,
  isActive: Boolean(bundle.isActive ?? true),
});

interface CashBundleState {
  bundles: CashBundle[];
  isLoading: boolean;
  error: string | null;
}

interface CashBundleActions {
  fetchBundles: () => Promise<void>;
  createBundle: (bundle: CashBundle) => Promise<void>;
  updateBundle: (id: string, bundle: CashBundle) => Promise<void>;
  restartDiscount: (id: string) => Promise<void>;
  /** Flip a bundle on/off without opening the edit modal. Optimistic; reverts on failure. */
  toggleActive: (id: string, isActive: boolean) => Promise<void>;
  deleteBundle: (id: string) => Promise<void>;
  reorderBundles: (ordered: CashBundle[]) => Promise<void>;
  clearError: () => void;
}

export const useCashBundleStore = create<CashBundleState & CashBundleActions>((set, get) => ({
  // STATE
  bundles: [],
  isLoading: false,
  error: null,

  // FETCH ALL BUNDLES
  fetchBundles: async () => {
    set({ isLoading: true, error: null });
    try {
      const apiData = await cashBundleApi.getAll();
      const uiData = apiData.map(mapApiToUi).sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.price - b.price;
      });
      set({ bundles: uiData, isLoading: false });
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to fetch bundles";
      set({ error: errorMessage, isLoading: false, bundles: [] });
      toast.error(errorMessage);
    }
  },

  // CREATE BUNDLE
  createBundle: async (bundle: CashBundle) => {
    set({ isLoading: true, error: null });
    try {
      const apiBody = mapUiToApiBody(bundle);
      const created = await cashBundleApi.create(apiBody);
      const createdUI = mapApiToUi(created);

      set((state) => ({
        bundles: [...state.bundles, createdUI].sort((a, b) => {
          const orderA = a.displayOrder ?? 0;
          const orderB = b.displayOrder ?? 0;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return a.price - b.price;
        }),
        isLoading: false,
      }));

      toast.success("Bundle created successfully");

      // Setting the Welcome Offer clears it from whichever bundle held it before
      // — a server-side change to a row we did not just save. Without a refetch
      // the grid would show two bundles flagged as the welcome offer until the
      // next page load.
      if (apiBody.isWelcomeOffer) {
        await get().fetchBundles();
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create bundle";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  // UPDATE BUNDLE
  updateBundle: async (id: string, bundle: CashBundle) => {
    set({ isLoading: true, error: null });
    try {
      const apiBody = mapUiToApiBody(bundle);
      const updated = await cashBundleApi.update(id, apiBody);
      const updatedUI = mapApiToUi(updated);

      set((state) => ({
        bundles: state.bundles.map((b) => (b.id === id ? updatedUI : b)).sort((a, b) => {
          const orderA = a.displayOrder ?? 0;
          const orderB = b.displayOrder ?? 0;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return a.price - b.price;
        }),
        isLoading: false,
      }));

      toast.success("Bundle updated successfully");

      // Setting the Welcome Offer clears it from whichever bundle held it before
      // — a server-side change to a row we did not just save. Without a refetch
      // the grid would show two bundles flagged as the welcome offer until the
      // next page load.
      if (apiBody.isWelcomeOffer) {
        await get().fetchBundles();
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to update bundle";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  // RESTART DISCOUNT WINDOW — revive/re-run the sale for all users from now.
  toggleActive: async (id: string, isActive: boolean) => {
    const previous = get().bundles;
    // Flip the card immediately — a round trip on every toggle makes the
    // switch feel broken. Only the flag is sent so nothing else on the row is
    // touched (a full-form PATCH could re-stamp the discount window).
    set((state) => ({
      bundles: state.bundles.map((b) => (b.id === id ? { ...b, isActive } : b)),
    }));
    try {
      const updated = await cashBundleApi.update(id, { isActive });
      const updatedUI = mapApiToUi(updated);
      set((state) => ({
        bundles: state.bundles.map((b) => (b.id === id ? updatedUI : b)),
      }));
      toast.success(isActive ? "Bundle activated" : "Bundle deactivated");
    } catch (error: any) {
      set({ bundles: previous });
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to update bundle";
      toast.error(errorMessage);
      throw error;
    }
  },

  restartDiscount: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await cashBundleApi.restartDiscount(id);
      const updatedUI = mapApiToUi(updated);
      set((state) => ({
        bundles: state.bundles
          .map((b) => (b.id === id ? updatedUI : b))
          .sort((a, b) => {
            const orderA = a.displayOrder ?? 0;
            const orderB = b.displayOrder ?? 0;
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            return a.price - b.price;
          }),
        isLoading: false,
      }));
      toast.success("Sale restarted — every user gets a fresh window from now");
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || error?.message || "Failed to restart sale";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  // DELETE BUNDLE
  deleteBundle: async (id: string) => {
    try {
      // Optimistically remove from UI first
      set((state) => ({
        bundles: state.bundles.filter((b) => b.id !== id),
      }));

      // Then delete from server
      await cashBundleApi.delete(id);

      toast.success("Bundle deleted successfully");
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to delete bundle";
      set({ error: errorMessage });
      toast.error(errorMessage);

      // Revert by re-fetching on error
      await get().fetchBundles();
      throw error;
    }
  },

  // REORDER BUNDLES — drag-and-drop position, persisted.
  //
  // Optimistic: the cards settle into their new spots immediately and only snap
  // back if the save fails. A drag that visibly "un-drops" while a request flies
  // is worse than one that occasionally reverts with an explanation.
  //
  // Re-indexes the WHOLE list rather than swapping two values, so the stored
  // order can never drift into duplicate positions — which the
  // `displayOrder ASC, price ASC` sort would then break ties on arbitrarily,
  // making a later drag appear to move the wrong card.
  //
  // Positions are 1-BASED. The bundle form treats displayOrder as a positive
  // number and rejects 0, so a 0-based first card would become unsavable: the
  // admin would open it to change something unrelated and be blocked by a
  // validation error on a field they never touched.
  reorderBundles: async (ordered: CashBundle[]) => {
    const previous = get().bundles;
    const reindexed = ordered.map((b, index) => ({ ...b, displayOrder: index + 1 }));

    set({ bundles: reindexed });

    try {
      await cashBundleApi.reorder(
        reindexed.map((b) => ({ id: b.id, displayOrder: b.displayOrder as number })),
      );
    } catch (error: any) {
      set({ bundles: previous });
      const errorMessage =
        error?.response?.data?.message || error?.message || "Failed to save bundle order";
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  },

  // CLEAR ERROR
  clearError: () => {
    set({ error: null });
  },
}));
