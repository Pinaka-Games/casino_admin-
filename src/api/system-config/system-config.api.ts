import api from "../config/axios.config";
import {
  PaymentMethodCatalog,
  SystemConfig,
  SystemConfigResponse,
  SystemConfigSectionKey,
} from "@/types/system-config";

export const systemConfigApi = {
  /**
   * The gateway / direction / rail catalog the Payment Manager renders from.
   * Served by the API so a rail added there shows up here without a redeploy.
   */
  getPaymentMethodCatalog: async (): Promise<PaymentMethodCatalog> => {
    const response = await api.get<PaymentMethodCatalog>(
      "/system-config/payment-methods/catalog",
    );
    return response.data;
  },

  get: async (): Promise<SystemConfigResponse> => {
    const response = await api.get<SystemConfigResponse>("/system-config");
    return response.data;
  },

  getDefaults: async (): Promise<SystemConfig> => {
    const response = await api.get<SystemConfig>("/system-config/defaults");
    return response.data;
  },

  update: async (config: SystemConfig): Promise<SystemConfigResponse> => {
    const response = await api.put<SystemConfigResponse>("/system-config", config);
    return response.data;
  },

  patchSection: async <TSection>(
    section: SystemConfigSectionKey,
    value: TSection,
  ): Promise<SystemConfigResponse> => {
    const response = await api.patch<SystemConfigResponse>(
      `/system-config/${section}`,
      value,
    );
    return response.data;
  },

  reset: async (): Promise<SystemConfigResponse> => {
    const response = await api.post<SystemConfigResponse>("/system-config/reset");
    return response.data;
  },
};
