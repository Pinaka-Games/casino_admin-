"use client";

import { useRouter } from "next/navigation";

export type ReportItem = {
  id: number;
  label: string;
  badge?: string | number | null;
  variant?: "purple" | "red" | "orange";
  onClick?: () => void;
};

export default function AgentReportsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!isOpen) return null;

  const agentItems: ReportItem[] = [
    {
      id: 1, 
      label: "Payout Requests", 
      badge: "5",
      variant: "orange", 
      onClick: () => {
        router.push("/agent-management/payout-requests");
        onClose();
      },
    },
    {
      id: 2, 
      label: "Commission Ledger", 
      variant: "purple", 
      onClick: () => {
        router.push("/agent-management/deposit-logs");
        onClose();
      }
    },
    { 
      id: 3, 
      label: "Wallet History", 
      variant: "purple",
      onClick: () => {
        router.push("/agent-management/withdraw-logs");
        onClose();
      }
    },
    { 
      id: 4, 
      label: "Sub-Agent History", 
      variant: "purple",
      onClick: () => {
        router.push("/agent-management/sub-agent-history");
        onClose();
      }
    },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      <div className="fixed right-6 top-16 z-50 w-[260px] overflow-hidden rounded-xl shadow-2xl border border-gray-800 bg-[#1D232B] animate-in slide-in-from-top-2 duration-200">
        <div className="p-4 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-4 px-1">
            <h3 className="text-white text-sm font-bold uppercase tracking-wider">Agent Reports</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#111318] flex items-center justify-center hover:bg-red-500/20 hover:text-red-500 transition-all text-gray-500"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="w-full space-y-3">
            {agentItems.map((item) => (
              <button
                key={item.id}
                onClick={() => item.onClick?.()}
                className={`w-full py-2.5 px-4 rounded-xl cursor-pointer text-left relative font-bold text-[11px] uppercase tracking-tight shadow-md transition-all hover:translate-x-1 active:scale-95 text-white ${
                  item.variant === "orange" ? "bg-orange-500" : "bg-purple-600"
                }`}
              >
                {item.label}

                {item.badge && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black bg-white text-black px-2 py-0.5 rounded-full shadow-inner animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-purple-500 to-orange-500" />
      </div>
    </>
  );
}
