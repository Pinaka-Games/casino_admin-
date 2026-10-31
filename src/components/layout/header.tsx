"use client";

import { admin, logo, notifcation } from "@/assets/icons";
import ProfileMenuModal from "@/model/profiledropdown";
import ReportsModal from "@/model/ReportsModal";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth-store";
import { getAvatarColor, getInitials } from "@/utils/defaultimgbg";
import Link from "next/link";

export function Header() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [openprofile, setOpenprofile] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully 👋");
      setOpenprofile(false);
      setOpen(false);
      router.replace("/login");
    } catch (e) {
      toast.error("Logout failed");
    }
  };

  return (
    <header className="flex h-16 bg-[#191D24] sticky top-0 z-50 items-center justify-between px-6 border-b border-gray-800">
      <div className="flex items-center gap-4">
        <Link href="/agent-management">
          <Image
            src={logo}
            alt="Wulf Casino Logo"
            width={120}
            height={30}
            className="object-contain"
          />
        </Link>
      </div>

      <div className="flex items-center gap-5">
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

          {/* Username */}
          <span className="text-sm font-medium text-white hidden sm:block">
            {user?.username?.split(" ")[0]}
          </span>
        </div>
      </div>

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
    </header>
  );
}
