import { Role } from "./role.type";

export interface Admin {
  id: string;
  email: string;
  roles: Role;
  isActive: boolean;
  lastLoginAt?: string;
}