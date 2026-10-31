import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "@/lib/storage";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});

// ✅ auth endpoints (never add Authorization, never refresh, never redirect)
const isAuthEndpoint = (url?: string) => {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("auth/login") ||
    url.includes("/auth/forgot-password") ||
    url.includes("auth/forgot-password") ||
    url.includes("/auth/reset-password") ||
    url.includes("auth/reset-password") ||
    url.includes("/auth/refresh") ||
    url.includes("auth/refresh")
  );
};

// ✅ Request: inject token EXCEPT auth endpoints
api.interceptors.request.use((config) => {
  const url = config.url;

  if (isAuthEndpoint(url)) return config; // ✅ important

  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight token refresh. When the access token expires, every request
// in flight 401s at once; each used to fire its own POST /auth/refresh, and
// because the backend rotates the refresh token, parallel refreshes
// invalidated each other — the losers bounced the admin to /login mid-work.
// All concurrent 401s now await one shared refresh.
let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const r = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );
      // Backend may wrap responses as { data: {...} } — handle both shapes.
      const data = r.data?.data ?? r.data;
      const accessToken = data?.accessToken;
      const newRefresh = data?.refreshToken ?? refreshToken;
      if (!accessToken) throw new Error("No access token in refresh response");
      setTokens(accessToken, newRefresh);
      return accessToken as string;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ✅ Response: refresh ONLY for protected APIs (not auth endpoints)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url;

    // ✅ for /auth/login etc. don't refresh and don't redirect
    if (status === 401 && isAuthEndpoint(url)) {
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      try {
        const accessToken = await refreshAccessToken(refreshToken);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        return api(originalRequest);
      } catch (refreshErr) {
        clearTokens();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);


export default api;
