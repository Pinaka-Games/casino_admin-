"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";

const PAGE_SIZE = 10;

interface ActivityRow {
  username: string;
  activity: string;
  deviceType: string;
  activityOn: string;
}

interface Props {
  open: boolean;
  username: string;
  onClose: () => void;
}

export default function PlayerActivityModal({ open, username, onClose }: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  /* ============================
     MOCK ACTIVITY DATA
  ============================ */
  const rows = useMemo<ActivityRow[]>(
    () =>
      Array.from({ length: 18 }).map(() => ({
        username,
        activity: "Launch Game",
        deviceType: "Update",
        activityOn: "2025-07-31 02:09 Am",
      })),
    [username]
  );

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-9999 bg-[#0a0e1a] flex flex-col">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-white text-lg font-medium">User Activity</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* TABLE */}
      <div className="overflow-y-auto scrollbar-hide">
        <div className="rounded-lg bg-[#15181E] mx-6 my-4">
          <table className="w-full table-fixed">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-white text-xs">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Activity
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Device Type
                </th>
                <th className="px-4 py-3 text-right text-white text-xs">
                  Activity On
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <NoData title="No activity found" />
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-[#1a2030] ${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.username}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.activity}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.deviceType}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs text-right">
                      {row.activityOn}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION — CONTENT-BASED */}
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
