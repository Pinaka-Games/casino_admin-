import { Admin } from "@/types/admin.type";
import { Employee } from "./employee";

// LOGIN
export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  admin: Employee;
  message?: string; 
}


// REGISTER
export interface RegisterPayload {
  entity: string; // ← identifier
  password: string;
  isAgreedToTermsConditions: boolean;
  referral?: string | null;
}

// PASSWORD RESET
export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}
