"use client";
import React, { useState } from "react";
import { Eye, EyeOff, Calendar, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import UsDateInput from "@/components/UsDateInput";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserRegistration } from "@/hooks/use-users";
import { getAge, getMaxDobDate } from "@/lib/age";
import { validatePhone, maxPhoneDigits } from "@/lib/phone";
import CrossPoolWarningModal from "@/components/CrossPoolWarningModal";
import { passwordRule, PASSWORD_HINT } from "@/components/validators/common.rules";
import toast from "react-hot-toast";

export default function RegistrationForm() {
  const { register, loading } = useUserRegistration();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [countryCode, setCountryCode] = useState("+1");
  const [formData, setFormData] = useState({
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
    referralCode: "",
    // referral: "",
  });

  // Cross-pool "create anyway?" confirmation (email/phone already staff).
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");
  const [pending, setPending] = useState<typeof formData | null>(null);

  const resetForm = () => {
    setFormData({
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
      referralCode: "",
    });
    setCountryCode("+1");
    setErrors({});
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  // Latest DOB that still makes the user 18+ (blocks younger dates in the picker).
  const maxDob = getMaxDobDate(18);

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

    const phoneError = validatePhone(formData.phone, countryCode);
    if (phoneError) newErrors.phone = phoneError;

    if (!formData.gender) newErrors.gender = "Gender is required";

    if (!formData.dateOfBirth)
      newErrors.dateOfBirth = "Date of birth is required";
    else if (getAge(formData.dateOfBirth) !== null && (getAge(formData.dateOfBirth) as number) < 18)
      newErrors.dateOfBirth = "Must be at least 18 years old";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();

    const age = getAge(formData.dateOfBirth);
    if (age !== null && age < 18) {
      toast.error(
        "You are not eligible to use this platform. You must be at least 18 years old.",
        { position: "top-center" }
      );
      return;
    }

    if (!validateForm()) return;

    const outcome = await register(formData);
    if (outcome.status === "success") {
      resetForm();
    } else if (outcome.status === "conflict") {
      // email/phone already belongs to a staff account — confirm with the admin.
      setPending(formData);
      setWarnMsg(outcome.conflict.message);
      setWarnOpen(true);
    }
    // status === "error": already toasted by the hook; keep the form intact.
  };

  // Admin confirmed the cross-pool warning → re-submit with force.
  const handleConfirmForce = async () => {
    if (!pending) return;
    const outcome = await register(pending, true);
    if (outcome.status === "success") {
      setWarnOpen(false);
      setPending(null);
      resetForm();
    } else {
      // Any non-success on the forced attempt was toasted — close the dialog.
      setWarnOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#15181E]!">
      {/* Header with background */}
      <div className="bg-[#191D24] m-3 px-4 py-2 flex items-center justify-between gap-4 md:m-6 md:px-8">
        <h1 className="text-base font-normal text-white">
          User / Register User
        </h1>
        {/* Return leg of the button on Players List. */}
        <Link href="/users/players-list">
          <Button
            variant="outline"
            className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Players List
          </Button>
        </Link>
      </div>

      {/* Form Container */}
      <div className="flex justify-center pb-8">
        <div className="w-full max-w-7xl px-3 md:px-6">
          <div className="bg-[#191D24] rounded-lg p-4 md:p-8">
            <form
              className="space-y-4"
              autoComplete="off"
              onSubmit={handleSubmit}
            >
              {/* Username */}
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  className="text-white text-xs font-normal"
                >
                  Username<span className="text-red-600">*</span>
                </Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                />
                {errors.username && (
                  <p className="text-red-500 text-xs mt-1">{errors.username}</p>
                )}

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
                  className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-2"></div>

              {/* Password */}
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-white text-xs font-normal"
                >
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
                    className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500 pr-10"
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

              {/* Confirm Password */}
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
                    className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label
                  htmlFor="fullName"
                  className="text-white text-xs font-normal"
                >
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="Full Name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                />
              </div>

              {/* Ethnicity and State */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="ethnicity"
                    className="text-white text-xs font-normal"
                  >
                    Ethnicity
                  </Label>
                  <Input
                    id="ethnicity"
                    name="ethnicity"
                    placeholder="Ethnicity"
                    value={formData.ethnicity}
                    onChange={handleInputChange}
                    className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="state"
                    className="text-white text-xs font-normal"
                  >
                    State
                  </Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="State"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Country and Pin Code */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="country"
                    className="text-white text-xs font-normal"
                  >
                    Country
                  </Label>
                  <Input
                    id="country"
                    name="country"
                    placeholder="Country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="pinCode"
                    className="text-white text-xs font-normal"
                  >
                    Zip code
                  </Label>
                  <Input
                    id="pinCode"
                    name="pinCode"
                    placeholder="Zip code"
                    value={formData.pinCode}
                    onChange={handleInputChange}
                    className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Gender  */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* GENDER */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="gender"
                    className="text-white text-xs font-normal"
                  >
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
                      className={`w-full h-10 px-3 bg-[#15181E]! border-none rounded-lg text-xs ${
                        formData.gender ? "text-white" : "text-slate-400"
                      }`}
                    >
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>

                    <SelectContent className="bg-[#15181E]! text-white">
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  {errors.gender && (
                    <p className="text-red-500 text-[11px]">{errors.gender}</p>
                  )}
                </div>

                {/* PHONE with Country Code Selector */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="phone"
                    className="text-white text-xs font-normal"
                  >
                    Phone<span className="text-red-600">*</span>
                  </Label>

                  <div className="flex items-center gap-2 h-10 bg-[#15181E]! rounded-lg overflow-hidden">
                    <Select
                      value={countryCode}
                      onValueChange={setCountryCode}
                    >
                      <SelectTrigger className="w-[76px] shrink-0 sm:w-[100px] h-full  border-none text-slate-400 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#15181E]! text-white">
                        <SelectItem value="+1">US +1</SelectItem>
                        <SelectItem value="+44">GB +44</SelectItem>
                        <SelectItem value="+91">IN +91</SelectItem>
                        <SelectItem value="+86">CN +86</SelectItem>
                        <SelectItem value="+81">JP +81</SelectItem>
                        <SelectItem value="+82">KR +82</SelectItem>
                        <SelectItem value="+49">DE +49</SelectItem>
                        <SelectItem value="+33">FR +33</SelectItem>
                        <SelectItem value="+61">AU +61</SelectItem>
                        <SelectItem value="+971">AE +971</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={maxPhoneDigits(countryCode)}
                      placeholder="Phone number"
                      value={formData.phone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, maxPhoneDigits(countryCode));
                        setFormData((prev) => ({ ...prev, phone: digits }));
                        setErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                        className="min-w-0 flex-1 bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                    />
                  </div>

                  {errors.phone && (
                    <p className="text-red-500 text-[11px]">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-white text-xs font-normal"
                >
                  Email<span className="text-red-600">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="bg-[#15181E]! border-none text-white placeholder:text-slate-400 text-xs focus:border-purple-500"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <Label
                  htmlFor="dateOfBirth"
                  className="text-slate-400 text-xs font-normal"
                >
                  Date of Birth<span className="text-red-600">*</span>
                </Label>
                <UsDateInput
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  max={maxDob}
                  onChange={(iso) =>
                    handleInputChange({ target: { name: "dateOfBirth", value: iso } } as any)
                  }
                  className="bg-[#15181E] rounded-md h-9 px-3 flex items-center text-white text-xs"
                />
                {errors.dateOfBirth && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.dateOfBirth}
                  </p>
                )}
              </div>


              {/* Referral Code */}
             

              {/* Submit Button */}
              <div className="pt-8 flex justify-end">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#B93DEB] hover:bg-purple-700 text-white font-medium py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    "Register"
                  )}
                </Button>
              </div>
            </form>
          </div>
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
        title="This email or phone already belongs to a staff account"
        description={warnMsg}
        loading={loading}
      />
    </div>
  );
}
