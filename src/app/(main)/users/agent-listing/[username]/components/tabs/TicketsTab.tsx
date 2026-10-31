"use client";

import React from "react";
import NoData from "@/components/NoData";

/* ============================
   TYPES
============================ */
interface TicketRow {
  ticketId: string;
  name: string;
  description: string;
  assignTo: string;
  status: "Pending" | "Resolved";
}

const ticketsData: TicketRow[] = [
  {
    ticketId: "46569823",
    name: "Ticket Name",
    description: "Yorem ipsum dolor sit amet",
    assignTo: "John",
    status: "Pending",
  },
  {
    ticketId: "9856464",
    name: "Ticket Name",
    description: "Torem ipsum dolor sit amet",
    assignTo: "Tony",
    status: "Resolved",
  },
];

const TicketsTab = () => {
  return (
    <div className="rounded-lg bg-[#15181E]">
      <table className="w-full table-fixed">
        {/* HEADERS */}
        <thead className="bg-[#242B35]">
          <tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-center text-xs text-white">
              Ticket Id
            </th>
            <th className="px-4 py-3 text-center text-xs text-white">
              Name
            </th>
            <th className="px-4 py-3 text-center text-xs text-white">
              Description
            </th>
            <th className="px-4 py-3 text-center text-xs text-white">
              Assign to
            </th>
            <th className="px-4 py-3 text-center text-xs text-white">
              Status
            </th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody>
          {ticketsData.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-16 text-center">
                <NoData title="No tickets found" />
              </td>
            </tr>
          ) : (
            ticketsData.map((row, index) => (
              <tr
                key={index}
                className={`hover:bg-[#1a2030] ${
                  index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                }`}
              >
                <td className="px-4 py-3 text-center text-xs text-gray-300">
                  {row.ticketId}
                </td>

                <td className="px-4 py-3 text-center text-xs text-gray-300">
                  {row.name}
                </td>

                <td className="px-4 py-3 text-center text-xs text-gray-400 truncate">
                  {row.description}
                </td>

                <td className="px-4 py-3 text-center text-xs text-gray-300">
                  {row.assignTo}
                </td>

                <td className="px-4 py-3 text-center text-xs font-medium">
                  <span
                    className={
                      row.status === "Pending"
                        ? "text-orange-400"
                        : "text-green-400"
                    }
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TicketsTab;
