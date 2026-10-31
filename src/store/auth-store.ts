// store/auth-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setTokens, clearTokens, getAccessToken, isTokenExpired } from "@/lib/storage";
import * as authApi from "@/api/auth/auth.api";
import { Employee } from "@/types/employee";
import { disconnectSocket } from "@/lib/socket";

type UserModel = Employee;

interface AuthState {
  user: Employee | null;
  token: string | null;
  userType: "admin" | "employee" | null;
  isAuthenticated: "authenticated" | "unauthenticated";
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;
  refreshMe: () => Promise<void>;
  setHydrated: (v: boolean) => void;
}

interface AuthActions {
  login: (data: {
    email: string;
    password: string;
  }) => Promise<{ success: boolean; message?: string }>;

  logout: () => Promise<void>;
  initializeAuth: () => void;

  forgotPassword: (
    email: string,
  ) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (payload: {
    token: string;
    password: string;
  }) => Promise<{ success: boolean; message?: string }>;

  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<{ success: boolean; message?: string }>;

  updateProfile: (payload: {
    username?: string;
    email?: string;
    name?: string;
  }) => Promise<{ success: boolean; message?: string }>;

  clearError: () => void;
  setUser: (user: UserModel | null) => void;
  updateUser: (user: UserModel) => void;
  checkAuth: () => boolean;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      userType: null,
      isAuthenticated: "unauthenticated",
      isLoading: false,
      error: null,
      isHydrated: false,

      setHydrated: (v: boolean) => set({ isHydrated: v }),

      // restore auth from storage on app load
      initializeAuth: () => {
        if (typeof window === "undefined") return;

        // ensure cross-tab sync is attached even if rehydrate already fired
        bindAuthCrossTabSync();

        const token = getAccessToken();
        const userType = localStorage.getItem("user_type") as
          | "admin"
          | "employee"
          | null;

        if (token && !isTokenExpired(token) && userType) {
          set({
            token,
            userType,
            isAuthenticated: "authenticated",
          });
        } else {
          // No token, expired token, or no userType → signed-out. Clear any
          // leftover tokens + reconcile a stale persisted "authenticated" flag
          // so the login page won't bounce back to the dashboard (loop fix).
          if (token) clearTokens();
          const s = get();
          if (s.isAuthenticated === "authenticated") {
            set({
              user: null,
              token: null,
              userType: null,
              isAuthenticated: "unauthenticated",
              error: null,
            });
          }
        }
      },

