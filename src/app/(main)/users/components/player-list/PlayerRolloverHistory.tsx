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
interface RolloverRow {
  type: string;
  account: string;
  status: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ============================
   COMPONENT
============================ */
export default function PlayerRolloverModal({ open, onClose }: Props) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date("2025-07-01T00:00:00")
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date("2025-07-14T23:59:59")
  );
  const [currentPage, setCurrentPage] = useState(1);

  /* ============================
     MOCK DATA
  ============================ */
  const rows = useMemo<RolloverRow[]>(
    () => [],
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
    <div className="fixed inset-0 z-9999 bg-[#0a0e1a] flex flex-col">
      {/* ================= HEADER ================= */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-white text-lg font-medium">
          Rollover History
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
        <DatePicker date={startDate} onChange={setStartDate} />
        <DatePicker date={endDate} onChange={setEndDate} />
        <div className="flex-1" />

        <ExportCSV
          data={rows}
          fileName="rollover_history.csv"
          headers={["Type", "Account", "Status", "Created At"]}
          mapRow={(row) => [
            row.type,
            row.account,
            row.status,
            row.createdAt,
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
                  Type
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-white text-xs">
                  Created At
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className=" text-center">
                    <NoData title="No data found" />
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
                      {row.type}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.account}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.status}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs text-right">
                      {row.createdAt}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= PAGINATION (CONTENT-BASED) ================= */}
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
