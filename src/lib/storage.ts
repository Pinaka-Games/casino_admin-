// src/utils/storage.ts
export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
};

export const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refreshToken");
};

export const setTokens = (accessToken: string, refreshToken: string | null) => {
  localStorage.setItem("accessToken", accessToken);
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
};


export const clearTokens = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user_type");
  // Also drop the zustand-persisted auth snapshot so a stale
  // `isAuthenticated:"authenticated"` can't survive a token clear and bounce
  // the user login↔dashboard (the redirect-loop bug).
  localStorage.removeItem("auth-storage");
};

// Decode a JWT and report whether it is expired (or unparseable). No external
// dependency — just base64url-decode the payload and read `exp`. Used so an
// expired-but-present token is never treated as "authenticated".
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const part = token.split(".")[1];
    if (!part) return true;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload?.exp) return false; // no exp claim → treat as non-expiring
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // malformed → treat as expired
  }
};
