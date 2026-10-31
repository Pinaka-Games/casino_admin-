"use client";

import { notifcation } from "@/assets/icons";
import { AppSidebar } from "@/components/layout/sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import ProfileMenuModal from "@/model/profiledropdown";
import ReportsModal from "@/model/ReportsModal";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth-store";
import { getAvatarColor, getInitials } from "@/utils/defaultimgbg";
import PageLoader from "@/components/PageLoader";
import GlobalRefreshButton from "@/components/GlobalRefreshButton";
import HeaderBackButton from "@/components/HeaderBackButton";
import SettingsSearch from "@/components/search/SettingsSearch";
import { GLOBAL_REFRESH_EVENT } from "@/hooks/use-global-refresh";
import { RoutePermissionGuard } from "@/components/guard/route-permission-guard";
// test 

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoading, isAuthenticated, logout, user, refreshMe } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [openprofile, setOpenprofile] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleGlobalRefresh = () => {
      setRefreshKey((key) => key + 1);
    };

    window.addEventListener(GLOBAL_REFRESH_EVENT, handleGlobalRefresh);
    return () => {
      window.removeEventListener(GLOBAL_REFRESH_EVENT, handleGlobalRefresh);
    };
  }, []);

  // The sidebar filter and RoutePermissionGuard both read the roles/permissions
  // snapshot persisted at LOGIN time. A permission revoked after that reaches a
  // live session via the permissions:updated socket event, but a session that
  // missed it (tab closed, socket down) kept the stale grant forever. Re-pull
  // /auth/me on every full load so a reload is enough for revocations to land.
  useEffect(() => {
    if (mounted && isAuthenticated === "authenticated") {
      refreshMe();
    }
  }, [mounted, isAuthenticated, refreshMe]);

  useEffect(() => {
    if (mounted && !isLoading && isAuthenticated === "authenticated" && user) {
      const isAffiliate = user.roles?.some(role => {
        const name = role.name.toLowerCase();
        return name === 'agent' || name === 'subagent' || name === 'sub_agent';
      });
      if (isAffiliate) {
        router.replace("/agent-management");
      }
    } else if (mounted && !isLoading && isAuthenticated === "unauthenticated") {
      router.replace("/login");
    }
  }, [mounted, isLoading, isAuthenticated, router, user]);

  if (!mounted || isLoading || (isAuthenticated === "authenticated" && !user)) {
    return <PageLoader />;
  }

  if (isAuthenticated === "unauthenticated") {
    return null;
  }

  // Block affiliates (agents/sub-agents) from rendering the main layout — redirect is in progress
  if (user && user.roles?.some(role => {
    const name = role.name.toLowerCase();
    return name === 'agent' || name === 'subagent' || name === 'sub_agent';
  })) {
    return <PageLoader />;
  }



  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully 👋");
      setOpenprofile(false);
      setOpen(false);
      router.replace("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <header
          className="flex h-16 bg-[#191D24] sticky top-0 z-50 items-center justify-between gap-2 px-3 border-b md:gap-4 md:px-6"

        >
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
            <SidebarTrigger />
            {/* Appears once the operator has navigated somewhere — saves
                reopening the sidebar to get back to the previous screen. */}
            <HeaderBackButton className="hidden h-10 px-5 sm:inline-flex" />
            {/* Global settings search — finds any page or individual System
                Configuration field and navigates straight to it. */}
            <SettingsSearch className="w-full max-w-md" />
            <GlobalRefreshButton className="hidden h-10 px-5 sm:inline-flex" />
          </div>

          <div className="flex shrink-0 items-center gap-3 md:gap-5">

            {/* Notification */}
            <div
              onClick={() => {
                setOpen(true);
                setOpenprofile(false);
              }}
              className="relative cursor-pointer"
            >
              <Image
                src={notifcation}
                alt="notification"
                width={32}
                height={32}
              />
            </div>

            {/* Profile */}
            <div
              onClick={() => {
                setOpenprofile((s) => !s);
                setOpen(false);
              }}
              className="flex items-center gap-3 cursor-pointer"
            >
              {/* Avatar */}
              {user?.image ? (
                <Image
                  src={user.image}
                  alt="admin"
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-full text-white font-semibold"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: getAvatarColor(user?.username || "User"),
                  }}
                >
                  {getInitials(user?.username || "User")}
                </div>
              )}

              {/* Username (first word only) */}
              <span className="text-sm font-medium text-white hidden sm:block">
                {user?.username?.split(" ")[0]}
              </span>
            </div>
          </div>
        </header>

        {/* min-w-0 is load-bearing: a flex item defaults to min-width:auto, so
            without it this wrapper refuses to shrink below its widest child. A
            wide table then pushes the whole content column out and it renders
            under the sidebar instead of scrolling inside its own container.
            Affects every page with a wide table, not just the free-spin ones. */}
        <div key={refreshKey} className="flex min-w-0 flex-1 flex-col gap-4">
          <RoutePermissionGuard>{children}</RoutePermissionGuard>
        </div>
      </SidebarInset>

      <ReportsModal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          setOpenprofile(false);
        }}
      />

      <ProfileMenuModal
        isOpen={openprofile}
        onClose={() => {
          setOpenprofile(false);
          setOpen(false);
        }}
        onProfile={() => router.push("/profile-setting")}
        onSettings={() => router.push("/settings")}
        onLogout={handleLogout}
      />
    </SidebarProvider>
  );
}

