"use client";

import { admin, notifcation } from "@/assets/icons";
import ProfileMenuModal from "@/model/profiledropdown";
import AgentReportsModal from "@/model/AgentReportsModal";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth-store";
import { getAvatarColor, getInitials } from "@/utils/defaultimgbg";
import Link from "next/link";
import AgentProfileIdentityModal from "@/app/agent-management/components/AgentProfileIdentityModal";
import LogoutConfirmModal from "@/model/LogoutConfirmModal";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AgentHeader() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [openprofile, setOpenprofile] = useState(false);
  const [openIdentity, setOpenIdentity] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isSubAgent = user?.roles?.some(
    (r) => ["subagent", "sub_agent", "sub-agent", "sub agent"].includes(r.name?.toLowerCase())
  );

  const handleLogoutClick = () => {
    setOpenprofile(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully 👋");
      setShowLogoutConfirm(false);
      setOpen(false);
      router.replace("/login");
    } catch (e) {
      toast.error("Logout failed");
    }
  };

  return (
    <header className="flex h-16 bg-[#191D24] sticky top-0 z-50 items-center justify-between px-6 border-b border-gray-800">
      <div className="flex items-center gap-4 text-white">
        <SidebarTrigger className="text-white hover:text-gray-300" />
      </div>

      <div className="flex items-center gap-6">
        {/* Payout Notification Badge */}
        {/* {!isSubAgent && (
          <div 
            onClick={() => {
              setOpen((s) => !s);
              setOpenprofile(false);
            }}
            className="flex items-center gap-2 cursor-pointer group bg-[#15181E] px-3 py-1.5 rounded-full border border-gray-800 hover:border-orange-500/50 transition-all active:scale-95"
          >
            <div className="relative">
              <Image src={notifcation} alt="notification" width={20} height={20} className="invert group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
            </div>
            <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-orange-400">
              <span className="text-orange-500">5</span> Pending Requests
            </span>
          </div>
        )} */}
 
        {/* Profile */}
        <div
          onClick={() => {
            setOpenprofile((s) => !s);
            setOpen(false);
          }}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {/* Avatar */}
          {user?.image ? (
            <Image
              src={user.image}
              alt="admin"
              width={40}
              height={40}
              className="rounded-full object-cover border border-purple-500/30"
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-full text-white font-semibold border border-purple-500/30"
              style={{
                width: 40,
                height: 40,
                backgroundColor: getAvatarColor(user?.username || "User"),
              }}
            >
              {getInitials(user?.username || "User")}
            </div>
          )}

          {/* Username */}
          <span className="text-sm font-bold text-white hidden sm:block">
            {user?.username?.split(" ")[0]}
          </span>
        </div>
      </div>

{/* {!isSubAgent && (
        <AgentReportsModal 
          isOpen={open}
          onClose={() => setOpen(false)}
        />
      )} */}

      <ProfileMenuModal
        isOpen={openprofile}
        onClose={() => {
          setOpenprofile(false);
          setOpen(false);
        }}
        onProfile={() => setOpenIdentity(true)}
        onSettings={() => router.push("/settings")}
        onLogout={handleLogoutClick}
      />

      <AgentProfileIdentityModal 
        open={openIdentity}
        onClose={() => setOpenIdentity(false)}
      />

      <LogoutConfirmModal 
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />
    </header>
  );
}

