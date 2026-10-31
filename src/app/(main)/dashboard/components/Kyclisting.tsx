"use client";

import { useState } from "react";
import Image from "next/image";
import { user } from "@/assets/icons";
import { useDashboardStore } from "@/store/dashboard-store";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Kyclisting() {
  const { stats: data, loading: isLoading } = useDashboardStore();
  const [metricsInfoOpen, setMetricsInfoOpen] = useState(false);

  const kycData = [
    {
      label: "Approved KYC",
      value: data?.totalApprovedKycCount?.toLocaleString() ?? "0",
    },
    {
      label: "Total Medal Claims",
      value: data?.totalMedalClaimsCount?.toLocaleString() ?? "0",
    },
    {
      label: "Total Games",
      value: data?.totalGameCount?.toLocaleString() ?? "0",
    },
    {
      label: "Tax Generation",
      value: data?.totalTaxVerifiedCount?.toLocaleString() ?? "0",
    },
    {
      label: "Total SEON Allow",
      value: data?.totalSeonAllowCount?.toLocaleString() ?? "0",
    },
    {
      label: "Total SEON Block",
      value: data?.totalSeonBlockCount?.toLocaleString() ?? "0",
    },
  ];

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-10 relative overflow-hidden rounded-xl h-[400px]">
      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent animate-shimmer pointer-events-none"></div>
      <div className="flex flex-col items-center gap-3 mt-4">
        <div className="h-12 w-12 bg-[#1F242D] rounded-full"></div>
        <div className="h-5 w-32 bg-[#1F242D] rounded"></div>
      </div>
      <div className="space-y-2 pt-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-2">
            <div className="h-4 w-44 bg-[#1F242D] rounded"></div>
            <div className="h-4 w-40 bg-[#1F242D] rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-[#1F242D] shadow-2xl overflow-hidden bg-[#161B23]">
      {isLoading && !data ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="flex flex-col items-center mb-2 pt-4 ">
            <div className="rounded-full flex items-center justify-center mb-2 shadow-lg p-2 bg-[#1F242D]">
              <Image
                src={user}
                alt="kyc icon"
                width={32}
                height={32}
                className=""
              />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-base uppercase tracking-tight">
                Total Key Metrics
              </h2>
              <Dialog open={metricsInfoOpen} onOpenChange={setMetricsInfoOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2A303A] text-gray-400 transition-colors hover:bg-[#343B46] hover:text-white"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100%-2rem)] max-w-sm border border-[#2A3340] bg-[#1F242D] p-0 text-white shadow-2xl">
                  <DialogHeader className="border-b border-[#2A3340] px-5 py-4">
                    <DialogTitle className="text-sm font-bold uppercase tracking-wider text-white">
                      Total Key Metrics
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-400">
                      Platform-Wide Operational Totals
                    </DialogDescription>
                  </DialogHeader>
                  <div className="px-5 py-4 text-sm leading-6 text-gray-300">
                    These Values show Platform-Wide Totals such as KYC Approvals,
                    Medal Claims, Total Games, Tax Records, and SEON Decisions.
                    They are Lifetime Operational Metrics and are not reduced by
                    the Dashboard Date Filter.
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-2 px-4 pb-4">
            {kycData.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-white text-[13px] font-medium tracking-wide">
                  {item.label}
                </span>

                <div className="px-4 py-2 min-w-[65px] flex items-center justify-center ">
                  <span className="text-white text-[15px] font-black tabular-nums tracking-tight">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
