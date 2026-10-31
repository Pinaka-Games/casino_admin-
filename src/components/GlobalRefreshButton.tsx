"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GLOBAL_REFRESH_EVENT } from "@/hooks/use-global-refresh";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardStore } from "@/store/dashboard-store";

type GlobalRefreshButtonProps = {
  className?: string;
  label?: string;
};

export default function GlobalRefreshButton({
  className = "",
  label = "Refresh",
}: GlobalRefreshButtonProps) {
  const router = useRouter();
  const { refreshMe } = useAuthStore();
  const { setRefreshKey } = useDashboardStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);

    window.dispatchEvent(new CustomEvent(GLOBAL_REFRESH_EVENT));
    setRefreshKey();
    router.refresh();

    try {
      await refreshMe();
    } finally {
      window.setTimeout(() => setIsRefreshing(false), 700);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={refresh}
      disabled={isRefreshing}
      className={`rounded-lg border-gray-600 text-gray-200 hover:bg-[#242B35] ${className}`}
    >
      <RefreshCw className={` h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      {label}
    </Button>
  );
}
