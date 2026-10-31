"use client";

import { useEffect, useState } from "react";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UsDateInput from "@/components/UsDateInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { profileApi } from "@/api/users/users";
import toast from "react-hot-toast";
import { toCalendarDate } from "@/lib/calendar-date";

const COUNTRY_CODES = ["+1", "+44", "+91", "+86", "+81", "+82", "+49", "+33", "+61", "+971"];

// Split a stored phone ("+91 98989898989" or raw) into { code, number }.
const splitPhone = (raw?: string): { code: string; number: string } => {
  if (!raw) return { code: "+1", number: "" };
  const m = /^(\+\d{1,4})\s*(.*)$/.exec(raw.trim());
  if (m) return { code: m[1], number: m[2] };
  return { code: "+1", number: raw.trim() };
};

interface AgentData {
  username: string;
  fullName: string;
  displayName: string;
  phone: string;
  email: string;
  dob: string;
  gender: string;
  password: string;
}

interface Props {
  open: boolean;
  agentId: string | null;
  onClose: () => void;
  onUpdateSuccess?: () => void;
}

export default function EditAgentModal({
  open,
  agentId,
  onClose,
  onUpdateSuccess,
}: Props) {
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AgentData>({
    username: "",
    fullName: "",
    displayName: "",
    phone: "",
    email: "",
    dob: "",
    gender: "",
    password: "",
  });

  const [countryCode, setCountryCode] = useState("+1");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open && agentId) {
      fetchAgentDetails();
    }
  }, [open, agentId]);

  const fetchAgentDetails = async () => {
    if (!agentId) return;
    setFetching(true);
    try {
      const res = await profileApi.getUserProfile(agentId);
      const data = res.data;
      const parsed = splitPhone(data.profile?.phone);
      setCountryCode(parsed.code);
      setFormData({
        username: data.username || "",
        fullName: data.profile?.fullName || "",
        displayName: data.profile?.displayName || "",
        phone: parsed.number,
        email: data.profile?.email || data.email || data.entity || "",
        dob: toCalendarDate(data.profile?.dateOfBirth) ?? "",
        gender: data.profile?.gender || "",
        password: "",
      });
    } catch (error) {
      console.error("Failed to fetch agent details", error);
      toast.error("Failed to load agent details");
    } finally {
      setFetching(false);
    }
  };

  const handleUpdate = async () => {
    if (!agentId) return;
    if (!formData.gender) {
      toast.error("Gender is required");
      return;
    }
    setLoading(true);
    try {
      await profileApi.updateUserProfile(agentId, {
        fullName: formData.fullName,
        displayName: formData.displayName,
        phone: formData.phone ? `${countryCode} ${formData.phone}` : "",
        dateOfBirth: formData.dob,
        gender: formData.gender,
        ...(formData.password ? { password: formData.password } : {}),
      });
      toast.success("Agent updated successfully");
      onUpdateSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Update failed", error);
      toast.error(error?.response?.data?.message || "Failed to update agent");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-0">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#15181E] p-4 relative md:p-6">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white text-lg font-medium">Edit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {fetching ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="text-sm">Fetching agent data...</p>
          </div>
        ) : (
          <>
            {/* FORM GRID */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Username */}
              <div className="col-span-full">
                <Label className="text-white text-sm">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.username}
                  disabled
                  className="mt-1 bg-[#242B35] border-none text-white disabled:opacity-50"
                />
              </div>

              {/* Full Name */}
              <div>
                <Label className="text-white text-sm">Full Name</Label>
                <Input
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="mt-1 bg-[#242B35] border-none text-white"
                />
              </div>

              {/* Display Name */}
              <div>
                <Label className="text-white text-sm">Display Name</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  className="mt-1 bg-[#242B35] border-none text-white"
                />
              </div>

              {/* Phone */}
              <div>
                <Label className="text-white text-sm">New Phone Number</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-[90px] bg-[#242B35] border-none text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#15181E] text-white">
                      {COUNTRY_CODES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={formData.phone}
                    inputMode="numeric"
                    maxLength={15}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 15),
                      })
                    }
                    placeholder="Phone number"
                    className="flex-1 bg-[#242B35] border-none text-white"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label className="text-white text-sm">Email</Label>
                <Input
                  value={formData.email}
                  disabled
                  className="mt-1 bg-[#242B35] border-none text-gray-400 disabled:opacity-100 cursor-not-allowed"
                />
              </div>

              {/* DOB */}
              <div>
                <Label className="text-white text-sm">Date of Birth</Label>
                <UsDateInput
                  value={formData.dob}
                  onChange={(iso) => setFormData({ ...formData, dob: iso })}
                  className="mt-1 h-10 bg-[#242B35] rounded-md px-3 flex items-center text-white"
                />
              </div>

              {/* Gender */}
              <div>
                <Label className="text-white text-sm">
                  Gender <span className="text-red-500">*</span>
                </Label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value })
                  }
                  className="mt-1 w-full h-10 bg-[#242B35] border-none text-white rounded-md px-3 outline-none"
                >
                  <option value="" disabled>
                    Select gender
                  </option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Password */}
              <div>
                <Label className="text-white text-sm">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="mt-1 bg-[#242B35] border-none text-white pr-10"
                    placeholder="Leave blank to keep"
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

            {/* FOOTER */}
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                className="border-gray-600 text-white"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className="bg-purple-500 text-white hover:bg-purple-600"
                disabled={loading}
                onClick={handleUpdate}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    <span>Updating...</span>
                  </div>
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
