"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Eye, EyeOff, Loader2, ShieldCheck, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AgentDatePicker from "../../../components/AgentDatePicker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { profileApi } from "@/api/users/users";
import { getApiErrorMessage } from "@/lib/api-error";
import { getAge, getMaxDobDate } from "@/lib/age";
import toast from "react-hot-toast";
import ModalPortal from "./ModalPortal";
import { toCalendarDate } from "@/lib/calendar-date";

interface SubAgentFormData {
  username: string;
  fullName: string;
  displayName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  commissionPercentage: string;
  password: string;
}

interface Props {
  open: boolean;
  subAgentId: string | null;
  /** Freeze state from the listing row — used until the detail fetch resolves. */
  initialIsFrozen?: boolean;
  onClose: () => void;
  onUpdateSuccess?: () => void;
}

const INPUT_BASE =
  "bg-[#1C2128] border-gray-800 text-white rounded-xl py-6 focus-visible:ring-purple-500/50";
const INPUT_READONLY =
  "bg-[#1C2128] border-gray-800 text-gray-500 rounded-xl py-6 cursor-not-allowed focus-visible:ring-0";

export default function EditSubAgentModal({
  open,
  subAgentId,
  initialIsFrozen,
  onClose,
  onUpdateSuccess,
}: Props) {
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [formData, setFormData] = useState<SubAgentFormData>({
    username: "",
    fullName: "",
    displayName: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    commissionPercentage: "",
    password: "",
  });
  const [dobError, setDobError] = useState("");

  const fetchSubAgentDetails = useCallback(async () => {
    if (!subAgentId) return;
    setFetching(true);
    try {
      const res = await profileApi.getSubAgent(subAgentId);
      const data = res.data;
      // Personal details live on the profile row; only username/email are on
      // the employee. Reading them off `employee` left the form blank.
      setFormData({
        username: data.employee?.username || "",
        fullName: data.profile?.fullName || "",
        displayName: data.profile?.displayName || "",
        phone: data.profile?.phone || "",
        email: data.profile?.email || data.employee?.email || "",
        // AgentDatePicker speaks ISO yyyy-mm-dd; the API returns a date string.
        dateOfBirth: data.profile?.dateOfBirth
          ? (toCalendarDate(data.profile.dateOfBirth) ?? "")
          : "",
        commissionPercentage: data.commissionPercentage?.toString() || "0",
        password: "",
      });
      setIsFrozen(data.isFrozen ?? initialIsFrozen ?? false);
    } catch (error) {
      console.error("Failed to fetch sub-agent data", error);
      toast.error("Failed to load sub-agent details");
    } finally {
      setFetching(false);
    }
  }, [subAgentId, initialIsFrozen]);

  useEffect(() => {
    if (open && subAgentId) {
      setShowPassword(false);
      setDobError("");
      setIsFrozen(initialIsFrozen ?? false);
      fetchSubAgentDetails();
    }
  }, [open, subAgentId, initialIsFrozen, fetchSubAgentDetails]);

  const handleUpdate = async () => {
    if (!subAgentId) return;

    // Same 21+ rule the registration form enforces — an edit must not be able
    // to walk a sub-agent back under the legal age.
    const age = getAge(formData.dateOfBirth);
    if (age !== null && age < 21) {
      setDobError("Must be at least 21 years old");
      return;
    }
    setDobError("");

    setLoading(true);
    try {
      const payload: {
        fullName: string;
        displayName: string;
        phone: string;
        email: string;
        dateOfBirth: string;
        commissionPercentage: number;
        isFrozen: boolean;
        password?: string;
      } = {
        fullName: formData.fullName,
        displayName: formData.displayName,
        phone: formData.phone,
        email: formData.email,
        dateOfBirth: formData.dateOfBirth,
        commissionPercentage: parseFloat(formData.commissionPercentage) || 0,
        isFrozen,
      };
      if (formData.password) payload.password = formData.password;

      await profileApi.updateSubAgent(subAgentId, payload);
      toast.success("Sub-Agent updated successfully");
      onUpdateSuccess?.();
      onClose();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update sub-agent"));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal onClose={onClose}>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-2xl rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl overflow-hidden shadow-purple-500/5 max-h-[92dvh] overflow-y-auto scrollbar-hide">
          {/* HEADER */}
          <div className="flex items-center justify-between p-6 pb-2">
            <h2 className="text-white text-xl font-bold">Edit Sub-Agent</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* BODY */}
          <div className="p-4 sm:p-6 pt-2">
            {fetching ? (
              <div className="h-[300px] flex items-center justify-center text-gray-500 gap-2">
                <Loader2 className="animate-spin" size={20} />
                Loading…
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">
                    Username*
                  </Label>
                  <Input
                    value={formData.username}
                    readOnly
                    className={INPUT_READONLY}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">
                    Full Name
                  </Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Enter full name"
                    className={INPUT_BASE}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">
                    Display Name
                  </Label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    placeholder="Enter display name"
                    className={INPUT_BASE}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">
                    Phone
                  </Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="Enter phone number"
                    className={INPUT_BASE}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    value={formData.email}
                    readOnly
                    placeholder="Enter email address"
                    className={INPUT_READONLY}
                  />
                </div>

                {/* DOB — same input and 21+ cap as Register Sub-Agent, so the
                    calendar cannot select an under-age or future date. */}
                <div className="col-span-2 space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">
                    Date of Birth
                  </Label>
                  <AgentDatePicker
                    id="dateOfBirth"
                    name="dateOfBirth"
                    captionLayout="dropdown"
                    value={formData.dateOfBirth}
                    max={getMaxDobDate(21)}
                    onChange={(iso) => {
                      setFormData((prev) => ({ ...prev, dateOfBirth: iso }));
                      setDobError("");
                    }}
                    className="bg-[#1C2128] border border-gray-800 rounded-xl h-[52px] px-3 flex items-center text-white"
                  />
                  {dobError && (
                    <p className="text-red-500 text-xs mt-1">{dobError}</p>
                  )}
                </div>

                <div className="col-span-2 space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">
                    Password{" "}
                    <span className="text-gray-500 text-xs">
                      (leave blank to keep)
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className={`${INPUT_BASE} pr-12`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                {/* PERMISSIONS */}
                <div className="col-span-2 pt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-gray-400" />
                    <span className="text-gray-300 text-sm font-semibold">
                      Permissions
                    </span>
                    <div className="flex-1 h-px bg-gray-800 ml-2" />
                  </div>

                  {/* isFrozen — backend rejects claims with "Your commissions are
                      frozen." Login is unaffected; that's `isBlocked`. */}
                  <div
                    className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-colors ${
                      isFrozen
                        ? "bg-red-500/5 border-red-500/30"
                        : "bg-[#1C2128] border-gray-800"
                    }`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`mt-0.5 h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
                          isFrozen
                            ? "bg-red-500/15 text-red-400"
                            : "bg-white/5 text-gray-400"
                        }`}
                      >
                        <Snowflake size={18} />
                      </div>
                      <div>
                        <Label className="text-gray-200 text-sm font-bold">
                          Freeze Commission
                        </Label>
                        <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                          Login still works, but commission claims are blocked.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-sm w-14 text-right ${
                          isFrozen ? "text-red-400" : "text-gray-400"
                        }`}
                      >
                        {isFrozen ? "Frozen" : "Normal"}
                      </span>
                      <Switch
                        checked={isFrozen}
                        onCheckedChange={setIsFrozen}
                        className="data-[state=checked]:bg-[#9333ea] data-[state=unchecked]:bg-gray-700"
                      />
                    </div>
                  </div>

                  {isFrozen && (
                    <p className="text-xs text-red-400/80 px-1">
                      This sub-agent will not be able to claim commission once
                      you save.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 sm:p-6 pt-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <Button
              className="bg-[#1C2128] hover:bg-[#252a33] text-white font-bold px-8 py-6 rounded-xl border border-gray-800"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#9333ea] hover:bg-[#d233ea] text-white font-bold px-10 py-6 rounded-xl "
              onClick={handleUpdate}
              disabled={loading || fetching}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
