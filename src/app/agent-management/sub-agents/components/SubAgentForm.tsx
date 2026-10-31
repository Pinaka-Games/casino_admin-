"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { referralApi } from "@/api/referral/referral.api";
import { profileApi } from "@/api/users/users";
import { Input } from "@/components/ui/input";
import AgentDatePicker from "../../components/AgentDatePicker";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import { getAge, getMaxDobDate } from "@/lib/age";
import { getApiErrorMessage, getCrossPoolConflict } from "@/lib/api-error";
import CrossPoolWarningModal from "@/components/CrossPoolWarningModal";
import { passwordRule, PASSWORD_HINT } from "@/components/validators/common.rules";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const emptyForm = () => ({
  username: "",
  displayName: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  ethnicity: "",
  state: "",
  country: "",
  pinCode: "",
  gender: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  // Kept as text for the input; converted to a number at submit. Registering
  // without a rate used to silently default to 0% server-side — the sub-agent
  // then earned nothing on every round and "Total Earnings" never moved until
  // someone discovered the Edit modal.
  commissionPercentage: "",
  referralCode: generateReferralCode(),
  isReferralActive: true,
});

type SubAgentPayload = Omit<ReturnType<typeof emptyForm>, "commissionPercentage"> & {
  parentAgentId: string;
  commissionPercentage?: number;
};

interface Props {
  /** Fired after a successful registration — listing refresh / modal close. */
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function SubAgentForm({ onSuccess, onCancel }: Props) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState(emptyForm());

  // Cross-pool "create anyway?" confirmation. Only ever opens for an ADMIN
  // caller — the backend returns overridable:false for an agent, so an agent
  // gets a plain error toast (hard block) instead of this dialog.
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");
  const [pending, setPending] = useState<SubAgentPayload | null>(null);

