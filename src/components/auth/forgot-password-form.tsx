"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();

  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const { forgotPassword, isLoading } = useAuthStore();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter an email");
      return;
    }

    const res = await forgotPassword(email);

    if (res.success) {
      toast.success(res.message || "Reset link sent!");
      setSent(true);
    } else {
      toast.error(res.message || "Something went wrong");
    }
  };

  const resend = async () => {
    const res = await forgotPassword(email);
    if (res.success) toast.success("Reset link resent!");
    else toast.error(res.message || "Failed to resend email");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="bg-[#15181E] border border-gray-700 text-white shadow-lg">

        <CardHeader>
          <CardTitle className="text-white">
            {!sent ? "Forgot Password" : "Check your Email"}
          </CardTitle>

          {!sent ? (
            <CardDescription className="text-gray-400">
              Enter your email to receive a password reset link.
            </CardDescription>
          ) : (
            <CardDescription className="text-gray-400">
              We have sent a password reset link to:
              <br />
              <span className="text-white font-medium">{email}</span>
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>

          {!sent ? (
            // ------------------------------------
            // PHASE 1 → EMAIL INPUT FORM
            // ------------------------------------
            <form onSubmit={onSubmit} autoComplete="off">
              <FieldGroup className="gap-4">

                <Field className="gap-2">
                  <FieldLabel className="text-gray-300">Email</FieldLabel>

                  <Input
                    type="email"
                    placeholder="Enter your email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </Field>

                <Field className="gap-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </Field>

                <Field className="gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-gray-300 hover:text-white hover:bg-[#242B35] flex items-center justify-center gap-2"
                    onClick={() => router.push("/login")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </Button>
                </Field>

              </FieldGroup>
            </form>

          ) : (
            // ------------------------------------
            // PHASE 2 → EMAIL SENT UI
            // ------------------------------------
            <div className="space-y-2 text-center">

              <div className="flex justify-center">
                <Mail className="h-12 w-12 text-purple-400" />
              </div>

              <p className="text-gray-300">Didn’t receive the email?</p>

              <Button
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                onClick={resend}
              >
                {isLoading ? "Resending..." : "Resend Link"}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-gray-300 hover:text-white hover:bg-[#242B35] flex items-center justify-center gap-2"
                onClick={() => setSent(false)}
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>

            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
