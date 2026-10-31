import api from "../config/axios.config";

export type PaymentProcessorProvider = "breeze" | "coinflow";
export type PaymentProcessorMethod = "card" | "crypto" | "bank-transfer";
export type PaymentProcessorCurrency = "usd" | "sgd" | "coin" | "cash";

export interface PaymentProcessor {
  id: string;
  channelName: string;
  gatewayName: string;
  type: string;
  provider: PaymentProcessorProvider;
  method: PaymentProcessorMethod;
  currency: PaymentProcessorCurrency;
  minDeposit: string;
  maxDeposit: string;
  minWithdraw: string;
  maxWithdraw: string;
  depositable: boolean;
  withdrawable: boolean;
  cardBrands: string[];
  threeDSRequired: boolean;
  country: string | null;
  bankAccount: string | null;
  swiftCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProcessorQuery {
  provider?: PaymentProcessorProvider;
  method?: PaymentProcessorMethod;
  currency?: PaymentProcessorCurrency;
  depositable?: boolean;
  withdrawable?: boolean;
  search?: string;
  [key: string]: unknown;
}

export interface CreatePaymentProcessorPayload {
  channelName: string;
  gatewayName: string;
  type: string;
  provider: PaymentProcessorProvider;
  method: PaymentProcessorMethod;
  currency?: PaymentProcessorCurrency;
  minDeposit?: string;
  maxDeposit?: string;
  minWithdraw?: string;
  maxWithdraw?: string;
  depositable?: boolean;
  withdrawable?: boolean;
  cardBrands?: string[];
  threeDSRequired?: boolean;
  country?: string | null;
  bankAccount?: string | null;
  swiftCode?: string | null;
}

export type UpdatePaymentProcessorPayload =
  Partial<CreatePaymentProcessorPayload>;

const stripUndefined = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  );

export const paymentProcessorApi = {
  list: async (query: PaymentProcessorQuery = {}) => {
    const res = await api.get<PaymentProcessor[]>("/payment-processors", {
      params: stripUndefined(query),
    });
    return res.data;
  },

  getOne: async (id: string) => {
    const res = await api.get<PaymentProcessor>(`/payment-processors/${id}`);
    return res.data;
  },

  create: async (payload: CreatePaymentProcessorPayload) => {
    const res = await api.post<PaymentProcessor>(
      "/payment-processors",
      payload,
    );
    return res.data;
  },

  update: async (id: string, payload: UpdatePaymentProcessorPayload) => {
    const res = await api.patch<PaymentProcessor>(
      `/payment-processors/${id}`,
      payload,
    );
    return res.data;
  },

  remove: async (id: string) => {
    const res = await api.delete(`/payment-processors/${id}`);
    return res.data;
  },

  toggleDepositable: async (id: string, depositable: boolean) => {
    const res = await api.patch(`/payment-processors/${id}/depositable`, {
      depositable,
    });
    return res.data;
  },

  toggleWithdrawable: async (id: string, withdrawable: boolean) => {
    const res = await api.patch(`/payment-processors/${id}/withdrawable`, {
      withdrawable,
    });
    return res.data;
  },

  seedDefaults: async () => {
    const res = await api.post<{ message: string; created: number }>(
      "/payment-processors/seed",
    );
    return res.data;
  },
};
