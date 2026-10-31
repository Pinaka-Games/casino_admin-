"use client";

import { useState } from "react";
import { X, Wrench } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import ViewInfoModal from "./ViewInfoModal";

/* =========================
   TYPES
========================= */
export interface UserBonusRow {
  date: string;
  bonus: string;
  amount: number;
  activity: string;
}

interface InfoItem {
  label: string;
  value: string | number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
  rows: UserBonusRow[];
}

/* =========================
   COMPONENT
========================= */
export default function UserBonusViewModal({
  open,
  onClose,
  email,
  rows,
}: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoData, setInfoData] = useState<InfoItem[]>([]);

  if (!open) return null;

  return (
    <>
      {/* FULL SCREEN OVERLAY */}
      <div className="fixed inset-0 z-50 bg-black/70">
        <div className="h-screen w-screen bg-[#15181E] flex flex-col">
          {/* HEADER */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#232733]">
            <div>
              <h2 className="text-white text-lg font-medium">
                Report / User Bonus
              </h2>
              <p className="text-gray-400 text-sm mt-1">{email}</p>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* TABLE */}
          <div className="flex-1 overflow-hidden p-6">
            <div className="h-full border border-[#232733] rounded-lg overflow-hidden">
              <div className="h-full overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1E222B] sticky top-0 z-10">
                    <tr className="text-gray-400">
                      <Th>Date</Th>
                      <Th>Bonus</Th>
                      <Th>Amount</Th>
                      <Th>Status</Th>
                      <Th className="text-center">Action</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-t border-[#232733] text-white"
                      >
                        <Td>{row.date}</Td>
                        <Td>{row.bonus}</Td>
                        <Td>{row.amount}</Td>
                        <Td>{row.activity}</Td>

                        <td className="px-4 py-3 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400"
                              >
                                <Wrench size={18} />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setInfoData([
                                    { label: "User Email", value: email },
                                    { label: "Date", value: row.date },
                                    { label: "Bonus", value: row.bonus },
                                    { label: "Amount", value: row.amount },
                                    { label: "Activity", value: row.activity },
                                  ]);
                                  setInfoOpen(true);
                                }}
                              >
                                View info
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}

                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-16 text-center text-gray-500"
                        >
                          No data found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW INFO MODAL */}
      <ViewInfoModal
        open={infoOpen}
        onClose={() => {
          setInfoOpen(false);
          setInfoData([]);
        }}
        data={infoData}
      />
    </>
  );
}

/* =========================
   TABLE HELPERS
========================= */
function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left font-normal whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}