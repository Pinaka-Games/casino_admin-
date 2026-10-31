"use client"

import React, { useMemo, useState } from "react"
import { FileText, ArrowUpRight, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import DatePicker from "@/components/DatePicker"
import NoData from "@/components/NoData"
import Pagination from "@/components/Pagination"
import ExportCSV from "@/components/ExportCSV"
import { format, parseISO, isWithinInterval } from "date-fns"
import { button as actionButton } from "@/assets/images/action"
import Image from "next/image"

/* ============================
   TYPES
============================ */
interface RewardHistoryRecord {
  id: string
  type: string
  amount: number | string
  currency: string
  status: string
  transactionId?: string
  createdAt: string
  description?: string
  approvedAt?: string
}

interface RewardHistoryTableProps {
  history: RewardHistoryRecord[]
  loading?: boolean
}

const PAGE_SIZE = 10

export function RewardHistoryTable({ history, loading }: RewardHistoryTableProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")

  /* ============================
     FILTERING LOGIC
  ============================ */
  const filteredData = useMemo(() => {
    return history.filter((item) => {
      // Date Filter
      if (startDate && endDate) {
        const itemDate = parseISO(item.createdAt)
        if (!isWithinInterval(itemDate, { start: startDate, end: endDate })) {
          return false
        }
      }

      // Search Filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        return (
          item.type.toLowerCase().includes(searchLower) ||
          item.transactionId?.toLowerCase().includes(searchLower) ||
          item.status.toLowerCase().includes(searchLower) ||
          item.id.toLowerCase().includes(searchLower)
        )
      }

      return true
    })
  }, [history, startDate, endDate, searchTerm])

  /* ============================
     PAGINATION LOGIC
  ============================ */
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE)
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredData.slice(start, start + PAGE_SIZE)
  }, [currentPage, filteredData])

  const totalAmount = useMemo(
    () => filteredData.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [filteredData]
  )

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  return (
    <div className="h-full space-y-4">
      {/* HEADER SECTION */}
      <div className="bg-[#191D24] rounded-lg px-4 py-2 flex items-center justify-between">
        <h1 className="text-white text-base font-normal flex items-center gap-2">
          <FileText className="text-[#B93DEB] w-5 h-5" />
          Reward & Sweepstake History
        </h1>
        <div className="bg-[#242B35] px-3 py-1 rounded-md">
            <span className="text-xs text-gray-400">Total Filtered: </span>
            <span className="text-sm font-bold text-white tracking-widest italic">
                {totalAmount.toLocaleString()} GC
            </span>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-[#15181E] rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
           <DatePicker date={startDate} onChange={setStartDate} />
           <span className="text-gray-600">to</span>
           <DatePicker date={endDate} onChange={setEndDate} />
        </div>

        <div className="relative flex-1 min-w-[200px]">
           <input
             type="text"
             placeholder="Search by ID, Type or Status..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full bg-[#1A1F26] border border-gray-700 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-[#B93DEB]/50 transition-all"
           />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="bg-[#1a2030] border border-gray-700 hover:bg-[#242B35] group"
            onClick={() => {
                setStartDate(undefined)
                setEndDate(undefined)
                setSearchTerm("")
                setCurrentPage(1)
            }}
          >
            <Image src={actionButton} alt="Reset" width={18} height={18} className="opacity-70 group-hover:opacity-100" />
          </Button>

          <ExportCSV
            data={filteredData}
            fileName="user_reward_history.csv"
            headers={[
              "ID",
              "Type",
              "Date",
              "Amount",
              "Currency",
              "Transaction ID",
              "Status"
            ]}
            mapRow={(row) => [
              row.id,
              row.type,
              format(parseISO(row.createdAt), "yyyy-MM-dd HH:mm:ss"),
              row.amount,
              row.currency,
              row.transactionId || "N/A",
              row.status
            ]}
            getRowDate={(row) => row.createdAt}
          />
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-[#15181E] rounded-lg overflow-hidden border border-gray-800/50">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full table-fixed text-center">
            <thead className="bg-[#242B35] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-[11px] font-medium text-white uppercase tracking-wider w-[120px]">SR. ID</th>
                <th className="px-4 py-3 text-[11px] font-medium text-white uppercase tracking-wider">Reward Type</th>
                <th className="px-4 py-3 text-[11px] font-medium text-white uppercase tracking-wider">Claimed Date</th>
                <th className="px-4 py-3 text-[11px] font-medium text-white uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-[11px] font-medium text-white uppercase tracking-wider">Transaction ID</th>
                <th className="px-4 py-3 text-[11px] font-medium text-white uppercase tracking-wider text-right pr-6">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800/30">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse bg-[#191D24]">
                    <td colSpan={6} className="px-4 py-5">
                      <div className="h-4 bg-gray-700/50 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-32 bg-[#191D24]">
                    <NoData title="No reward records matching your criteria" />
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    } hover:bg-[#1C222B] transition-colors border-b border-gray-800/50`}
                  >
                    <td className="px-4 py-4 text-[10px] font-mono text-gray-500">
                      #{row.id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="p-1.5 rounded-md bg-[#B93DEB]/10">
                          <ArrowUpRight className="w-3 h-3 text-[#B93DEB]" />
                        </div>
                        <span className="text-[12px] font-bold text-white capitalize">
                          {row.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-gray-300 font-medium">
                          {format(parseISO(row.createdAt), "MMM dd, yyyy")}
                        </span>
                        <span className="text-[9px] text-gray-500">
                          {format(parseISO(row.createdAt), "HH:mm:ss")}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[13px] font-black text-white italic tracking-tighter">
                        {Number(row.amount).toLocaleString()} {row.currency}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1.5 text-gray-500 font-mono text-[10px]">
                        <Hash size={10} className="text-[#B93DEB]/50" />
                        {row.transactionId || "INTERNAL_SKIP"}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right pr-6">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        row.status.toUpperCase() === 'SUCCESS' || row.status.toUpperCase() === 'COMPLETED'
                          ? "bg-green-500/10 border-green-500/20 text-green-400"
                        : row.status.toUpperCase() === 'PENDING'
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {!loading && paginatedRows.length > 0 && (
              <tfoot className="bg-[#242B35] border-t border-gray-700">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-white text-xs font-bold text-left pl-10 uppercase tracking-widest">
                    Current Page Total
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-white text-sm font-black italic tracking-tighter text-right pr-10">
                    {paginatedRows.reduce((acc, curr) => acc + Number(curr.amount || 0), 0).toLocaleString()} GC
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* PAGINATION SECTION */}
      {!loading && totalPages > 1 && (
        <div className="py-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}
