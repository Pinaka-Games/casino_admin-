"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { redirect, usePathname } from "next/navigation";

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
import { NavItem } from "@/config/menu.config";

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { state, isMobile, toggleSidebar } = useSidebar();
  /**
   * `state` is the DESKTOP collapse state, and it persists in a cookie. The
   * mobile drawer is a Sheet that renders the same nav, so a sidebar left
   * collapsed on desktop made the mobile menu come up icon-only — a logo, a
   * dot, and nothing to tap. The drawer is always full width, so it is never
   * collapsed regardless of what the desktop state says.
   */
  const isCollapsed = !isMobile && state === "collapsed";

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = item.items && item.items.length > 0;

          const isSubActive = hasChildren
            ? item.items!.some((sub) => pathname.startsWith(sub.url ?? ""))
            : false;

          const isItemActive = pathname === item.url || isSubActive;

          return (
            <Collapsible
              key={item.title}
              defaultOpen={isSubActive}
              className="group/collapsible"
            >
              <SidebarMenuItem className="px-2">
                <CollapsibleTrigger
                  asChild
                  onClick={() => {
                    if (item.url) redirect(item.url);
                    if (isCollapsed) toggleSidebar();
                  }}
                >
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isItemActive}
                    className={`
                      flex items-center gap-2  rounded-xl transition-all duration-200

                      ${isCollapsed ? "justify-center size-12" : "px-4 py-3"}

                      /* EXPANDED ACTIVE */
                      ${
                        !isCollapsed && isItemActive
                          ? "bg-[#B93DEB] text-white "
                          : ""
                      }

                      /* COLLAPSED active icon glow */
                      ${isCollapsed && isItemActive ? "bg-[#B93DEB] " : ""}
                          ${
                            isCollapsed && isItemActive && isSubActive
                              ? "bg-[#B93DEB]"
                              : ""
                          }

                      ${
                        !isItemActive
                          ? "text-gray-300 hover:text-white"
                          : "text-white"
                      }
                    `}
                  >
                    {item.icon && (
                      <div
                        className={`
                          flex items-center justify-center transition-all
                          ${
                            isCollapsed && isItemActive
                              ? "bg-[#B93DEB]  rounded-md"
                              : ""
                          }
                        `}
                      >
                        <Image
                          src={item.icon}
                          alt="icon"
                          width={isCollapsed ? 40 : 22}
                          height={isCollapsed ? 40 : 22}
                          className={`
                            transition-all duration-200 ${
                              isCollapsed ? "p-2" : ""
                            }
                            ${
                              isItemActive
                                ? "brightness-0 invert"
                                : "opacity-70 invert dark:invert-0"
                            }
                          `}
                        />
                      </div>
                    )}

                    {!isCollapsed && (
                      <span className="flex-1 ml-1 text-left font-medium">
                        {item.title}
                      </span>
                    )}

                    {!isCollapsed && hasChildren && (
                      <ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                {/* SUBMENU */}
                {hasChildren && !isCollapsed && (
                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-7 mt-1 flex flex-col gap-1 px-0  border-l-0">
                      {item.items!.map((subItem) => {
                        const isSubActiveExact = pathname === subItem.url;

                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isSubActiveExact}
                              className={`
                                rounded-md px-5 py-2 text-sm transition-all
                                ${
                                  isSubActiveExact
                                    ? "bg-[#B93DEB] text-white font-semibold"
                                    : "text-gray-200 hover:bg-[#B93DEB] hover:text-white"
                                }
                              `}
                            >
                              <Link href={subItem.url ?? ""}>
                                {subItem.title}
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
