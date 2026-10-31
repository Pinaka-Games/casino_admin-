"use client";

import { useRouter } from "next/navigation";
import { Loader2, CircleDollarSign } from "lucide-react";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

// Standalone Activate Now Badge
export function FeatureBadge() {
  const router = useRouter();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push("/agent-management/agent-package-mgt");
      }}
      className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#B93DEB] hover:bg-[#A831D6] transition-all text-white text-[10px] font-bold uppercase shadow-lg shadow-[#B93DEB]/20 group shrink-0"
    >
      <CircleDollarSign size={12} className="group-hover:rotate-12 transition-transform" />
      Activate now
    </button>
  );
}

interface FeatureGateProps {
  allowed: boolean;
  featureName?: string;
  children: React.ReactNode;
  // If true, the badge will appear next to the title in the header.
  showHeader?: boolean;
}

export function FeatureGate({ 
  allowed, 
  featureName, 
  children,
  showHeader = false
}: FeatureGateProps) {
  const {
    currentPackage,
    packagingDisabled,
    packageFetched,
    packageUnavailable,
    fetchCurrentPackage,
  } = useAgentPackageStore();
  const { isLoaded } = useFeatureAccess();
  const { hasRole } = useAuth();

  // Administrators and SuperAdmins bypass all gates
  const isAdmin = hasRole("ADMIN") || hasRole("superadmin") || hasRole("admin");

  useEffect(() => {
    if (!isAdmin && !currentPackage && !packageFetched) fetchCurrentPackage();
  }, [currentPackage, packageFetched, fetchCurrentPackage, isAdmin]);

  // Admin bypass before any loading/lock state; packages disabled by admin →
  // no package rules apply, everything is open.
  if (isAdmin || packagingDisabled) return <>{children}</>;

  // Plan couldn't be read (API down / 5xx). We don't know what this agent is
  // entitled to, so show a retry — never the upsell, which would tell a paying
  // agent to upgrade because of an outage.
  if (packageUnavailable) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 min-h-[100px] text-center">
        <p className="text-xs text-gray-400">
          Couldn&apos;t load your plan. Check your connection and try again.
        </p>
        <button
          onClick={() => void fetchCurrentPackage()}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-[11px] font-bold uppercase tracking-wider transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  // Still loading — don't show lock yet
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[100px]">
        <Loader2 className="animate-spin text-purple-500" size={24} />
      </div>
    );
  }

  // Administrators bypass all gates; otherwise require feature allowed
  if (allowed || isAdmin) return <>{children}</>;

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Target: Section Header with Badge */}
      {showHeader && featureName && (
        <div className="flex items-center gap-3 shrink-0">
          <h3 className="text-lg font-bold text-white uppercase tracking-tighter">
            {featureName}
          </h3>
          <FeatureBadge />
        </div>
      )}

      {/* Blurred Data Body */}
      <div className="relative flex-1 overflow-hidden group/gate">
        <div className="pointer-events-none select-none blur-md lg:blur-lg opacity-30 h-full w-full">
          {children}
        </div>
        
        {/* Overlay Block */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-black/10 rounded-xl backdrop-blur-[2px]">
           <div className="bg-[#191D24]/80 backdrop-blur-xl border border-white/10 p-6 sm:p-8 rounded-[32px] flex flex-col items-center gap-4 text-center shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-2">
                 <CircleDollarSign size={32} className="text-purple-400 animate-pulse" />
              </div>
              <p className="text-sm font-bold text-white/90 uppercase tracking-tight leading-tight">
                If you want to see this data,<br />
                <span className="text-purple-400">update your plan</span>
              </p>
              <FeatureBadge />
           </div>
        </div>
      </div>
    </div>
  );
}
