import { create } from "zustand";
import toast from "react-hot-toast";
import {
  deleteRule,
  getAllRules,
  getPersonalizationStatus,
  getRuleWithGames,
  getRulesBySegmentType,
  updatePersonalizationStatus,
  upsertRule,
  type PersonalizationRule,
  type PersonalizationRuleWithGames,
  type SegmentType,
} from "@/api/personalization/personalization.api";

const getRuleKey = (segmentType: SegmentType, segmentValue: string) =>
  `${segmentType}:${segmentValue}`;

const getErrorMessage = (error: unknown, fallback: string): string => {
  const raw = (error as any)?.response?.data?.message;
  if (Array.isArray(raw)) return raw.join(", ");
  if (typeof raw === "string") return raw;
  return fallback;
};

interface PersonalizationState {
  rules: PersonalizationRule[];
  rulesBySegmentType: Partial<Record<SegmentType, PersonalizationRule[]>>;
  ruleGamesByKey: Record<string, PersonalizationRuleWithGames>;
  personalizationEnabled: boolean;
  loading: boolean;
  loadingStatus: boolean;
  loadingRulesBySegmentType: Partial<Record<SegmentType, boolean>>;
  loadingRuleGamesByKey: Record<string, boolean>;
  saving: boolean;
  savingStatus: boolean;

  fetchStatus: () => Promise<boolean>;
  updateStatus: (enabled: boolean) => Promise<boolean>;
  fetchAllRules: (segmentType?: SegmentType) => Promise<PersonalizationRule[]>;
  fetchRulesBySegmentType: (
    segmentType: SegmentType
  ) => Promise<PersonalizationRule[]>;
  fetchRuleWithGames: (
    segmentType: SegmentType,
    segmentValue: string
  ) => Promise<PersonalizationRuleWithGames>;
  saveRule: (
    segmentType: SegmentType,
    segmentValue: string,
    gameIds: string[]
  ) => Promise<PersonalizationRule>;
  removeRule: (id: string) => Promise<void>;
}

export const usePersonalizationStore = create<PersonalizationState>(
  (set, get) => ({
    rules: [],
    rulesBySegmentType: {},
    ruleGamesByKey: {},
    personalizationEnabled: true,
    loading: false,
    loadingStatus: false,
    loadingRulesBySegmentType: {},
    loadingRuleGamesByKey: {},
    saving: false,
    savingStatus: false,

    fetchStatus: async () => {
      try {
        set({ loadingStatus: true });
        const status = await getPersonalizationStatus();
        set({
          personalizationEnabled: status.enabled,
          loadingStatus: false,
        });
        return status.enabled;
      } catch (error) {
        set({ loadingStatus: false });
        toast.error(getErrorMessage(error, "Failed to load personalization status"));
        throw error;
      }
    },

    updateStatus: async (enabled) => {
      const previous = get().personalizationEnabled;
      try {
        set({
          personalizationEnabled: enabled,
          savingStatus: true,
        });
        const status = await updatePersonalizationStatus(enabled);
        set({
          personalizationEnabled: status.enabled,
          savingStatus: false,
          ruleGamesByKey: {},
        });
        toast.success(
          status.enabled ? "Personalization enabled" : "Personalization disabled"
        );
        return status.enabled;
      } catch (error) {
        set({
          personalizationEnabled: previous,
          savingStatus: false,
        });
        toast.error(getErrorMessage(error, "Failed to update personalization status"));
        throw error;
      }
    },

    fetchAllRules: async (segmentType) => {
      try {
        set({ loading: true });
        const rules = await getAllRules(segmentType);
        set({ rules, loading: false });
        return rules;
      } catch (error) {
        set({ loading: false });
        toast.error(getErrorMessage(error, "Failed to load personalization rules"));
        throw error;
      }
    },

    fetchRulesBySegmentType: async (segmentType) => {
      try {
        set((state) => ({
          loadingRulesBySegmentType: {
            ...state.loadingRulesBySegmentType,
            [segmentType]: true,
          },
        }));
        const rules = await getRulesBySegmentType(segmentType);
        set((state) => ({
          rulesBySegmentType: {
            ...state.rulesBySegmentType,
            [segmentType]: rules,
          },
          loadingRulesBySegmentType: {
            ...state.loadingRulesBySegmentType,
            [segmentType]: false,
          },
        }));
        return rules;
      } catch (error) {
        set((state) => ({
          loadingRulesBySegmentType: {
            ...state.loadingRulesBySegmentType,
            [segmentType]: false,
          },
        }));
        toast.error(
          getErrorMessage(error, "Failed to load personalization rules")
        );
        throw error;
      }
    },

    fetchRuleWithGames: async (segmentType, segmentValue) => {
      const key = getRuleKey(segmentType, segmentValue);
      try {
        set((state) => ({
          loadingRuleGamesByKey: {
            ...state.loadingRuleGamesByKey,
            [key]: true,
          },
        }));
        const data = await getRuleWithGames(segmentType, segmentValue);
        set((state) => ({
          ruleGamesByKey: {
            ...state.ruleGamesByKey,
            [key]: data,
          },
          loadingRuleGamesByKey: {
            ...state.loadingRuleGamesByKey,
            [key]: false,
          },
        }));
        return data;
      } catch (error) {
        set((state) => ({
          loadingRuleGamesByKey: {
            ...state.loadingRuleGamesByKey,
            [key]: false,
          },
        }));
        toast.error(getErrorMessage(error, "Failed to load games"));
        throw error;
      }
    },

    saveRule: async (segmentType, segmentValue, gameIds) => {
      try {
        set({ saving: true });
        const rule = await upsertRule(segmentType, segmentValue, gameIds);
        const key = getRuleKey(segmentType, segmentValue);

        set((state) => {
          const currentRules = state.rulesBySegmentType[segmentType] ?? [];
          const nextRules = currentRules.some((item) => item.id === rule.id)
            ? currentRules.map((item) => (item.id === rule.id ? rule : item))
            : [...currentRules, rule];
          const cachedRuleGames = state.ruleGamesByKey[key];

          return {
            saving: false,
            rulesBySegmentType: {
              ...state.rulesBySegmentType,
              [segmentType]: nextRules,
            },
            ruleGamesByKey: cachedRuleGames
              ? {
                  ...state.ruleGamesByKey,
                  [key]: {
                    ...cachedRuleGames,
                    rule,
                  },
                }
              : state.ruleGamesByKey,
          };
        });

        return rule;
      } catch (error) {
        set({ saving: false });
        toast.error(getErrorMessage(error, "Failed to save personalization"));
        throw error;
      }
    },

    removeRule: async (id) => {
      try {
        await deleteRule(id);
        set((state) => ({
          rules: state.rules.filter((rule) => rule.id !== id),
          rulesBySegmentType: Object.fromEntries(
            Object.entries(state.rulesBySegmentType).map(([segmentType, rules]) => [
              segmentType,
              (rules ?? []).filter((rule) => rule.id !== id),
            ])
          ),
        }));
        toast.success("Personalization rule deleted");
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to delete personalization rule"));
        throw error;
      }
    },
  })
);

export const getPersonalizationRuleKey = getRuleKey;
