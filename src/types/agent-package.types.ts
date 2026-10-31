// src/types/agent-package.types.ts

export type PlanInterval = "MONTHLY" | "YEARLY";
export type PackageTxnType = "BUY" | "UPGRADE" | "RENEW" | "CANCEL";
export type PackageTxnStatus = "SUCCESS" | "FAILED" | "PENDING";

export interface AgentPackage {
  id: string;
  name: string;
  seq: number;
  iconUrl?: string | null;
  interval: PlanInterval;
  price: string;
  currency: string;
  features: Record<string, any>;
  isActive: boolean;
  subAgents?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ADMIN – Create
export interface AdminCreatePackagePayload {
  name: string;
  seq: number;
  iconUrl?: string;
  interval: PlanInterval;
  price: string;
  currency: string;
  features: Record<string, any>;
  isActive?: boolean;
  subAgents?: string;
  description?: string;
}

// ADMIN – Update (patch / partial)
export interface AdminUpdatePackagePayload {
  name?: string;
  seq?: number;
  iconUrl?: string | null;
  interval?: PlanInterval;
  price?: string;
  currency?: string;
  features?: Record<string, any>;
  removeFeatureKeys?: string[];
  isActive?: boolean;
  subAgents?: string;
  description?: string;
}

// AGENT – Buy
export interface BuyPlanPayload {
  planId: string;
  autoRenew?: boolean;
  paymentToken?: string;
}

// AGENT – Upgrade
export interface UpgradePlanPayload {
  newPlanId: string;
  mode?: "IMMEDIATE";
}

// AGENT – History query params
export interface PackageHistoryQuery {
  type?: PackageTxnType;
  status?: PackageTxnStatus;
  toPlanId?: string;
}

// Transaction
export interface PackageTransaction {
  id: string;
  userId: string;
  fromPlanId?: string | null;
  toPlanId: string;
  type: PackageTxnType;
  status: PackageTxnStatus;
  amount: string;
  currency: string;
  meta: Record<string, any>;
  createdAt: string;
}

// Active package held by an agent
export interface AgentActivePackage {
  id: string;
  userId: string;
  packageId: string;
  package: AgentPackage;
  autoRenew: boolean;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
