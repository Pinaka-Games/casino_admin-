// src/api/package/agent-package.api.ts
import axios from "axios";
import { getAccessToken } from "@/lib/storage";
import type {
  AgentPackage,
  AgentActivePackage,
  PackageTransaction,
  BuyPlanPayload,
  UpgradePlanPayload,
  PackageHistoryQuery,
} from "../../types/agent-package.types";

// Agent routes live at /api/v1/agent/... (not under /admin)
const agentBaseURL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/admin$/, "");
const agentApi = axios.create({
  baseURL: agentBaseURL,
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});
agentApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});



export const agentListPlans = async (): Promise<AgentPackage[]> => {
  // Agent-facing active catalog only (isActive:true). Admin `/agent-packages`
  // returns ALL rows incl. disabled — wrong source for the agent sidebar.
  const res = await agentApi.get<AgentPackage[]>("/agent/packages/plans");
  return res.data;
};

// ───────────────── AUTHENTICATED ─────────────────

export const agentGetCurrentPackage = async (): Promise<AgentActivePackage> => {
  const res = await agentApi.get<AgentActivePackage>("/agent/packages/current");
  return res.data;
};

// True when admin disabled all packages — every package rule/feature gate
// is lifted for agents and sub-agents while this is on.
export const agentGetPackagingStatus = async (): Promise<{ packagingDisabled: boolean }> => {
  const res = await agentApi.get<{ packagingDisabled: boolean }>(
    "/agent/packages/packaging-status",
  );
  return res.data;
};

export const agentBuyPlan = async (
  payload: BuyPlanPayload
): Promise<AgentActivePackage> => {
  const res = await agentApi.post<AgentActivePackage>("/agent/packages/buy", payload);
  return res.data;
};

export const agentUpgradePlan = async (
  payload: UpgradePlanPayload
): Promise<AgentActivePackage> => {
  const res = await agentApi.patch<AgentActivePackage>("/agent/packages/upgrade", payload);
  return res.data;
};

export const agentGetPackageHistory = async (
  query?: PackageHistoryQuery
): Promise<PackageTransaction[]> => {
  const res = await agentApi.get<PackageTransaction[]>("/agent/packages/history", {
    params: query,
  });
  return res.data;
};

// ───────────────── BREEZE CHECKOUT ─────────────────

export interface BreezeCheckoutResult {
  url: string;
  pageId: string;
  clientReferenceId: string;
  amountMinor: number;
  currency: string;
}

export const agentCreateBreezeCheckout = async (payload: {
  planId: string;
  successReturnUrl?: string;
  failReturnUrl?: string;
}): Promise<BreezeCheckoutResult> => {
  const res = await agentApi.post<BreezeCheckoutResult>(
    "/agent/packages/breeze/checkout",
    payload
  );
  return res.data;
};

export const agentVerifyBreezeCheckout = async (
  pageId: string,
  planId: string
): Promise<{ activated: boolean; status?: string }> => {
  const res = await agentApi.get<{ activated: boolean; status?: string }>(
    "/agent/packages/breeze/verify",
    { params: { pageId, planId } }
  );
  return res.data;
};

// ───────────────── COINFLOW CHECKOUT (recurring) ─────────────────

export interface CoinflowCheckoutParams {
  merchantId: string;
  sessionKey: string;
  env: string;
  blockchain: string;
  planCode: string;
  email?: string;
  chargebackProtectionData: any[];
  webhookInfo: Record<string, any>;
  /**
   * Rails enabled for agent pay-in in Payment Manager, resolved server-side and
   * handed to `<CoinflowPurchase allowedPaymentMethods>`. Absent on a session
   * minted before this existed; the embed falls back to its local list.
   */
  allowedPaymentMethods?: string[];
}

export interface CoinflowCheckoutResult {
  clientReferenceId: string;
  planId: string;
  amountMinor: number;
  currency: string;
  coinflowCheckout: CoinflowCheckoutParams;
}

export const agentCreateCoinflowCheckout = async (payload: {
  planId: string;
  customerEmail?: string;
}): Promise<CoinflowCheckoutResult> => {
  const res = await agentApi.post<CoinflowCheckoutResult>(
    "/agent/packages/coinflow/checkout",
    payload
  );
  return res.data;
};

export const agentConfirmCoinflowCheckout = async (
  planId: string,
  paymentId?: string
): Promise<{ activated: boolean }> => {
  const res = await agentApi.post<{ activated: boolean }>(
    "/agent/packages/coinflow/confirm",
    { planId, paymentId }
  );
  return res.data;
};
