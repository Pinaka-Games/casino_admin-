"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { AgentNavItem } from "./agent-menu.config";

type LockedNavItem = AgentNavItem & {
  locked?: boolean;
  items?: (AgentNavItem & { locked?: boolean })[];
};

// Helper function to check if icon is a React component
function isLucideIcon(icon: unknown): boolean {
  return (
    typeof icon === "function" ||
    (!!icon && typeof icon === "object" && "$$typeof" in icon)
  );
}

export function AgentNavMain({ items }: { items: LockedNavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  // `state` is derived from the DESKTOP `open` flag, which SidebarProvider
  // defaults to false. On mobile the sidebar is a Sheet driven by `openMobile`
  // instead, so `state` read "collapsed" there and the drawer rendered in
  // icon-only mode — every nav label and every submenu was hidden behind a bare
  // column of icons. Only treat "collapsed" as collapsed on desktop.
  const isCollapsed = !isMobile && state === "collapsed";

  /**
   * Exact match, plus nested routes (a sub-agent detail page keeps "Sub-Agents"
   * lit). The dashboard root is exact-only, otherwise it would match every page.
   */
  const isPathActive = (url?: string) => {
    if (!url) return false;
    if (url === "/agent-management") return pathname === url;
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = !!item.items?.length;
          const isLocked = item.locked === true;

          const isSubActive = hasChildren
            ? item.items!.some((sub) => isPathActive(sub.url))
            : false;
          const isItemActive = isPathActive(item.url) || isSubActive;
          const IconComponent = isLucideIcon(item.icon) ? item.icon : null;

          // Groups start expanded so their child links are visible without an
          // extra click; users can still collapse them.
          return (
            <Collapsible
              key={item.title}
              defaultOpen
              className="group/collapsible"
            >
              <SidebarMenuItem className="px-2">
                <CollapsibleTrigger
                  asChild
                  onClick={() => {
                    // router.push, not redirect() — redirect() is a server/RSC
                    // API; in a click handler it navigates without the client
                    // tree re-reading usePathname, so the highlight went stale.
                    if (item.url) router.push(item.url);
                    if (isCollapsed) toggleSidebar();
                    // The mobile drawer is an overlay: without this it stays on
                    // top of the page the tap just navigated to.
                    if (isMobile) setOpenMobile(false);
                  }}
                >
                  <SidebarMenuButton
                    tooltip={isLocked ? "Upgrade your plan to unlock" : item.title}
                    isActive={isItemActive}
                    className={`
                      flex items-center gap-2 rounded-xl transition-all duration-200
                      ${isCollapsed ? "justify-center size-12" : "px-3 py-3 md:px-4"}
                      ${/* `!` is required: SidebarMenuButton ships
                            data-[active=true]:bg-transparent, and that
                            attribute-qualified rule outranks a plain bg class,
                            so the active pill never rendered. */ ""}
                      ${!isCollapsed && isItemActive ? "bg-[#B93DEB]!" : ""}
                      ${isCollapsed && isItemActive ? "bg-[#B93DEB]!" : ""}
                      ${isItemActive ? "text-white!" : "text-gray-300 hover:text-white"}
                    `}
                  >
                    <div className={`flex items-center justify-center transition-all ${isCollapsed && isItemActive ? "bg-[#B93DEB] rounded-md" : ""}`}>
                      {IconComponent ? (
                        <IconComponent
                          size={isCollapsed ? 24 : 22}
                          className={`transition-all duration-200 ${isCollapsed ? "p-1" : ""}`}
                        />
                      ) : (
                        <Image
                          src={item.icon}
                          alt="icon"
                          width={isCollapsed ? 40 : 22}
                          height={isCollapsed ? 40 : 22}
                          // Source art is dark, so it always needs inverting to
                          // read as white. `invert-0` when active left a black
                          // icon sitting on the purple active pill.
                          className={`transition-all duration-200 ${isCollapsed ? "p-2" : ""} invert dark:invert-0`}
                        />
                      )}
                    </div>

                    {!isCollapsed && isLocked && (
                      <div className="flex-1 ml-1 text-left">
                         <span className="font-medium">{item.title}</span>
                      </div>
                    )}

                    {!isCollapsed && !isLocked && (
                      <span className="flex-1 ml-1 text-left font-medium">{item.title}</span>
                    )}

                    {!isCollapsed && !isLocked && hasChildren && (
                      <ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                {hasChildren && !isCollapsed && (
                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-7 mt-1 flex flex-col gap-1 px-0 border-l-0">
                      {item.items!.map((subItem) => {
                        const isSubActiveExact = isPathActive(subItem.url);

                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isSubActiveExact}
                              className={`
                                rounded-md px-5 py-2 text-sm transition-all
                                ${isSubActiveExact ? "bg-[#B93DEB] text-white font-semibold" : "text-gray-200 hover:bg-[#B93DEB] hover:text-white"}
                              `}
                            >
                              <Link
                                href={subItem.url ?? ""}
                                onClick={() => {
                                  if (isMobile) setOpenMobile(false);
                                }}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>{subItem.title}</span>
                                </div>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                )}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
