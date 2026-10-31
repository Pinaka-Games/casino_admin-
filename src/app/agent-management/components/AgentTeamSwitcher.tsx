"use client";

import Image from "next/image";
import Link from "next/link";
import { SidebarMenu, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { logo, logoshort } from "@/assets/icons";

/**
 * Sidebar header for the agent / sub-agent shell.
 *
 * An agent-local copy of `@/components/team-switcher` for one reason: that
 * component decides which logo to show from `state`, and `state` tracks the
 * DESKTOP `open` flag. On mobile the sidebar is a Sheet driven by `openMobile`
 * instead, so `state` reads "collapsed" there and the 288px-wide drawer rendered
 * the 30px short mark instead of the full logo. Gating on `isMobile` as well
 * keeps the drawer expanded, and leaves the shared component (which the admin
 * shell also renders) untouched.
 */
export function AgentTeamSwitcher() {
  const { state, isMobile } = useSidebar();

  const isCollapsed = !isMobile && state === "collapsed";

  return (
    <SidebarMenu className="w-full">
      <SidebarMenuItem className="flex justify-start relative h-16">
        {/* FULL LOGO (expanded, and always on mobile) */}
        <div
          className={`
            absolute left-4 md:left-12 top-0 my-2 flex items-center
            transition-all duration-300 ease-in-out
            ${
              isCollapsed
                ? "opacity-0 -translate-x-3 scale-90 pointer-events-none"
                : "opacity-100 translate-x-0 scale-100"
            }
          `}
        >
          <Link href="/agent-management">
            <Image
              src={logo}
              alt="Full Logo"
              width={135}
              height={30}
              priority
              className="object-contain"
            />
          </Link>
        </div>

        {/* SHORT LOGO (desktop icon-rail only) */}
        <div
          className={`
            absolute left-2 top-4 mx-1 flex items-center
            transition-all duration-300 ease-in-out
            ${
              isCollapsed
                ? "opacity-100 translate-x-0 scale-100"
                : "opacity-0 translate-x-3 scale-90 pointer-events-none"
            }
          `}
        >
          <Link href="/agent-management">
            <Image
              src={logoshort}
              alt="Short Logo"
              width={30}
              height={30}
              priority
              className="object-contain"
            />
          </Link>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
