"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
  getPaginationRowModel,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/Pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Search, Wrench, Pencil, Trophy, PlayCircle, Eye, Clock, ArrowUpDown, Info, Copy, Filter } from "lucide-react";
import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";
import { Tournament, TournamentStatus } from "@/types/tournament";
import Image from "next/image";
import { coingreen, coingold } from "@/assets/icons";
import { create } from "@/assets/images/action";
import { TournamentFilterSheet, TournamentFilters, DEFAULT_TOURNAMENT_FILTERS } from "./TournamentFilterSheet";
import { TournamentDetailsModal } from "./TournamentDetailsModal";

const PAGE_SIZE = 10;

interface Props {
  data: Tournament[];
  onEdit: (t: Tournament) => void;
  onCreate: () => void;
  onDuplicate: (t: Tournament) => void;
  onViewWinners: (t: Tournament) => void;
  onSettle: (t: Tournament) => void;
  onUpdateStatus?: (t: Tournament, status: TournamentStatus) => void;
}

export function TournamentTable({
  data, onEdit, onCreate, onDuplicate, onViewWinners, onSettle, onUpdateStatus
}: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [filters, setFilters] = React.useState<TournamentFilters>(DEFAULT_TOURNAMENT_FILTERS);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedTournament, setSelectedTournament] = React.useState<Tournament | null>(null);
  const [settleDialogOpen, setSettleDialogOpen] = React.useState(false);
  const [isSettling, setIsSettling] = React.useState(false);

  /* ================= FILTER ================= */
  const filtered = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    
    return data.filter((t) => {
      // 1. Search Logic
      const matchesSearch = !term || 
        t.title?.toLowerCase().includes(term) ||
        t.externalEventId?.toLowerCase().includes(term);

      // 2. Status Filter
      const matchesStatus = filters.status === "all" || t.status === filters.status;

      // 3. Currency Filter (Any prize matches)
      const matchesCurrency = filters.currency === "all" || 
        (t.prizes || []).some(p => p.currency === filters.currency);

      // 4. Payout Filter
      const matchesPayout = filters.isPaid === "all" || (
        filters.isPaid === "paid" ? t.isPaid : 
        filters.isPaid === "pending" ? (!t.isPaid && t.status === TournamentStatus.COMPLETED) : true
      );

      return matchesSearch && matchesStatus && matchesCurrency && matchesPayout;
    });
  }, [data, searchTerm, filters]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  /* ================= COLUMNS ================= */
  const columns: ColumnDef<Tournament>[] = [
    {
      id: "sr",
      header: "SR.",
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs hidden md:block">#{((currentPage - 1) * PAGE_SIZE) + row.index + 1}</div>
      ),
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="flex items-center text-white text-xs font-normal hover:text-purple-400 transition-colors"
        >
          Tournament 
        </button>
      ),
      cell: ({ row }) => (
        <div className="text-left font-bold text-white text-sm tracking-tight capitalize truncate max-w-[120px] sm:max-w-[200px]">
          {row.original.title}
        </div>
      ),
    },
    {
      accessorKey: "externalEventId",
      header: ({ column }) => (
        <div className="text-center">SA Event ID</div>
      ),
      cell: ({ row }) => (
        <div className="text-center font-mono text-purple-400 font-bold">
          {row.getValue("externalEventId")}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <div className="text-center">Status</div>
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        let color = "bg-gray-500/10 text-gray-400 border-gray-500/20";
        if (status === TournamentStatus.IN_PROGRESS) color = "bg-green-500/10 text-green-400 border-green-500/20";
        if (status === TournamentStatus.COMPLETED) color = "bg-blue-500/10 text-blue-400 border-blue-500/20";
        if (status === TournamentStatus.STOPPED) color = "bg-red-500/10 text-red-400 border-red-500/20";
        if (status === TournamentStatus.UPCOMING) color = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";

        const formatStatus = (s: string) => {
          if (!s) return "UNKNOWN";
          return s.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        };

        return (
          <div className="flex justify-center">
            <Badge variant="outline" className={`${color} px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full`}>
              {formatStatus(status)}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "isPaid",
      header: ({ column }) => (
        <div className="text-center">Payout</div>
      ),
      cell: ({ row }) => {
        const t = row.original;
        const isPaid = t.isPaid;
        const status = t.status;

        if (isPaid) {
          return (
            <div className="text-center">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/20">Paid</Badge>
            </div>
          );
        }

        if (status === TournamentStatus.COMPLETED) {
          return (
            <div className="text-center">
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/20">Pending</Badge>
            </div>
          );
        }

        if (status === TournamentStatus.CANCELLED || status === TournamentStatus.STOPPED) {
          return <div className="text-center text-gray-500 text-xs">N/A</div>;
        }

        return (
          <div className="text-center text-gray-500 text-xs">—</div>
        );
      },
    },
    {
      id: "actions",
      header: () => (
        <div className="text-center">Action</div>
      ),
      cell: ({ row }) => {
        const tournament = row.original;
        return (
          <div className="text-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-red-400 hover:text-orange-400 transition-colors">
                  <Wrench size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1a2030] text-white p-2 border-gray-700 z-50">
                <DropdownMenuLabel className="text-gray-400 text-xs">Actions</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {tournament.status !== TournamentStatus.COMPLETED && tournament.status !== TournamentStatus.CANCELLED && tournament.status !== TournamentStatus.STOPPED && (
                  <DropdownMenuItem onClick={() => onEdit(tournament)} className="text-sm hover:bg-[#242B35] cursor-pointer">
                    <Pencil className="mr-3 h-4 w-4 text-gray-400" /> Edit Tournament
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => onDuplicate(tournament)} className="text-sm hover:bg-[#242B35] cursor-pointer">
                  <Copy className="mr-3 h-4 w-4 text-sky-400" /> Duplicate Tournament
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => {
                     setSelectedTournament(tournament);
                     setDetailsOpen(true);
                }} className="text-sm hover:bg-[#242B35] cursor-pointer">
                  <Eye className="mr-3 h-4 w-4 text-purple-400" /> View Prize Pool Details
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => onViewWinners(tournament)} className="text-sm hover:bg-[#242B35] cursor-pointer">
                  <Trophy className="mr-3 h-4 w-4 text-yellow-500" /> Winners List
                </DropdownMenuItem>

                {tournament.status === TournamentStatus.COMPLETED && !tournament.isPaid && (
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      setSelectedTournament(tournament);
                      setSettleDialogOpen(true);
                    }} 
                    className="text-sm hover:bg-[#242B35] cursor-pointer"
                  >
                    <PlayCircle className="mr-2 h-4 w-4 text-[#C362EA]" /> 
                    <span className="text-[#C362EA] font-extrabold">Trigger Settle</span>
                  </DropdownMenuItem>
                )}

                {/* UPCOMING ACTIONS */}
                {String(tournament.status).toUpperCase() === 'UPCOMING' && (
                  <DropdownMenuItem onClick={() => onUpdateStatus?.(tournament, TournamentStatus.IN_PROGRESS)} className="text-sm text-white hover:bg-[#242B35] cursor-pointer">
                    <PlayCircle className="mr-3 h-4 w-4 text-green-400" /> Start Tournament Now
                  </DropdownMenuItem>
                )}
                {String(tournament.status).toUpperCase() === 'UPCOMING' && (
                  <DropdownMenuItem onClick={() => onUpdateStatus?.(tournament, TournamentStatus.CANCELLED)} className="text-sm text-red-400 hover:bg-[#242B35] cursor-pointer">
                    <Eye className="mr-3 h-4 w-4 text-red-400" /> Cancel Tournament
                  </DropdownMenuItem>
                )}

                {/* IN_PROGRESS ACTIONS */}
                {String(tournament.status).toUpperCase() === 'IN_PROGRESS' && (
                  <DropdownMenuItem onClick={() => onUpdateStatus?.(tournament, TournamentStatus.STOPPED)} className="text-sm text-orange-400 hover:bg-[#242B35] cursor-pointer">
                    <Eye className="mr-3 h-4 w-4 text-orange-400" /> Stop Tournament
                  </DropdownMenuItem>
                )}


              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filtered,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize: PAGE_SIZE,
      },
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function"
        ? updater({ pageIndex: currentPage - 1, pageSize: PAGE_SIZE })
        : updater;
      setCurrentPage(next.pageIndex + 1);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      <div className="h-screen flex flex-col bg-[#15181E] p-4 md:p-6 overflow-hidden">
        {/* HEADER */}
        <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg shrink-0">
          <h1 className="text-sm md:text-base font-normal text-white truncate">Games / Tournament Management</h1>
        </div>

        {/* SEARCH BAR (Responsive Stacking) */}
        <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex-1">
            <Input
              placeholder="Search by title or EventID..."
              value={searchTerm}
              onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
              }}
              className="bg-[#242B35]! text-white placeholder:text-gray-500 text-sm pl-4 h-10 sm:h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterOpen(true)}
              className={`flex-1 sm:flex-none h-10 sm:h-9 gap-2 rounded-md border-gray-700/50 bg-[#1a2030]/50 px-4 text-gray-300 transition-all hover:border-purple-500/50 hover:bg-[#1a2030] hover:text-white ${
                filters.status !== "all" || filters.currency !== "all" || filters.isPaid !== "all"
                  ? "border-purple-500/60 text-purple-300"
                  : ""
              }`}
            >
              <Filter className="h-4 w-4 text-purple-400" />
              Filters
            </Button>

            <ExportCSV
              data={filtered}
              fileName="tournaments.csv"
              getRowDate={(t) => t.createdAt}
              headers={["Tournament", "SA Event ID", "Status", "Payout"]}
              mapRow={(t) => [
                t.title,
                t.externalEventId,
                t.status
                  ? t.status
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                      .join(" ")
                  : "Unknown",
                t.isPaid
                  ? "Paid"
                  : t.status === TournamentStatus.COMPLETED
                    ? "Pending"
                    : t.status === TournamentStatus.CANCELLED ||
                        t.status === TournamentStatus.STOPPED
                      ? "N/A"
                      : "—",
              ]}
            />

            <Button
              variant="outline"
              size="icon"
              onClick={onCreate}
              className="flex-1 sm:flex-none bg-[#1a2030] border-gray-700 hover:bg-[#242B35] h-10 sm:h-9 w-full sm:w-9"
            >
              <Image src={create} alt="Create" width={18} height={18} />
            </Button>
        </div>
      </div>

     

      {/* TABLE */}
      <div className="flex-1 overflow-auto scrollbar-hide rounded-lg bg-[#15181E] border border-gray-800/50">
        <table className="w-full table-auto min-w-[700px] sm:min-w-0">
          <thead className="bg-[#242B35] sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-800">
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-3 md:px-4 py-3 text-left text-white text-[11px] font-normal whitespace-nowrap">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {filtered.length ? (
              table.getRowModel().rows.map((row, index) => (
                <tr 
                  key={row.id} 
                  className={`hover:bg-[#1a2030] transition-colors border-b border-gray-800/30 ${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 md:px-4 py-3 text-[11px] text-gray-300">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-10">
                  <NoData title="No tournaments found" />
                </td>
              </tr>
            )}
          </tbody>
        </table>

      </div>

      {/* PAGINATION */}
      {totalPages > 0 && (
        <div className="pt-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Main Container Close */}
      </div>

      <TournamentFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={(f) => {
          setFilters(f);
          setCurrentPage(1);
        }}
      />

      <TournamentDetailsModal 
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        tournament={selectedTournament}
      />

      <AlertDialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <AlertDialogContent className="bg-[#15181E] text-white border-none rounded-3xl max-w-[450px] p-0 overflow-hidden shadow-2xl">
          <div className="p-8">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-3 text-white">
                <PlayCircle className="text-[#C362EA] h-7 w-7" />
                Confirm Settlement
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400 py-4 text-sm leading-relaxed">
                Are you sure you want to trigger manual settlement for <span className="text-white font-bold italic">"{selectedTournament?.title}"</span>?
                <br /><br />
                This will rank the winners and process <span className="text-[#C362EA] font-extrabold">payouts</span> into their wallets. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
              <AlertDialogCancel className="bg-[#1A1C20] hover:bg-[#25282E] text-gray-300 border-none px-8 h-12 rounded-xl text-sm font-bold transition-all">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={async () => {
                  if (selectedTournament) {
                    setIsSettling(true);
                    try {
                      await onSettle(selectedTournament);
                    } finally {
                      setIsSettling(false);
                    }
                  }
                }}
                className="bg-[#C362EA] hover:bg-[#B555DB] text-white font-bold px-10 h-12 rounded-xl text-sm shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                disabled={isSettling}
              >
                {isSettling ? "Processing..." : "Confirm & Settle"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
