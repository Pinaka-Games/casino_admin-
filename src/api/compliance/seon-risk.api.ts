import api from "../config/axios.config";

export type SeonRiskDecisionValue = "ALLOW" | "BLOCK" | "STEP_UP";

export type SeonRiskDecisionRow = {
  id: string;
  actionType: string;
  decision: SeonRiskDecisionValue;
  reason?: string | null;
  userIdentifier?: string | null;
  clientIp?: string | null;
  countryCode?: string | null;
  score?: number | null;
  isVpnProxy?: boolean | null;
  failureMode?: string | null;
  failureDetail?: string | null;
  geofenceRaw?: any;
  fraudRaw?: any;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type SeonRiskListParams = {
  page?: number;
  limit?: number;
  search?: string;
  actionType?: string;
  decision?: SeonRiskDecisionValue | "";
  countryCode?: string;
  isVpnProxy?: "true" | "false";
  dateFrom?: string;
  dateTo?: string;
  scoreMin?: number | "";
  scoreMax?: number | "";
};

export type SeonRiskListResponse = {
  page: number;
  limit: number;
  total: number;
  rows: SeonRiskDecisionRow[];
};

export const listSeonRiskDecisions = async (params: SeonRiskListParams) => {
  const res = await api.get<SeonRiskListResponse>("/compliance/seon-risk-decisions", {
    params,
  });
  return res.data;
};

export const getSeonRiskDecisionDetails = async (id: string) => {
  const res = await api.get<SeonRiskDecisionRow | null>(`/compliance/seon-risk-decisions/${id}`);
  return res.data;
};