  // The registering agent's own rates, so the form can SHOW the ceiling
  // instead of a vague "capped at your own rate" note. FLAT mode → one hard
  // ceiling (the backend refuses anything above it). CATEGORY mode → the input
  // caps at the highest category rate: a share above that would be clipped in
  // every single category at earn time, so it can never be meant.
  const [rateCap, setRateCap] = useState<{
    mode: "FLAT" | "CATEGORY";
    max: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    profileApi
      .getReferralStats()
      .then((res) => {
        if (cancelled) return;
        const stats = res.data as {
          commissionMode?: string;
          flatCommissionRate?: number;
          commissions?: Array<{ rate?: number }>;
        };
        if (stats?.commissionMode === "FLAT") {
          setRateCap({ mode: "FLAT", max: Number(stats.flatCommissionRate || 0) });
          return;
        }
        const rates = (stats?.commissions ?? []).map((c) => Number(c.rate || 0));
        if (rates.length) setRateCap({ mode: "CATEGORY", max: Math.max(...rates) });
      })
      .catch(() => {
        /* cap display is best-effort — the backend still enforces it */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleInputChange = (
    e: { target: { name: string; value: string } },
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePhoneChange = (value: string) => {
    setFormData((prev) => ({ ...prev, phone: value }));
    setErrors((prev) => ({ ...prev, phone: "" }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) newErrors.username = "Username is required";

    if (!formData.password) newErrors.password = "Password is required";
    else {
      // Length alone is not the API's rule — complexity is enforced server-side.
      const check = passwordRule.safeParse(formData.password);
      if (!check.success) newErrors.password = check.error.issues[0]?.message || PASSWORD_HINT;
    }

    if (!formData.confirmPassword)
      newErrors.confirmPassword = "Confirm password is required";
    else if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (!formData.email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email format";

    if (!formData.phone) newErrors.phone = "Phone number is required";
    else if (formData.phone.length < 10)
      newErrors.phone = "Invalid phone number";

    if (!formData.gender) newErrors.gender = "Gender is required";

    if (!formData.dateOfBirth)
      newErrors.dateOfBirth = "Date of birth is required";
    else if (
      getAge(formData.dateOfBirth) !== null &&
      (getAge(formData.dateOfBirth) as number) < 21
    )
      newErrors.dateOfBirth = "Must be at least 21 years old";

    // Required — a missing rate used to register the sub-agent at a silent 0%,
    // so every commission accrued as 0 and "Total Earnings" never moved until
    // someone found the Edit modal.
    if (formData.commissionPercentage === "") {
      newErrors.commissionPercentage = "Commission rate is required (0–100)";
    } else {
      const rate = Number(formData.commissionPercentage);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100)
        newErrors.commissionPercentage = "Rate must be between 0 and 100";
      else if (rateCap && rate > rateCap.max)
        newErrors.commissionPercentage =
          rateCap.mode === "FLAT"
            ? `Cannot exceed your flat rate (${rateCap.max}%)`
            : `Cannot exceed your highest category rate (${rateCap.max}%)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    const age = getAge(formData.dateOfBirth);
    if (age !== null && age < 21) {
      toast.error(
        "You are not eligible to use this platform. You must be at least 21 years old.",
        { position: "top-center" },
      );
      return;
    }
    if (!validateForm()) return;

    // We must have an agent record to create a sub-agent
    const authUser = user as { id?: string; agent?: { id?: string } } | null;
    const parentAgentId = authUser?.agent?.id || authUser?.id;
    if (!parentAgentId) {
      toast.error("Parent agent information missing");
      return;
    }

    await submit(
      {
        ...formData,
        parentAgentId,
        // DTO expects a number; the text field would fail IsNumber validation.
        commissionPercentage: Number(formData.commissionPercentage),
      },
      false,
    );
  };

  /**
   * Posts the sub-agent. On a cross-pool conflict (email/phone already a
   * player) the backend returns `overridable` — true only for an admin caller.
   * Admin → open the confirm dialog; agent → plain error toast (hard block).
   */
  const submit = async (payload: SubAgentPayload, force: boolean) => {
    setLoading(true);
    try {
      await referralApi.registerSubAgent(
        force ? { ...payload, force: true } : payload,
      );
      toast.success("Sub-Agent registered successfully! 🎉");

      setFormData(emptyForm());
      setErrors({});
      setWarnOpen(false);
      setPending(null);
      onSuccess?.();
    } catch (error: unknown) {
      const conflict = getCrossPoolConflict(error);
      if (conflict && conflict.overridable && !force) {
        setPending(payload);
        setWarnMsg(conflict.message);
        setWarnOpen(true);
      } else {
        toast.error(getApiErrorMessage(error, "Failed to register sub-agent"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmForce = () => {
    if (pending) submit(pending, true);
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .create-phone-input .country-list {
          background-color: #191D24 !important;
          color: white !important;
          border: 1px solid #2F3742 !important;
        }
        /* react-phone-input-2 ships a fixed 300px dropdown, which pushes past
           the right edge of a 360px screen. Cap it to the field instead. */
        @media (max-width: 639px) {
          .create-phone-input .country-list {
            width: 100% !important;
            max-width: calc(100vw - 3rem) !important;
          }
        }
        .create-phone-input .country-list .country:hover {
          background-color: #242B35 !important;
        }
        .create-phone-input .country-list .country.highlight {
          background-color: #242B35 !important;
        }
        .create-phone-input .country-list .search {
          background-color: #191D24 !important;
          padding: 8px !important;
        }
        .create-phone-input .country-list .search-box {
          background-color: #15181E !important;
          color: white !important;
          border: 1px solid #2F3742 !important;
          width: 90% !important;
          margin-left: 10px !important;
        }
        .create-phone-input .selected-flag {
          background-color: transparent !important;
        }
        .create-phone-input .selected-flag .arrow {
          border-top-color: #94a3b8 !important;
        }
        .create-phone-input .selected-flag .arrow.up {
          border-bottom-color: #94a3b8 !important;
        }
      `,
        }}
      />

      <div className="space-y-4">
        {/* Username & Display Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 ">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-white text-xs font-normal">
              Username<span className="text-red-600">*</span>
            </Label>
            <Input
              id="username"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleInputChange}
              className="bg-[#0E1117] border border-gray-800 text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
            />
            {errors.username && (
              <p className="text-red-500 text-xs mt-1">{errors.username}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="displayName"
              className="text-white text-xs font-normal"
            >
              Display Name
            </Label>
            <Input
              id="displayName"
              name="displayName"
              placeholder="Display Name"
              value={formData.displayName}
              onChange={handleInputChange}
              className="bg-[#0E1117] border border-gray-800 text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
            />
          </div>
        </div>

        {/* Password & Confirm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white text-xs font-normal">
              Password<span className="text-red-600">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                className="bg-[#0E1117] border border-gray-800 text-white placeholder:text-slate-400 text-xs focus:border-purple-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-white text-xs font-normal"
            >
              Confirm Password<span className="text-red-600">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="bg-[#0E1117] border border-gray-800 text-white placeholder:text-slate-400 text-xs focus:border-purple-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        {/* Full Name & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-white text-xs font-normal">
              Full Name
            </Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={handleInputChange}
              className="bg-[#0E1117] border border-gray-800 text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white text-xs font-normal">
              Email<span className="text-red-600">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              className="bg-[#0E1117] border border-gray-800 text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>
        </div>

        {/* Gender & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="gender" className="text-white text-xs font-normal">
              Gender<span className="text-red-600">*</span>
            </Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, gender: value }));
                setErrors((prev) => ({ ...prev, gender: "" }));
              }}
            >
              <SelectTrigger
                className={`w-full h-10 px-3 bg-[#0E1117] border border-gray-800 rounded-lg text-xs ${formData.gender ? "text-white" : "text-slate-400"}`}
              >
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent className="z-[10000] bg-[#191D24] text-white border border-gray-800">
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && (
              <p className="text-red-500 text-[11px]">{errors.gender}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-white text-xs font-normal">
              Phone<span className="text-red-600">*</span>
            </Label>
            <div className="create-phone-input">
              <PhoneInput
                country={"us"}
                value={formData.phone}
                onChange={handlePhoneChange}
                enableSearch
                searchPlaceholder="Search country..."
                inputStyle={{
                  width: "100%",
                  height: "40px",
                  backgroundColor: "#0E1117",
                  border: "1px solid #1f2937",
                  color: "#fff",
                  fontSize: "12px",
                  borderRadius: "8px",
                  paddingLeft: "48px",
                }}
                buttonStyle={{
                  backgroundColor: "#0E1117",
                  border: "1px solid #1f2937",
                  borderRight: "none",
                  borderRadius: "8px 0 0 8px",
                }}
                dropdownStyle={{
                  backgroundColor: "#191D24",
                  color: "#fff",
                  border: "1px solid #2F3742",
                  textAlign: "left",
                  width: "300px",
                }}
                searchStyle={{
                  backgroundColor: "#15181E",
                  color: "#fff",
                  border: "1px solid #2F3742",
                  width: "calc(100% - 20px)",
                  margin: "10px",
                  padding: "8px",
                  borderRadius: "6px",
                }}
                containerStyle={{
                  width: "100%",
                }}
              />
            </div>
            {errors.phone && (
              <p className="text-red-500 text-[11px]">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* DOB & Subagent Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="dateOfBirth"
              className="text-slate-400 text-xs font-normal"
            >
              Date of Birth<span className="text-red-600">*</span>
            </Label>
            <AgentDatePicker
              id="dateOfBirth"
              name="dateOfBirth"
              captionLayout="dropdown"
              value={formData.dateOfBirth}
              // Same cap as Register Agent: the calendar cannot select an
              // under-21 or future date, and it opens on the latest legal DOB
              // instead of today — without it the picker accepted any date and
              // the 21+ rule only surfaced as an error on submit.
              max={getMaxDobDate(21)}
              onChange={(iso) =>
                handleInputChange({
                  target: { name: "dateOfBirth", value: iso },
                })
              }
              className="bg-[#0E1117] border border-gray-800 rounded-md h-10 px-3 flex items-center text-white text-xs"
            />
            {errors.dateOfBirth && (
              <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="referralCode"
              className="text-white text-xs font-normal"
            >
              Sub-Agent Referral Code
            </Label>
            <Input
              id="referralCode"
              name="referralCode"
              value={formData.referralCode}
              readOnly
              className="bg-[#0E1117] border border-gray-800 text-purple-400 font-bold text-xs focus:ring-1 focus:ring-purple-500 h-10"
            />
            <p className="text-[10px] text-gray-500 italic mt-0.5">
              Auto-generated 6-digit code
            </p>
          </div>
        </div>

        {/* Commission rate — required at registration. Without it the backend
            defaulted to 0% and the sub-agent earned nothing on every round,
            with no hint anywhere until the rate was edited later. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="commissionPercentage"
              className="text-slate-400 text-xs font-normal"
            >
              Commission Rate (%)<span className="text-red-600">*</span>
              {rateCap && (
                <span className="ml-2 text-purple-400 font-medium normal-case">
                  max {rateCap.max}%
                </span>
              )}
            </Label>
            <Input
              id="commissionPercentage"
              name="commissionPercentage"
              type="number"
              min={0}
              max={rateCap ? rateCap.max : 100}
              step="0.01"
              placeholder={rateCap ? `0 – ${rateCap.max}` : "e.g. 10"}
              value={formData.commissionPercentage}
              onChange={handleInputChange}
              className="bg-[#0E1117] border border-gray-800 text-white text-xs focus:ring-1 focus:ring-purple-500 h-10"
            />
            <p className="text-[10px] text-gray-500 italic mt-0.5">
              {rateCap
                ? rateCap.mode === "FLAT"
                  ? `Applies to all game categories. Maximum is your flat rate: ${rateCap.max}%.`
                  : `Applies to all game categories, capped at your own rate per category at earn time. Your highest category rate is ${rateCap.max}%.`
                : "Share of your commission this sub-agent earns. It is capped at your own rate per game category."}
            </p>
            {errors.commissionPercentage && (
              <p className="text-red-500 text-xs mt-1">
                {errors.commissionPercentage}
              </p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 sm:pt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          {onCancel && (
            <Button
              onClick={onCancel}
              disabled={loading}
              className="bg-[#15181E] hover:bg-[#242B35] text-white font-medium py-2.5 px-8 border border-gray-800"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#B93DEB] hover:bg-purple-700 text-white font-medium py-2.5 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              "Register Sub-Agent"
            )}
          </Button>
        </div>
      </div>

      <CrossPoolWarningModal
        open={warnOpen}
        onClose={() => {
          if (loading) return;
          setWarnOpen(false);
          setPending(null);
        }}
        onConfirm={handleConfirmForce}
        title="This email or phone already belongs to a player account"
        description={warnMsg}
        loading={loading}
      />
    </>
  );
}
