"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import EditProfileModal from "./components/EditProfileModal";
import ChangePasswordModal from "./components/ChangePasswordModal";

import { admin as adminIcon } from "@/assets/icons";
import { useAuthStore } from "@/store/auth-store";

export default function ProfilePage() {
  const {
    user,
    userType,
    isAuthenticated,
    updateProfile,
    changePassword,
    token, // keep if you still use token-in-body updateProfile (see note below)
  } = useAuthStore();

  const [editType, setEditType] = useState<
    "username" | "name" | "email" | null
  >(null);
  const [passwordModal, setPasswordModal] = useState(false);

  if (isAuthenticated !== "authenticated" || !user) {
    return (
      <div className="h-screen bg-[#15181E] flex items-center justify-center text-red-400">
        Unauthorized
      </div>
    );
  }

  const username = user.username || user.email || "N/A";
  const email = user.email || "N/A";

  const getInitials = (name?: string) => {
    if (!name) return "?";

    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();

    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#15181E] p-6 space-y-6">
      {/* HEADER */}
      <div className="bg-[#191D24] px-4 py-2 rounded-lg">
        <h1 className="text-base text-white font-normal">
          Profile ({userType})
        </h1>
      </div>

      {/* ACCOUNT INFO */}
      <div className="bg-[#191D24] rounded-lg p-6 space-y-4">
        <h2 className="text-white text-sm mb-8">Account Info</h2>

        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-xl font-semibold">
            {getInitials(username)}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-sm">Username : {username}</span>

            <button type="button" onClick={() => setEditType("username")}>
              <Pencil size={14} className="text-purple-400" />
            </button>
          </div>
        </div>
      </div>

      {/* PERSONAL DETAILS */}
      <div className="bg-[#191D24] rounded-lg p-6 space-y-2">
        <h2 className="text-white text-sm mb-4">Personal Details</h2>

        <div className="flex items-center gap-3">
          <span className="text-gray-300 text-sm">Name : {username}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-gray-300 text-sm">Email : {email}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-gray-300 text-sm">Password :</span>
          {/* <span className="text-purple-400 text-lg text-center"> *******</span> */}

          <Button
            variant="ghost"
            className="text-purple-400 text-md p-0"
            onClick={() => setPasswordModal(true)}
          >
            Change Password
          </Button>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      <EditProfileModal
        open={!!editType}
        type={editType}
        initialValue={
          editType === "username"
            ? username
            : editType === "email"
              ? email
              : username
        }
        onClose={() => setEditType(null)}
        onUpdate={async (value: string) => {
          if (!editType) return;

          if (!token) {
            toast.error("Missing auth token");
            return;
          }

          const res = await updateProfile({
            [editType]: value,
          } as any);

          if (!res?.success) {
            toast.error(res?.message || "Update failed");
            return;
          }

          toast.success(`${editType} updated successfully`);
          setEditType(null);
        }}
      />

      {/* CHANGE PASSWORD MODAL (LOGGED-IN FLOW) */}
      <ChangePasswordModal
        open={passwordModal}
        onClose={() => setPasswordModal(false)}
        onUpdate={async ({ currentPassword, newPassword }) => {
          const res = await changePassword({ currentPassword, newPassword });

          if (!res?.success) {
            toast.error(res?.message || "Failed to change password");
            return;
          }

          toast.success("Password changed successfully");
          setPasswordModal(false);
        }}
      />
    </div>
  );
}
