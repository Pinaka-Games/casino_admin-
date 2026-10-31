"use client";

import { useEffect, useState } from "react";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UsDateInput from "@/components/UsDateInput";
import { Label } from "@/components/ui/label";
import { profileApi } from "@/api/users/users";
import { approveUserKyc, revokeUserKyc } from "@/api/kyc/kyc.admin.api";
import KycStatusBadge from "@/components/KycStatusBadge";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import toast from "react-hot-toast";
import {
  composeFullName,
  EMPTY_NAME_PARTS,
  resolveNameParts,
} from "@/lib/player-name";

interface AgentData {
  username: string;
  /**
   * Composed name. Still here because the listing row and the player header
   * both seed this modal with one, and both read it back on save — the parts
   * below are what actually get sent.
   */
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  displayName: string;
  phone: string;
  email: string;
  dob: string;
  password: string;
  kycStatus?: string;
  kycAdminApproved?: boolean;
}

interface Props {
  open: boolean;
  userId?: string;
  initialData: AgentData | null;
  onClose: () => void;
  onSubmit: (data: AgentData) => void;
  // Called after a KYC change so the parent list can refresh without closing.
  onChanged?: () => void;
}

/** Today as yyyy-mm-dd, local — the newest date a birth date may be. */
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().split("T")[0];
};

const mapUserToFormData = (user: any): AgentData => ({
  username: user?.username || "",
  fullName: user?.profile?.fullName || user?.name || "",
  // Stored parts when the API has them; a split of the composed name for rows
  // written before the columns existed.
  ...resolveNameParts({
    firstName: user?.profile?.firstName,
    middleName: user?.profile?.middleName,
    lastName: user?.profile?.lastName,
    fullName: user?.profile?.fullName || user?.name,
  }),
  displayName: user?.profile?.displayName || "",
  phone: user?.profile?.phone || "",
  email: user?.profile?.email || user?.entity || "",
  dob: toDateInputValue(user?.profile?.dateOfBirth),
  password: "",
});

