import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";


export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#0A0E1A]">
      <div className="w-full max-w-sm">

        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>

      </div>
    </div>
  );
}
