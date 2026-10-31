"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";

import DatePicker from "@/components/DatePicker";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";

const PAGE_SIZE = 10;

/* ============================
   TYPES
============================ */
interface TransactionRow {
  createdAt: string;
  name: string;
  cashIn: string;
  cashOut: string;
  walletId: string;
  balanceType: string;
  remark: string;
  balanceAfter: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ============================
   COMPONENT
============================ */
export default function PlayerTransactionModal({
  open,
  onClose,
}: Props) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date("2025-07-01T00:00:00")
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date("2025-07-14T23:59:59")
  );
  const [currentPage, setCurrentPage] = useState(1);

  /* ============================
     MOCK DATA (AS PER SCREENSHOT)
  ============================ */
  const rows = useMemo<TransactionRow[]>(
    () => [
      {
        createdAt: "2025-08-02 01:13 pm",
        name: "Game Withdraw",
        cashIn: "-",
        cashOut: "MYR 0",
        walletId: "460",
        balanceType: "Withdrawable Balance",
        remark: "Withdraw from API2ALL Ref ID: 60393",
        balanceAfter: "MYR 216000",
      },
    ],
    []
  );

  /* ============================
     PAGINATION
  ============================ */
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0e1a] flex flex-col">
      {/* ================= HEADER ================= */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-white text-lg font-medium">
          Transaction History
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* ================= FILTER BAR ================= */}
      <div className="bg-[#15181E] mx-6 mt-4 rounded-lg p-2 flex items-center gap-3">
        <div className="px-4 h-10 flex items-center bg-[#242B35] rounded-md text-white text-sm">
          All transaction Log
        </div>

        <DatePicker date={endDate} onChange={setEndDate} />
        <DatePicker date={startDate} onChange={setStartDate} />

        <div className="flex-1" />

        <ExportCSV
          data={rows}
          fileName="transaction_history.csv"
          headers={[
            "Created At",
            "Name",
            "Cash In",
            "Cash Out",
            "Wallet Id",
            "Balance Type",
            "Remark",
            "Balance After",
          ]}
          mapRow={(row) => [
            row.createdAt,
            row.name,
            row.cashIn,
            row.cashOut,
            row.walletId,
            row.balanceType,
            row.remark,
            row.balanceAfter,
          ]}
          getRowDate={(row) => row.createdAt}
        />
      </div>

      {/* ================= TABLE ================= */}
      <div className="overflow-y-auto scrollbar-hide">
        <div className="rounded-lg bg-[#15181E] mx-6 my-4">
          <table className="w-full table-fixed">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-white text-xs">
                  Created At
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Cash In
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Cash Out
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Wallet Id
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Balance Type
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Remark
                </th>
                <th className="px-4 py-3 text-right text-white text-xs">
                  Balance After
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <NoData title="No transaction found" />
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-[#1a2030] ${
                      index % 2 === 0
                        ? "bg-[#191D24]"
                        : "bg-[#161A21]"
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.createdAt}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.cashIn}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.cashOut}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.walletId}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.balanceType}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.remark}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs text-right">
                      {row.balanceAfter}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= PAGINATION ================= */}
      {totalPages > 1 && (
        <div className="px-6 pb-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
