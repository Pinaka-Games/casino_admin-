"use client";

import { useEffect, useState } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { Eye } from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import KycStatusBadge from "@/components/KycStatusBadge";
import KYCDetailsModal from "../../../../components/KYCDetailsModal";
import { getKycByUserId, type AdminKycRow } from "@/api/kyc/kyc.admin.api";

export default function KycTab({ username }: { username: string }) {
  const [row, setRow] = useState<AdminKycRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await getKycByUserId(username);
        if (active) setRow(res || null);
      } catch {
        if (active) toast.error("Failed to load KYC profile");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [username]);


  return (
    <div className="overflow-x-auto rounded-lg bg-[#15181E] scrollbar-hide">
      <table className="w-full min-w-[760px]">
        <thead className="bg-[#242B35]">
          <tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left text-white text-xs w-[220px]">KYC ID</th>
            <th className="px-4 py-3 text-left text-white text-xs w-[140px]">Status</th>
            <th className="px-4 py-3 text-left text-white text-xs w-[150px]">Level</th>
            <th className="px-4 py-3 text-left text-white text-xs w-[200px]">Applicant ID</th>
            <th className="px-4 py-3 text-left text-white text-xs w-[180px]">Submitted At</th>
            <th className="px-4 py-3 text-left text-white text-xs w-[180px]">Updated At</th>
            <th className="px-4 py-3 text-center text-white text-xs w-[80px]">Details</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="p-0">
                {/* Shimmer rows under the real header — the column layout is
                    already known, so it should not be replaced by a spinner. */}
                <TableSkeleton rows={3} cols={7} />
              </td>
            </tr>
          ) : !row ? (
            <tr>
              <td colSpan={7} className="py-16">
                <NoData title="No KYC profile for this user" />
              </td>
            </tr>
          ) : (
            <tr className="bg-[#191D24] hover:bg-[#1a2030]">
              <td className="px-4 py-3 text-gray-300 text-xs font-mono truncate" title={row.id}>
                {row.id}
              </td>
              <td className="px-4 py-3 text-xs">
                <KycStatusBadge
                  status={row.status}
                  adminApproved={row.isAdminApproved}
                />
              </td>
              <td className="px-4 py-3 text-gray-300 text-xs">{row.levelName || "-"}</td>
              <td className="px-4 py-3 text-gray-300 text-xs truncate" title={row.applicantId || "-"}>
                {row.applicantId || "-"}
              </td>
              <td className="px-4 py-3 text-gray-300 text-xs">
                {(row as any).submittedAt
                  ? new Date((row as any).submittedAt).toLocaleString()
                  : "-"}
              </td>
              <td className="px-4 py-3 text-gray-300 text-xs">
                {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => setOpenModal(true)}
                  className="text-purple-400 hover:text-purple-300"
                >
                  <Eye size={18} />
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <KYCDetailsModal
        open={openModal}
        data={row}
        onClose={() => setOpenModal(false)}
      />
    </div>
  );
}
