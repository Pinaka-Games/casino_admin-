import api from "../config/axios.config";

export type SeonFailureMode = "STEP_UP" | "FAIL_OPEN" | "FAIL_CLOSED";

export interface SeonConfigValues {
  // Kill-switches
  seonEnabled: boolean;
  amlEnabled: boolean;
  fraudAuthEnabled: boolean;
  fraudDepositEnabled: boolean;
  fraudWithdrawalEnabled: boolean;
  fraudKycEnabled: boolean;
  fraudAccountEditEnabled: boolean;
  fraudGameplayEnabled: boolean;
  blockVpn: boolean;
  sessionField: string;
  failureMode: SeonFailureMode;
  stepUpTtlSeconds: number;
  amlUrl: string;
  tagUrlBase: string;
  ipUrl: string;
  depositAmlThreshold: number;
  withdrawalAmlThreshold: number;
  bonusAmlThreshold: number;
  winAmlThreshold: number;
  amlMonitoringEnabled: boolean;
  amlMonitoringCron: string;
  amlMonitoringIntervalDays: number;
  amlMonitoringBatch: number;
  amlMonitoringThrottleMs: number;
}

export interface SeonConfigResponse {
  effective: SeonConfigValues;
  defaults: SeonConfigValues;
}

/** GET /admin/seon/config */
export const getSeonConfig = async (): Promise<SeonConfigResponse> => {
  const res = await api.get<SeonConfigResponse>("/seon/config");
  return res.data;
};

/** PUT /admin/seon/config */
export const updateSeonConfig = async (
  patch: Partial<SeonConfigValues>,
): Promise<SeonConfigResponse> => {
  const res = await api.put<SeonConfigResponse>("/seon/config", patch);
  return res.data;
};
