"use client";

import DateFilters from "./components/DateFilters";
import KpiCards from "./components/KpiCards";
import RecentTransactions from "./components/RecentTransactions";
import UserActivity from "./components/UserActivity";
import FinancialOverview from "./components/FinancialOverview";
import DashboardHeader from "./components/DashboardHeader";
import Kyclisting from "./components/Kyclisting";
import { useDashboardStore } from "@/store/dashboard-store";

export default function Page() {
  return (
    <div className="flex flex-col gap-3 p-2">
      <DashboardHeader title="Dashboard" />
      <DateFilters />
      <KpiCards />

      {/* Three dense panels, each with its own table or stat list. Forced into
          three columns at every width they were ~140px wide on a phone, which
          turned every label into a vertical stack of single words. They stack
          on mobile, pair up on tablet, and only sit side by side once there is
          room for it. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <UserActivity />
        <FinancialOverview />
        <Kyclisting />
      </div>

      <div className="w-full">
        <RecentTransactions />
      </div>
    </div>
  );
}
