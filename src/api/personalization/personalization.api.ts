import api from "../config/axios.config";
import type { Game } from "../games/games";

export type SegmentType =
  | "default"
  | "ethnicity"
  | "country"
  | "gender"
  | "state"
  | "age_group";

export interface PersonalizationRule {
  id: string;
  segmentType: SegmentType;
  segmentValue: string;
  gameIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonalizationRuleWithGames {
  rule: PersonalizationRule | null;
  games: Game[];
}

export interface PersonalizationStatus {
  enabled: boolean;
}

/** Fetch all rules, optionally filtered by segmentType */
export const getAllRules = async (
  segmentType?: SegmentType
): Promise<PersonalizationRule[]> => {
  const res = await api.get<PersonalizationRule[]>("/personalization", {
    params: segmentType ? { segmentType } : undefined,
  });
  return res.data;
};

export const getPersonalizationStatus = async (): Promise<PersonalizationStatus> => {
  const res = await api.get<PersonalizationStatus>("/personalization/status");
  return res.data;
};

export const updatePersonalizationStatus = async (
  enabled: boolean
): Promise<PersonalizationStatus> => {
  const res = await api.patch<PersonalizationStatus>("/personalization/status", {
    enabled,
  });
  return res.data;
};

/** Fetch all rules for a specific segment type */
export const getRulesBySegmentType = async (
  segmentType: SegmentType
): Promise<PersonalizationRule[]> => {
  const res = await api.get<PersonalizationRule[]>(
    `/personalization/${segmentType}`
  );
  return res.data;
};

/** Fetch a single rule + its ordered games for a segment value */
export const getRuleWithGames = async (
  segmentType: SegmentType,
  segmentValue: string
): Promise<PersonalizationRuleWithGames> => {
  const res = await api.get<PersonalizationRuleWithGames>(
    `/personalization/${segmentType}/${encodeURIComponent(segmentValue)}`
  );
  return res.data;
};

/** Create or update the ordered game list for a segment */
export const upsertRule = async (
  segmentType: SegmentType,
  segmentValue: string,
  gameIds: string[]
): Promise<PersonalizationRule> => {
  const res = await api.put<PersonalizationRule>(
    `/personalization/${segmentType}/${encodeURIComponent(segmentValue)}`,
    { segmentType, segmentValue, gameIds }
  );
  return res.data;
};

/** Delete a personalization rule by ID */
export const deleteRule = async (id: string): Promise<{ success: boolean }> => {
  const res = await api.delete<{ success: boolean }>(
    `/personalization/${id}`
  );
  return res.data;
};
