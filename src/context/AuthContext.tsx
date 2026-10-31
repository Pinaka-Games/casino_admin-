// context/AuthContext.tsx
"use client";
import { Employee } from "@/types/employee";
import { Admin } from "@/types/admin.type";
import {
  createContext,  
  useContext,  
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useAuthStore } from "@/store/auth-store";

interface AuthContextType {
  user: Employee | null;
  permissions: Set<string>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (roleName: string) => boolean;
  isHydrated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated after mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Extract permissions from user (works for both Admin and Employee)
  useEffect(() => {
    if (user) {
      const perms = new Set<string>();
      user.roles
        ?.filter((role: any) => role.isActive)
        .forEach((role) => {
          role.permissions?.forEach((permission) => {
            perms.add(permission.name);
          });
        });
      setPermissions(perms);
    } else {
      setPermissions(new Set());
    }
  }, [user]);

const getAllPermissions = (admin: Employee | null): string[] => {
  if (!admin?.roles) {
    return [];
  }
  
  const permissions = new Set<string>();
  // Active roles only — matches the API, which drops inactive roles when it
  // flattens permissions onto the request user.
  admin.roles
    .filter((role: any) => role.isActive)
    .forEach((role) => {
      role.permissions?.forEach((permission) => {
        permissions.add(permission.name);
      });
    });
  
  const permArray = Array.from(permissions);
  return permArray;
};

// Check if user has a specific permission
const hasPermission = (permission: string): boolean => {
  const permissions = getAllPermissions(user);
  const result = permissions.includes(permission);
  return result;
};

// Check if user has ANY of the specified permissions
const hasAnyPermission = (permissions: string[]): boolean => {
  const userPermissions = getAllPermissions(user);
  const result = permissions.some((permission) => userPermissions.includes(permission));
  return result;
};

// Check if user has ALL of the specified permissions
const hasAllPermissions = (permissions: string[]): boolean => {
  const userPermissions = getAllPermissions(user);
  const result = permissions.every((permission) => userPermissions.includes(permission));
  return result;
};

// Check if user has a specific role
const hasRole = (roleName: string): boolean => {
  if (!user?.roles) return false;
  const result = user.roles.some(
    (role: any) => role.isActive && role.name.toLowerCase() === roleName.toLowerCase()
  );
  return result;
};

// In your AuthContext component, make sure isHydrated is properly set

useEffect(() => {
  // Set hydrated after component mounts
  setIsHydrated(true);
}, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasRole,
        isHydrated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
