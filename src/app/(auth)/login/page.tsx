'use client'
import { LoginForm } from "@/components/auth/login-form"
import { useAuthStore } from "@/store/auth-store";
import { getAccessToken, isTokenExpired } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Page() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user, userType, } = useAuthStore();

  useEffect(() => {
    // Only redirect to the app when there's a real, non-expired token — never
    // on a stale persisted "authenticated" flag (would loop with the dashboard).
    const token = getAccessToken();
    const hasValidToken = !!token && !isTokenExpired(token);
    if (!isLoading && isAuthenticated === "authenticated" && user && hasValidToken) {
      const isAgent = user.roles?.some(role => role.name.toLowerCase() === 'agent');
      if (isAgent) {
        router.push("/agent-management");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isLoading, isAuthenticated, router, user]);

 
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#0A0E1A]">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