      // ✅ FIXED LOGIN
      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });

        try {
          const result = await authApi.login({
            email: email.trim(),
            password: password.trim(),
          });

          const { token, admin, message } = result;
          const refreshToken = (result as any).refreshToken ?? null;

          // atomic replace — wipe any prior session bits FIRST so role/user from
          // a previous login cannot leak into the new session on rapid switches.
          clearTokens();
          if (typeof window !== "undefined") {
            localStorage.removeItem("user_type");
          }

          // save token (+ refresh token so expired sessions silently refresh)
          setTokens(token, refreshToken);
          localStorage.setItem("user_type", "admin");

          set({
            user: admin,
            token,
            userType: "admin",
            isAuthenticated: "authenticated",
            isLoading: false,
            error: null,
          });

          return { success: true, message: message || "Login successful" };
        } catch (err: any) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Invalid credentials";

          // ✅ IMPORTANT:
          // Do NOT clear token/user here
          // Do NOT redirect here
          // Just show error
          set({
            isLoading: false,
            error: msg,
          });

          return { success: false, message: msg };
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
          const result = await authApi.forgotPassword({ email });
          return {
            success: true,
            message: result.message || "Reset link sent",
          };
        } catch (err: any) {
          const msg =
            err?.response?.data?.message || "Failed to send reset email";
          set({ error: msg });
          return { success: false, message: msg };
        } finally {
          set({ isLoading: false });
        }
      },

      resetPassword: async ({ token, password }) => {
        set({ isLoading: true, error: null });
        try {
          const result = await authApi.resetPassword({ token, password });
          return {
            success: true,
            message: result.message || "Password reset successful",
          };
        } catch (err: any) {
          const msg = err?.response?.data?.message || "Password reset failed";
          set({ error: msg });
          return { success: false, message: msg };
        } finally {
          set({ isLoading: false });
        }
      },

      changePassword: async ({ currentPassword, newPassword }) => {
        set({ isLoading: true, error: null });
        try {
          const result = await authApi.changePassword({
            currentPassword,
            newPassword,
          });
          return {
            success: true,
            message: result.message || "Password changed successfully",
          };
        } catch (err: any) {
          const msg = err?.response?.data?.message || "Change password failed";
          set({ error: msg });
          return { success: false, message: msg };
        } finally {
          set({ isLoading: false });
        }
      },

      updateProfile: async (payload) => {
        set({ isLoading: true, error: null });

        try {
          const result = await authApi.updateProfile(payload);

          set((state) => ({
            user: state.user ? { ...state.user, ...payload } : state.user,
          }));

          return {
            success: true,
            message: result.message || "Profile updated successfully",
          };
        } catch (error: any) {
          const message =
            error?.response?.data?.message || "Profile update failed";

          set({ error: message });
          return { success: false, message };
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          // optional: await authApi.logout();
        } finally {
          try { disconnectSocket(); } catch { /* ignore */ }
          clearTokens();
          if (typeof window !== "undefined") {
            localStorage.removeItem("user_type");
          }
          set({
            user: null,
            token: null,
            userType: null,
            isAuthenticated: "unauthenticated",
            isLoading: false,
            error: null,
          });
          // hard-purge persist key so a pending async write cannot resurrect stale state
          try {
            useAuthStore.persist.clearStorage();
          } catch { /* ignore */ }
        }
      },
      refreshMe: async () => {
        try {
          // you need an endpoint that returns current logged-in user with roles + permissions
          const me = await authApi.me(); // create this API call
          set({ user: me });
        } catch (err) {
          // if token invalid, logout silently (optional)
          // await get().logout();
        }
      },

      clearError: () => set({ error: null }),

      setUser: (user) => set({ user }),
      updateUser: (user) => set({ user }),

      checkAuth: () => {
        const state = get();
        const token = getAccessToken();
        const userType = localStorage.getItem("user_type");

        return Boolean(
          state.isAuthenticated === "authenticated" &&
          token &&
          userType &&
          state.user,
        );
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        userType: state.userType,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // mark hydrated so guards can stop showing loaders / blocking
        state?.setHydrated?.(true);
        // reconcile: if persisted "authenticated" but the token is missing OR
        // expired, force logout state. (Expired-but-present token was the cause
        // of the login↔dashboard redirect loop.)
        if (typeof window !== "undefined") {
          const rawToken = localStorage.getItem("accessToken");
          if (
            state &&
            state.isAuthenticated === "authenticated" &&
            (!rawToken || isTokenExpired(rawToken))
          ) {
            clearTokens();
            useAuthStore.setState({
              user: null,
              token: null,
              userType: null,
              isAuthenticated: "unauthenticated",
              error: null,
            });
          }
        }
        bindAuthCrossTabSync();
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Cross-tab sync — logout in one tab propagates to other tabs.
// Guarded so we only attach once.
// ---------------------------------------------------------------------------
let __authCrossTabBound = false;
function bindAuthCrossTabSync() {
  if (__authCrossTabBound || typeof window === "undefined") return;
  __authCrossTabBound = true;

  window.addEventListener("storage", (e) => {
    if (!e.key) return;

    // another tab cleared tokens OR purged persist key → mirror logout locally
    const logoutSignal =
      (e.key === "accessToken" && !e.newValue) ||
      (e.key === "auth-storage" && !e.newValue) ||
      (e.key === "user_type" && !e.newValue);

    if (logoutSignal) {
      const s = useAuthStore.getState();
      if (s.isAuthenticated === "unauthenticated" && !s.token) return; // already clean — no loop
      try { disconnectSocket(); } catch { /* ignore */ }
      useAuthStore.setState({
        user: null,
        token: null,
        userType: null,
        isAuthenticated: "unauthenticated",
        isLoading: false,
        error: null,
      });
    }
  });
}
