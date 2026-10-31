"use client";

import * as React from "react";
import { AgentTeamSwitcher } from "./AgentTeamSwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { AgentNavItem, agentNavItems } from "./agent-menu.config";
import { useAuth } from "@/context/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { AgentNavMain } from "./AgentNavMain";

export function AgentSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, hasRole, isHydrated } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [plansLoaded, setPlansLoaded] = React.useState(false);
  const { currentPackage, fetchCurrentPackage, plans, fetchPlans } =
    useAgentPackageStore();
  const access = useFeatureAccess();

  React.useEffect(() => {
    setMounted(true);
    if (!currentPackage) fetchCurrentPackage();
    fetchPlans().finally(() => setPlansLoaded(true));
  }, [currentPackage, fetchCurrentPackage, fetchPlans]);

  // Admin disabled every package → active catalog is empty → hide the whole
  // "Agent Package Management" section. Guard on plansLoaded to avoid a flicker
  // before the first fetch resolves.
  const hidePackageSection = plansLoaded && plans.length === 0;

  const filteredItems = React.useMemo(() => {
    if (!isHydrated || !user) return [];
    const isSubAgent =
      user.roles?.some((role) => role.name.toLowerCase().includes("sub")) ?? false;

    return agentNavItems
      .filter((item) => {
        if (item.title.trim() === "Agent Package Management" && hidePackageSection)
          return false;
        if (!item.allowedRoles?.length) return true;
        return item.allowedRoles.some((role) => hasRole(role));
      })
      .map((item) => {
        const mappedSubItems = item.items?.map((sub) => {
          let locked = sub.locked;
          if (sub.url === "/agent-management/payout-requests" || sub.url === "/agent-management/sub-agent-history") {
            locked = isSubAgent ? false : !access.canWithdraw;
          }
          if (sub.url === "/agent-management/withdraw-logs" || sub.url === "/agent-management/deposit-logs") {
            locked = isSubAgent ? false : !access.canViewWalletTransactions;
          }
          return { ...sub, locked };
        });

        return { ...item, items: mappedSubItems };
      });
  }, [user, hasRole, isHydrated, access, hidePackageSection]);

  if (!isHydrated || !mounted) {
    return (
      <Sidebar className="z-50" collapsible="icon" {...props}>
        <SidebarHeader className="mb-2 sticky top-0">
          <AgentTeamSwitcher />
        </SidebarHeader>
        <SidebarContent className="mt-2">
          <AgentNavMain items={agentNavItems as any} />
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar className="z-50" collapsible="icon" {...props}>
      <SidebarHeader className="mb-2 sticky top-0">
        <AgentTeamSwitcher />
      </SidebarHeader>
      <SidebarContent className="mt-2">
        <AgentNavMain items={filteredItems as any} />
      </SidebarContent>
    </Sidebar>
  );
}
