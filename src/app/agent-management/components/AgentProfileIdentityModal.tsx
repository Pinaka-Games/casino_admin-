"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import EditProfileModal from "../../(main)/profile-setting/components/EditProfileModal";
import { passwordRule, PASSWORD_HINT } from "@/components/validators/common.rules";

import { useAuthStore } from "@/store/auth-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AgentProfileIdentityModal({ open, onClose }: Props) {
  const { user, userType, updateProfile, changePassword, token } =
    useAuthStore();

  const [editType, setEditType] = useState<
    "username" | "name" | "email" | null
  >(null);
  const [view, setView] = useState<"profile" | "change-password">("profile");

  // Change Password State
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  if (!user) return null;

  const handlePasswordSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }

    // Was a bare 6-character check — see ChangePasswordModal.
    const passwordCheck = passwordRule.safeParse(newPassword);
    if (!passwordCheck.success) {
      toast.error(passwordCheck.error.issues[0]?.message || PASSWORD_HINT);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const res = await changePassword({ currentPassword, newPassword });
      if (!res?.success) {
        toast.error(res?.message || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setView("profile");
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const username = user.username || user.email || "N/A";
  const email = user.email || "N/A";
  const roleName = user.roles?.[0]?.name || userType || "Agent";

  const getInitials = (name?: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-[#15181E] border-none text-white w-[calc(100vw-1.5rem)] max-w-3xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl max-h-[92dvh] overflow-y-auto">
          {view === "profile" ? (
            <>
              {/* HEADER */}
              <div className="bg-[#191D24] px-4 py-2 rounded-lg">
                <h1 className="text-base text-white font-normal capitalize">
                  Profile ({roleName})
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
                    <span className="text-gray-300 text-sm">
                      Username : {username}
                    </span>
                  </div>
                </div>
              </div>

              {/* PERSONAL DETAILS */}
              <div className="bg-[#191D24] rounded-lg p-6 space-y-2">
                <h2 className="text-white text-sm mb-4">Personal Details</h2>

                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm">
                    Name : {username}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm">Email : {email}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm">Password :</span>
                  <Button
                    variant="link"
                    className="text-purple-400 text-md p-0 h-auto font-normal hover:no-underline"
                    onClick={() => setView("change-password")}
                  >
                    Change Password
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* HEADER */}
              <div className="bg-[#191D24] px-4 py-2 rounded-lg flex items-center gap-4">
                <button
                  onClick={() => setView("profile")}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <h1 className="text-base text-white font-normal">
                  Change Password
                </h1>
              </div>

              <div className="bg-[#191D24] rounded-lg p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400">
                      Current Password
                    </Label>
                    <div className="relative group">
                      <Input
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        placeholder="Enter current password"
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="bg-[#15181E] border border-gray-700 text-white pr-10 h-10 rounded-xl focus:border-purple-500 transition-all"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        onClick={() => setShowCurrent(!showCurrent)}
                      >
                        {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400">
                      New Password
                    </Label>
                    <div className="relative group">
                      <Input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        placeholder="Enter new password"
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-[#15181E] border border-gray-700 text-white pr-10 h-10 rounded-xl focus:border-purple-500 transition-all"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        onClick={() => setShowNew(!showNew)}
                      >
                        {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400">
                      Confirm New Password
                    </Label>
                    <div className="relative group">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        placeholder="Confirm new password"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-[#15181E] border border-gray-700 text-white pr-10 h-10 rounded-xl focus:border-purple-500 transition-all"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        onClick={() => setShowConfirm(!showConfirm)}
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <Button
                    onClick={() => setView("profile")}
                    variant="secondary"
                    className="bg-[#15181E] border border-white/5 text-gray-400 hover:text-white hover:bg-white/5 h-10 px-8 rounded-xl transition-all"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePasswordSubmit}
                    disabled={isUpdatingPassword}
                    className="bg-[#B93DEB] text-white hover:bg-[#A030D0] h-10 px-10 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20"
                  >
                    {isUpdatingPassword ? "Updating..." : "Update"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modals */}
      <EditProfileModal
        open={!!editType}
        type={editType}
        initialValue={
          editType === "username" || editType === "name"
            ? username
            : editType === "email"
              ? email
              : ""
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
    </>
  );
}
