// components/login-form.tsx
"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react"; // 👈 added
import { useAuthStore } from "@/store/auth-store";
import { sanitizeCredential } from "@/lib/credentials";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const { login, isLoading: authLoading } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // 👈 added

  // The credentials email links here with ?email=... so the recipient does not
  // have to retype the address they were just sent. Defaulted, not controlled —
  // they can still edit it, and it never fights their password manager.
  //
  // The password is NOT accepted from the URL by design: query strings end up
  // in history, access logs and Referer headers. The email shows it to copy.
  // Read from location rather than `useSearchParams`, which forces the whole
  // page under a Suspense boundary to build. One effect on mount is cheaper
  // than restructuring the login screen for a single optional field.
  const [prefilledEmail, setPrefilledEmail] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("email");
    if (value) setPrefilledEmail(value);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    // Pasted credentials arrive carrying invisible characters from the email
    // they were copied out of — strip those before anything looks at the value.
    const email = sanitizeCredential(formData.get("email"));
    const password = sanitizeCredential(formData.get("password"));

    // Validated here rather than with `required` + `type="email"` on the
    // inputs: the browser rejects the form on its own before any of this runs —
    // no request, no toast, and a validation bubble that is easy to miss, so
    // the button simply looks broken. That is what a pasted credential used to
    // hit, either through an invisible character or through the "Username" row
    // of the credentials email, which the field would not accept at all.
    if (!email || !password) {
      toast.error("Enter your email or username, and your password");
      return;
    }

    setIsLoading(true);

    try {
      const result = await login({ email, password });

      if (result.success) {
        const state = useAuthStore.getState();
        const user = state.user;
        const role = user?.roles?.[0]?.name || "User";
        
        toast.success(`${result.message || "Login successfully"} as ${role}`);

        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get("callbackUrl");

        if (callbackUrl) {
          router.push(callbackUrl);
          return;
        }
        
        const isAgent = user?.roles?.some(r => r.name.toLowerCase() === 'agent');
        
        // Agents get their own portal; everyone else lands on the dashboard.
        // Employees used to be sent to /employee, a placeholder that rendered
        // the word "EMployee" and nothing else. The dashboard has no permission
        // rule of its own, so it is reachable by every signed-in staff account
        // and each card on it is gated individually.
        if (isAgent) {
          router.push("/agent-management");
        } else {
          router.push("/dashboard");
        }
      } else {
        toast.error(result.message || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loading = isLoading || authLoading;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="bg-[#242B35] text-white border border-gray-700 shadow-lg">
        <CardHeader>
          <CardTitle className="text-white">Login to your account</CardTitle>
          <CardDescription className="text-gray-400">
            Enter your email or username below to login to your account
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* autoComplete="on": this is the one form in the back office where
              the browser SHOULD offer a saved login. */}
          <form onSubmit={handleSubmit} autoComplete="on">
            <FieldGroup>

              {/* Email */}
              <Field>
                <FieldLabel htmlFor="email" className="text-gray-300 text-sm">
                  Email or Username
                </FieldLabel>

                {/* type="text", not "email": the field now takes a username
                    too, and the browser's own email check runs BEFORE any of
                    our code — it blocked submit silently, with no request and
                    no message. handleSubmit validates instead, and can say
                    why. The API resolves either form (AdminLoginDto.email). */}
                <Input
                  id="email"
                  name="email"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="m@example.com or your username"
                  disabled={loading}
                  className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500"
                />
              </Field>

              {/* Password */}
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password" className="text-gray-300 text-sm">
                    Password
                  </FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="ml-auto inline-block text-sm text-purple-400 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>

                <div className="relative">
                  {/* `current-password`, overriding the shared Input's
                      `new-password` default (right for the admin's create-user
                      forms, wrong here — it hides the saved login). */}
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={loading}
                    className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500 pr-10"
                  />

                  {/* Show / Hide Icon */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-200"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </Field>

              {/* Button */}
              <Field>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </Field>

            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
