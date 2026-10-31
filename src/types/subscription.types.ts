export type PlanInterval = "MONTHLY" | "YEARLY";

export interface SubscriptionPlanFeatures {
  [key: string]: any; // flexible because admin can add/delete features anytime
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  seq: number;
  iconUrl?: string | null;
  interval: PlanInterval;
  price: string; 
  currency: string;
  features: SubscriptionPlanFeatures;
  isActive: boolean;
  subAgents: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ADMIN - Create Plan
export interface AdminCreatePlanPayload {
  name: string;
  seq: number;
  iconUrl?: string;
  interval: PlanInterval;
  price: string;
  currency: string;
  features: SubscriptionPlanFeatures;
  isActive?: boolean;
  subAgents?: string;
  description?: string;
}

// ADMIN - Update Plan (patch)
export interface AdminUpdatePlanPayload {
  name?: string;
  seq?: number;
  iconUrl?: string | null;
  interval?: PlanInterval;
  price?: string;
  currency?: string;
  features?: SubscriptionPlanFeatures;      // merge on backend
  removeFeatureKeys?: string[];            // delete keys on backend
  isActive?: boolean;
}


// Optional filters for transactions if you use later
export type SubscriptionTxnType = "BUY" | "UPGRADE" | "RENEW" | "CANCEL";
export type SubscriptionTxnStatus = "SUCCESS" | "FAILED" | "PENDING";

export interface SubscriptionTransaction {
  id: string;
  userId: string;
  fromPlanId?: string | null;
  toPlanId: string;
  type: SubscriptionTxnType;
  status: SubscriptionTxnStatus;
  amount: string;
  currency: string;
  meta: Record<string, any>;
  createdAt: string;
}
