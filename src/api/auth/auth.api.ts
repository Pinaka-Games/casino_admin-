import api from "../config/axios.config";
import type {
  LoginPayload,
  LoginResponse,
  ForgotPasswordPayload,
  ResetPasswordPayload,
} from "../../types/auth.types";

// test commit 
// LOGIN
export const login = async (data: LoginPayload): Promise<LoginResponse> => {
  const res = await api.post<LoginResponse>("/auth/login", data);
  return res.data;
};

// FORGOT PASSWORD
export const forgotPassword = async (data: ForgotPasswordPayload) => {
  const res = await api.post("/auth/forgot-password", data);
  return res.data;
};

// RESET PASSWORD
export const resetPassword = async (data: ResetPasswordPayload) => {
  const res = await api.post("/auth/reset-password", data);
  return res.data;
};

// LOGOUT
export const logout = async () => {
  const res = await api.post("/auth/logout");
  return res.data;
};

export const me = async () => {
  const res = await api.get("/auth/me"); // or "/employees/me"
  return res.data;
};

export const changePassword = async (data: {
  currentPassword: string;
  newPassword: string;
}) => {
  const res = await api.post("/auth/change-password", data);
  return res.data;
};

// UPDATE PROFILE 
export const updateProfile = async (payload: {
  username?: string;
  email?: string;
  name?: string;
}) => {
  const { data } = await api.patch("/auth/update-profile", payload);
  return data;
};
