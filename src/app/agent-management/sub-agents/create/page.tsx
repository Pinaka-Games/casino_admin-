"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SubAgentForm from "../components/SubAgentForm";

export default function RegisterSubAgentPage() {
  const router = useRouter();
  const backToListing = () => router.push("/agent-management/sub-agents");

  return (
    <div className="min-h-dvh bg-[#15181E]!">
      {/* HEADER */}
      <div className="bg-[#191D24] p-3! sm:p-4! mt-3! sm:mt-4! mx-3! sm:mx-4! rounded-lg flex items-center gap-2 sm:gap-3">
        <button
          onClick={backToListing}
          className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          title="Back to sub-agents"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm sm:text-base font-normal text-white leading-snug">
          Agent Management / Register Sub-Agent
        </h1>
      </div>

      {/* Form Container */}
      <div className="flex justify-center pb-8 p-3 sm:p-4">
        <div className="w-full max-w-7xl">
          <div className="bg-[#191D24] rounded-lg p-3 sm:p-4 shadow-2xl">
            <SubAgentForm onSuccess={backToListing} onCancel={backToListing} />
          </div>
        </div>
      </div>
    </div>
  );
}
