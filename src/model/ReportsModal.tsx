"use client";

import { useRouter } from "next/navigation";

type ReportItem = {
  id: number;
  label: string;
  badge?: string | number | null;
  variant?: "purple" | "red";
  onClick?: () => void;
};

export default function ReportsModal({
  isOpen,
  onClose,
  items,
}: {
  isOpen: boolean;
  onClose: () => void;
  items?: ReportItem[];
}) {
  const router = useRouter();
  if (!isOpen) return null;

  const defaultItems: ReportItem[] = [
    {
      id: 1, 
      label: "Win Lose Report", 
      variant: "purple", 
      onClick: () => {
        router.push("/report/win-loss-report");
        onClose();
      },
    },
    {
      id: 2, 
      label: "Game Report", 
      variant: "purple", 
      onClick: () => {
        router.push("/report/game-report");
        onClose();
      }
    },
    { 
      id: 3, 
      label: "Daily Report", 
      variant: "purple",
      onClick: () => {
        router.push("/report/daily-report");
        onClose();
      }
    },
    { 
      id: 4, 
      label: "KYC Listing", 
      variant: "red",
      onClick: () => {
        router.push("/users/kyc-listing");
        onClose();
      }
    },
    { 
      id: 5, 
      label: "Withdrawal Listing", 
      variant: "red",
      onClick: () => {
        router.push("/wallet/withdrawal-listing");
        onClose();
      }
    },
    { 
      id: 6, 
      label: "Manual Deposit Listing", 
      variant: "red",
      onClick: () => {
        router.push("/wallet/manual-deposit-listing");
        onClose();
      }
    },
  ];

  const list = items ?? defaultItems;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      <div className="fixed right-18 top-18 z-50 w-[300px] md:w-[250px] max-h-[450px] overflow-hidden rounded-md shadow-xl bg-[#1D232B]">
        <div className="p-2 md:p-4 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-3 px-1">
            <h3 className="text-white text-base md:text-lg font-normal">Reports</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md bg-[#111318] flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <svg
                className="w-4 h-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="w-full space-y-2">
            {list.map((item) => (
              <button
                key={item.id}
                onClick={() => item.onClick?.()}
                className={`w-full py-1.5 rounded-lg cursor-pointer text-center relative font-normal text-white shadow-md transition-all hover:scale-[1.02] ${item.variant === "red" ? "bg-red-500" : "bg-purple-500"
                  }`}
              >
                {item.label}

                {item.badge && (
                  <span
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-3 py-1 rounded-full ${item.variant === "red"
                      ? "bg-[#B93DEB] text-white"
                      : "bg-[#CC4949] text-white"
                      }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="h-3 bg-linear-to-b from-transparent to-black/20" />
      </div>
    </>
  );
}