export default function EditPlayerModal({
  open,
  userId,
  initialData,
  onClose,
  onSubmit,
  onChanged,
}: Props) {
  const [formData, setFormData] = useState<AgentData>({
    username: "",
    fullName: "",
    ...EMPTY_NAME_PARTS,
    displayName: "",
    phone: "",
    email: "",
    dob: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  /* ===== KYC STATE (seeded from the row passed in initialData) ===== */
  const [kycStatus, setKycStatus] = useState<string>("NOT_STARTED");
  const [kycAdminApproved, setKycAdminApproved] = useState<boolean>(false);
  const [kycSaving, setKycSaving] = useState(false);

  const handleApproveKyc = async () => {
    if (!userId) {
      toast.error("User ID missing");
      return;
    }
    try {
      setKycSaving(true);
      await approveUserKyc(userId);
      setKycStatus("APPROVED");
      setKycAdminApproved(true);
      toast.success("KYC marked as approved by admin");
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve KYC");
    } finally {
      setKycSaving(false);
    }
  };

  const handleRevokeKyc = async () => {
    if (!userId) {
      toast.error("User ID missing");
      return;
    }
    try {
      setKycSaving(true);
      const res = await revokeUserKyc(userId);
      setKycStatus(res?.status || "NOT_STARTED");
      setKycAdminApproved(false);
      toast.success("Admin KYC approval revoked");
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to revoke KYC");
    } finally {
      setKycSaving(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId || !open) return;
      try {
        setFetching(true);
        const response = await profileApi.getUserProfile(userId);
        setFormData(mapUserToFormData(response.data));
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast.error("Failed to fetch user details");
      } finally {
        setFetching(false);
      }
    };

    fetchUserData();
  }, [open, userId]);

  const handleUpdate = async () => {
    if (!userId) {
      toast.error("User ID missing");
      return;
    }
    const firstName = formData.firstName.trim();
    const middleName = formData.middleName.trim();
    const lastName = formData.lastName.trim();
    const anyNameEntered = Boolean(firstName || middleName || lastName);

    // A half-entered name is worse than none: Sumsub is given the claim as-is,
    // and a missing surname reads as a mismatch against the document. Players
    // with nothing on record are left alone, so an unrelated edit (phone,
    // password) is not blocked behind filling in a name nobody knows yet.
    if (anyNameEntered && (!firstName || !lastName)) {
      toast.error("First name and last name are both required");
      return;
    }

    try {
      setSaving(true);
      await profileApi.updateUserProfile(userId, {
        // Parts only — the API composes `fullName` from them. Sending both
        // would leave the server picking which one wins.
        ...(anyNameEntered ? { firstName, middleName, lastName } : {}),
        displayName: formData.displayName,
        phone: formData.phone,
        dateOfBirth: formData.dob,
        ...(formData.password ? { password: formData.password } : {}),
      });
      toast.success("Player updated successfully");
      onSubmit({ ...formData, fullName: composeFullName(formData) });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open || !initialData) return;

    setFormData({
      username: initialData.username || "",
      fullName: initialData.fullName || "",
      // The list row carries only the composed name, so split it for the three
      // inputs. The fetch effect replaces this with the stored parts as soon as
      // the profile arrives.
      ...resolveNameParts(initialData),
      displayName: initialData.displayName || "",
      phone: initialData.phone || "",
      email: initialData.email || "",
      dob: toDateInputValue(initialData.dob),
      password: "",
    });

    setKycStatus(initialData.kycStatus || "NOT_STARTED");
    setKycAdminApproved(Boolean(initialData.kycAdminApproved));
  }, [initialData, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto scrollbar-hide rounded-2xl bg-[#15181E] p-8 relative">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-semibold">Edit Player Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* FORM */}
        {fetching ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
            <p className="text-gray-400">Loading player details...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Username */}
              <div className="col-span-2">
                <Label className="text-sm text-white">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.username}
                  disabled
                  className="mt-1 h-11 bg-[#1F2630] border-none text-gray-400 cursor-not-allowed"
                />
              </div>

              {/* Legal name, in parts. Kept separate because the KYC claim
                  sent to Sumsub needs first and last apart, and splitting one
                  composed string guessed wrong on any name with more than two
                  words. Middle name is optional. */}
              <div>
                <Label className="text-sm text-white">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.firstName}
                  onChange={(e: { target: { value: any; }; }) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="N/A"
                  className="mt-1 h-11 bg-[#1F2630] border-none text-white"
                />
              </div>

              <div>
                <Label className="text-sm text-white">
                  Middle Name <span className="text-gray-500">(optional)</span>
                </Label>
                <Input
                  value={formData.middleName}
                  onChange={(e: { target: { value: any; }; }) =>
                    setFormData({ ...formData, middleName: e.target.value })
                  }
                  placeholder="N/A"
                  className="mt-1 h-11 bg-[#1F2630] border-none text-white"
                />
              </div>

              <div>
                <Label className="text-sm text-white">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.lastName}
                  onChange={(e: { target: { value: any; }; }) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="N/A"
                  className="mt-1 h-11 bg-[#1F2630] border-none text-white"
                />
              </div>

              {/* Display Name */}
              <div>
                <Label className="text-sm text-white">Display Name</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e: { target: { value: any; }; }) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  placeholder="N/A"
                  className="mt-1 h-11 bg-[#1F2630] border-none text-white"
                />
              </div>

              {/* PHONE SECTION */}
              <div>
                <Label className="text-sm text-white">New Phone Number</Label>
                <div className="mt-1">
                  <PhoneInput
                    country={"us"}
                    value={formData.phone}
                    onChange={(value) =>
                      setFormData({ ...formData, phone: value })
                    }
                    enableSearch
                    searchPlaceholder="Search country..."
                    inputStyle={{
                      width: "100%",
                      height: "44px",
                      backgroundColor: "#1F2630",
                      border: "none",
                      color: "#fff",
                      fontSize: "14px",
                      borderRadius: "6px",
                      paddingLeft: "48px",
                    }}
                    buttonStyle={{
                      backgroundColor: "#242B35",
                      border: "none",
                      borderRight: "1px solid #2F3742",
                      borderRadius: "6px 0 0 6px",
                    }}
                    dropdownStyle={{
                      backgroundColor: "#1F2630",
                      color: "#fff",
                      border: "1px solid #2F3742",
                    }}
                    searchStyle={{
                      backgroundColor: "#242B35",
                      color: "#fff",
                      border: "1px solid #2F3742",
                    }}
                    containerStyle={{
                      width: "100%",
                    }}
                  />
                </div>
              </div>

              {/* EMAIL / PHONE SECTION — label reflects how the user registered */}
              <div>
                <Label className="text-sm text-white">
                  {formData.email.includes("@") ? "Email" : "Phone Number"}
                </Label>
                <Input
                  value={formData.email}
                  disabled
                  className="mt-1 h-11 bg-[#1F2630] border-none text-gray-400 cursor-not-allowed"
                />
              </div>

              {/* DOB */}
              <div>
                <Label className="text-sm text-white">Date of birth</Label>
                {/* Bounded so a typo cannot become a stored birth date: the
                    field used to accept any year the browser picker allowed,
                    which is how "5345-03-04" got saved. */}
                <UsDateInput
                  value={formData.dob}
                  onChange={(iso) => setFormData({ ...formData, dob: iso })}
                  min="1900-01-01"
                  max={todayIso()}
                  className="mt-1 h-11 bg-[#1F2630] rounded-md px-3 flex items-center text-white"
                />
              </div>

              {/* Password */}
              <div>
                <Label className="text-sm text-white">
                  New Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    placeholder="Enter new password"
                    onChange={(e: { target: { value: any; }; }) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="h-11 bg-[#1F2630] border-none text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* KYC SECTION */}
            <div className="mt-8 rounded-xl border border-[#2A323D] bg-[#1A1E25] p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-white">KYC Verification</Label>
                    <KycStatusBadge
                      status={kycStatus}
                      adminApproved={kycAdminApproved}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {kycAdminApproved
                      ? "Manually approved by admin (overrides the normal KYC flow)."
                      : "Admin can mark this player's KYC as approved without the Sumsub process."}
                  </p>
                </div>

                {kycAdminApproved ? (
                  <Button
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10 min-w-[140px]"
                    onClick={handleRevokeKyc}
                    disabled={kycSaving}
                  >
                    {kycSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Revoke Approval"
                    )}
                  </Button>
                ) : (
                  <Button
                    className="bg-green-600 text-white hover:bg-green-700 min-w-[160px]"
                    onClick={handleApproveKyc}
                    disabled={kycSaving || kycStatus === "APPROVED"}
                  >
                    {kycSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : kycStatus === "APPROVED" ? (
                      "Already Approved"
                    ) : (
                      "Mark KYC Approved"
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex justify-end gap-4 mt-8">
              <Button
                variant="outline"
                className="border-gray-600 text-white"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className="bg-purple-600 text-white hover:bg-purple-700 min-w-[90px]"
                onClick={handleUpdate}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
