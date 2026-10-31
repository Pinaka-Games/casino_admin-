"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Loader2, Eye, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";

import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";
import Pagination from "@/components/Pagination";
import { useWaitlistStore } from "@/store/waitlist-store";
import { WaitlistEntry } from "@/types/waitlist";

import toast from "react-hot-toast";
import ListSearch from "@/components/TableSearch/ListSearch";

/* ---------------- CONSTANTS ---------------- */
const PAGE_SIZE = 10;

export default function MessageTemplateListing() {
    const entries = useWaitlistStore((state) => state.entries);
    const loading = useWaitlistStore((state) => state.loading);
    const fetchEntries = useWaitlistStore((state) => state.fetchEntries);
    const fetchGlobalStatus = useWaitlistStore((state) => state.fetchGlobalStatus);
    const updateEntryStatus = useWaitlistStore((state) => state.updateEntryStatus);

    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");

    const [openModal, setOpenModal] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);

    useEffect(() => {
        fetchEntries();
        fetchGlobalStatus();
    }, [fetchEntries, fetchGlobalStatus]);

    /* -------- SEARCH -------- */
    const filteredRows = useMemo(() => {
        if (!searchTerm) return entries;
        const lowerSearch = searchTerm.toLowerCase();

        return entries?.filter(row =>
            row?.name?.toLowerCase()?.includes(lowerSearch) ||
            row?.email?.toLowerCase()?.includes(lowerSearch) ||
            row?.referralCode?.toLowerCase()?.includes(lowerSearch)
        );
    }, [entries, searchTerm]);

    /* -------- PAGINATION -------- */
    const totalPages = Math.ceil(filteredRows?.length / PAGE_SIZE);

    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRows?.slice(start, start + PAGE_SIZE);
    }, [filteredRows, currentPage]);

    /* -------- STATUS TOGGLE -------- */
    const handleToggleStatus = async (id: string | number, currentStatus: string) => {
        const isActive = ["Active", "verified", "approved", "converted"].includes(currentStatus);
        const newStatus = isActive ? "blocked" : "approved";

        try {
            await updateEntryStatus(id, newStatus);

            // ✅ Local update instead of fetchEntries
            useWaitlistStore.setState((state) => ({
                entries: state.entries.map((entry) =>
                    entry.id === id ? { ...entry, status: newStatus } : entry
                ),
            }));

            toast.success("Status updated successfully");
        } catch {
            toast.error("Failed to update status");
        }
    };


    return (
        <div className="h-screen flex flex-col bg-[#15181E] p-6 overflow-hidden">

            {/* HEADER */}
            <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg">
                <h1 className="text-base font-normal text-white">
                    User / Waitlist Referral Code
                </h1>
            </div>

            {/* FILTER BAR */}
            <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex items-center gap-3 shrink-0">

                <ListSearch
                    value={searchTerm || ""}
                    onChange={setSearchTerm}
                    placeholder="Search by username / email id"
                />


                <div className="flex-1" />

                <ExportCSV
                    data={entries}
                    fileName="waitlist_referral_code.csv"
                    getRowDate={(row) => row.createdAt}
                    headers={[
                        "Name",
                        "Email",
                        "Mobile NO",
                        "Referral Code",
                        "Referrals",
                        "Converted",
                        "Create At",
                        "Status"
                    ]}
                    mapRow={(row) => [
                        row?.name,
                        row?.email,
                        row?.mobileNo,
                        row?.referralCode,
                        row?.referralCount,
                        row?.isConverted ? "Yes" : "No",
                        row?.createdAt,
                        ["Active", "verified", "approved", "converted"].includes(row?.status)
                            ? "Active"
                            : "Inactive",
                    ]}
                />
            </div>





            {/* TABLE */}
            <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide">
                <table className="w-full min-w-[820px] table-fixed">

                    <thead className="bg-[#242B35]">
                        <tr className="border-b border-gray-800 text-nowrap">
                            <th className="px-4 py-3 text-left text-white text-xs w-[60px]">S.no</th>
                            <th className="px-4 py-3 text-left text-white text-xs w-[80px]">Name</th>
                            <th className="px-4 py-3 text-left text-white text-xs w-[130px]">Email</th>
                            <th className="px-4 py-3 text-left text-white text-xs w-[130px]">Mobile NO</th>
                            <th className="px-4 py-3 text-left text-white text-xs w-[90px]">Referral Code</th>
                            <th className="px-4 py-3 text-left text-white text-xs w-[60px]">Referrals</th>
                            <th className="px-4 py-3 text-left text-white text-xs w-[100px]">Converted</th>
                            <th className="px-4 py-3 text-left text-white text-xs w-[100px]">Create At</th>
                            <th className="px-4 py-3 text-center text-white text-xs w-[80px]">Status</th>
                            <th className="px-4 py-3 text-center text-white text-xs w-[60px]">Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="py-20 text-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-purple-500 mx-auto" />
                                </td>
                            </tr>
                        ) : paginatedRows?.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="py-16">
                                    <NoData title="No data found" />
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row, index) => {
                                const serialNumber =
                                    (currentPage - 1) * PAGE_SIZE + index + 1;

                                const isActive = ["Active", "verified", "approved", "converted"].includes(row?.status);

                                return (
                                    <tr
                                        key={row?.id}
                                        className={`hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}
                                    >
                                        <td className="px-4 py-3 text-gray-300 text-xs">{serialNumber}</td>
                                        <td className="px-4 py-3 text-gray-300 text-xs truncate">{row?.name}</td>
                                        <td className="px-4 py-3 text-gray-300 text-xs truncate">{row?.email}</td>
                                        <td className="px-4 py-3 text-gray-300 text-xs">{row?.mobileNo}</td>
                                        <td className="px-4 py-3 text-gray-300 text-xs font-mono">{row?.referralCode}</td>
                                        <td className="px-4 py-3 text-center text-gray-300 text-xs">{row?.referralCount}</td>

                                        <td className="px-4 py-3 text-xs text-center">
                                            <span className={`px-2 py-0.5 rounded-full ${row?.isConverted
                                                ? "bg-blue-500/20 text-blue-400"
                                                : "bg-gray-500/20 text-gray-400"
                                                }`}>
                                                {row?.isConverted ? "Converted" : "Not Yet"}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 text-gray-300 text-xs text-center">
                                            {row?.createdAt &&
                                                new Date(row.createdAt).toLocaleDateString()}
                                        </td>

                                        {/* STATUS TOGGLE */}
                                        <td className="px-4 py-3 text-center">
                                            <Switch
                                                checked={isActive}
                                                onCheckedChange={() =>
                                                    handleToggleStatus(row?.id, row?.status)
                                                }
                                                className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                                            />
                                        </td>

                                        {/* VIEW ICON */}
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => {
                                                    setSelectedEntry(row);
                                                    setOpenModal(true);
                                                }}
                                                className="text-purple-400 hover:text-purple-300 transition-colors"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {openModal && selectedEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#191D24] w-full max-w-md rounded-xl border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#1e2329]">
                            <h2 className="text-lg font-semibold text-white">Entry Details</h2>
                            <button
                                onClick={() => setOpenModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {[
                                { label: "Name", value: selectedEntry?.name },
                                { label: "Email", value: selectedEntry?.email },
                                { label: "Mobile", value: selectedEntry?.mobileNo },
                                { label: "Referral Code", value: selectedEntry?.referralCode },
                                { label: "Referral Count", value: selectedEntry?.referralCount },
                                { label: "Converted", value: selectedEntry?.isConverted ? "Yes" : "No" },
                                { label: "Created At", value: selectedEntry?.createdAt },
                                {
                                    label: "Status",
                                    value: ["Active", "verified", "approved", "converted"].includes(selectedEntry?.status)
                                        ? "Active"
                                        : "Inactive"
                                },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between border-b border-gray-800/50 pb-2">
                                    <span className="text-gray-400 text-sm">{item.label}</span>
                                    <span className="text-white text-sm font-medium">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* PAGINATION */}
            {totalPages > 1 && (
                <div className="shrink-0 pt-4">
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
