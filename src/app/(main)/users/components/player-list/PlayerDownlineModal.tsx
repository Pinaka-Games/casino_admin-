"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";

const PAGE_SIZE = 10;

interface DownlineRow {
  username: string;
  displayName: string;
  fullName: string;
  phone: string;
  registeredOn: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PlayerDownlineModal({ open, onClose }: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  /* ============================
     MOCK DOWNLINE DATA
  ============================ */
  const rows = useMemo<DownlineRow[]>(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        username: `user${i + 1}@gmail.com`,
        displayName: `Display_${i + 1}`,
        fullName: i % 2 === 0 ? "John" : "Tony",
        phone: "-",
        registeredOn: "2025-07-31 02:09 Am",
      })),
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
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-white text-lg font-medium">Downline</h2>

        <div className="flex items-center gap-3">
          {/* EXPORT */}
          {/* <ExportCSV
            data={rows}
            fileName="downline_users.csv"
            headers={[
              "Username",
              "Display Name",
              "Full Name",
              "Phone",
              "Registered On",
            ]}
            mapRow={(row) => [
              row.username,
              row.displayName,
              row.fullName,
              row.phone,
              row.registeredOn,
            ]}
          /> */}

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* TABLE (CONTENT-BASED HEIGHT) */}
      <div className="overflow-y-auto scrollbar-hide">
        <div className="rounded-lg bg-[#15181E] mx-6 my-4">
          <table className="w-full table-fixed">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-white text-xs">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Display Name
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Full Name
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Phone
                </th>
                <th className="px-4 py-3 text-right text-white text-xs">
                  Registered On
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <NoData title="No downline found" />
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
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.username}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.displayName}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.fullName}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.phone}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs text-right">
                      {row.registeredOn}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION — CONTENT BASED */}
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
