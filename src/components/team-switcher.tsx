"use client";

import Image from "next/image";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { logo, logoshort } from "@/assets/icons";
import Link from "next/dist/client/link";

export function TeamSwitcher() {
  const { state, isMobile } = useSidebar();

  // Same as nav-main: the mobile drawer is full width, so the desktop collapse
  // state must not shrink its header to the icon-only logo.
  const isCollapsed = !isMobile && state === "collapsed";

  return (
    <SidebarMenu className="w-full">
      <SidebarMenuItem className="flex justify-start relative h-16">
        <div
          className={`
            absolute left-12 top-0 my-2 flex items-center
            transition-all duration-300 ease-in-out
            ${
              isCollapsed
                ? "opacity-0 -translate-x-3 scale-90"
                : "opacity-100 translate-x-0 scale-100"
            }
          `}
        >
          <Link href="/dashboard">
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

        {/* SHORT LOGO (Collapsed Mode) */}
        <div
          className={`
            absolute left-2 top-4 mx-1 flex items-center
            transition-all duration-300 ease-in-out
            ${
              isCollapsed
                ? "opacity-100 translate-x-0 scale-100"
                : "opacity-0 translate-x-3 scale-90"
            }
          `}
        >
          <Link href="/dashboard">
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
