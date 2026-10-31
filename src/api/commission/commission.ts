import axios from "axios";

export interface CommissionConfig {
    casinoOriginal: number;
    casinoThirdParty: number;
    sports: number;
    [key: string]: any; // preserve other backend fields (minClaimAmount, payoutLockDays etc.)
}

const ADMIN_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1/admin";
const API_BASE_URL = ADMIN_API_URL.replace(/\/admin\/?$/, "");

const commissionAxios = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

commissionAxios.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const commissionApi = {
    getCommissionConfig: async () => {
        return commissionAxios.get<CommissionConfig>("/admin/referral/config");
    },

    updateCommissionConfig: async (data: CommissionConfig) => {
        return commissionAxios.put<CommissionConfig>("/admin/referral/config", data);
    },
};
