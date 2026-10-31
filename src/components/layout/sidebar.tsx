"use client";

import * as React from "react";
import { NavMain } from "@/components/nav-main";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useFilteredMenu } from "@/hooks/use-filterd-menu";
import { navItems } from "@/config/menu.config";
import { useAuth } from "@/context/AuthContext";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isHydrated } = useAuth();
  const filteredMenu = useFilteredMenu(navItems);
  // Optional: Show loading state during hydration
  if (!isHydrated) {
    return (
      <Sidebar className="z-50" collapsible="icon" {...props}>
        <SidebarHeader className="mb-2 sticky top-0">
          <TeamSwitcher />
        </SidebarHeader>
        <SidebarContent className="mt-2">
          {/* Pre-hydration list. Uses the filtered result, not raw navItems, so
              sidebar-hidden pages don't flash in before hydration. */}
          <NavMain items={filteredMenu} />
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar className="z-50" collapsible="icon" {...props}>
      <SidebarHeader className="mb-2 sticky top-0">
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent className="mt-2">
        <NavMain items={filteredMenu} />
      </SidebarContent>
    </Sidebar>
  );
} 