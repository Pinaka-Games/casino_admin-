import React, { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wrench, ArrowUpDown, Pencil, Trash2, Shield, Filter } from "lucide-react";
import { Role } from "@/types/role.type";
import { RolePermissionsDialog } from "./permission-dialogue";
import Image from "next/image";
import { create } from "@/assets/images/action";
import Pagination from "../Pagination";
import NoData from "../NoData";
import {
  RoleFilterSheet,
  type RoleFilters,
} from "./roles-filter-sheet";

// ============================================================================
// ROLE TABLE COMPONENT
// ============================================================================
interface RoleTableProps {
  data: Role[];
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onView: (role: Role) => void;
  onCreate: () => void;
}

export function RoleTable({
  data,
  onEdit,
  onDelete,
  onView,
  onCreate,
}: RoleTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<RoleFilters>({
    status: "all",
    createdWindow: "all",
  });

  const PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = React.useState(1);

  const filteredRoles = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    return data.filter((role) => {
      const roleName = role.name?.toLowerCase() ?? "";
      const createdAtTimestamp = role.createdAt
        ? new Date(role.createdAt).getTime()
        : NaN;
      const hasValidCreatedAt = Number.isFinite(createdAtTimestamp);

      const matchesSearch = !term || roleName.includes(term);
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && role.isActive) ||
        (filters.status === "inactive" && !role.isActive);
      const matchesCreatedWindow =
        filters.createdWindow === "all" ||
        (filters.createdWindow === "last_1_day" &&
          hasValidCreatedAt &&
          createdAtTimestamp >= oneDayAgo) ||
        (filters.createdWindow === "last_1_week" &&
          hasValidCreatedAt &&
          createdAtTimestamp >= oneWeekAgo);

      return matchesSearch && matchesStatus && matchesCreatedWindow;
    });
  }, [data, filters, searchTerm]);

  const handleManagePermissions = (role: Role) => {
    setSelectedRole(role);
    setPermissionsDialogOpen(true);
  };

  const columns: ColumnDef<Role>[] = [
    {
      id: "sr",
      header: "SR.",
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs">#{row.index + 1}</div>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center text-white text-xs font-normal hover:text-purple-400 transition-colors"
          >
            Role Name
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </button>
        );
      },
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs truncate">
          {row.getValue("name")}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs truncate">
          {row.getValue("description") || "-"}
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("isActive");
        return (
          <div className="text-start">
            <span
              className={`text-xs font-medium ${isActive ? "text-[#04AD37]" : "text-red-400"}`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <div className="text-gray-300 text-xs">
            {date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="text-start">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-red-400 hover:text-orange-400 transition-colors">
                  <Wrench size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-[#1a2030] text-white p-2"
              >
                <DropdownMenuLabel className="text-gray-400 text-xs">
                  Actions
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {/* <DropdownMenuItem
                  onClick={() => onView(role)}
                  className="text-sm hover:bg-[#242B35] cursor-pointer"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem> */}
                <DropdownMenuItem
                  onClick={() => handleManagePermissions(role)}
                  className="text-sm hover:bg-[#242B35] cursor-pointer"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Manage Permissions
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onEdit(role)}
                  className="text-sm hover:bg-[#242B35] cursor-pointer"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(role)}
                  className="text-red-400 text-sm hover:bg-[#242B35] cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  /* ================= TABLE ================= */
  const table = useReactTable({
    data: filteredRoles,
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
      const next =
        typeof updater === "function"
          ? updater({
              pageIndex: currentPage - 1,
              pageSize: PAGE_SIZE,
            })
          : updater;

      setCurrentPage(next.pageIndex + 1);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  /* ================= TOTAL PAGES ================= */
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRoles.length / PAGE_SIZE),
  );

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <>
      <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
        {/* HEADER */}
        <div className="bg-[#191D24]  mb-4 px-4 py-2 rounded-lg">
          <h1 className="text-base font-normal text-white">Admin/Access Control</h1>
        </div>

        {/* SEARCH BAR */}
        <div className="bg-[#191D24]  rounded-lg p-2 mb-4 flex items-center gap-3 shrink-0">
          <div className="flex-1">
            <Input
              placeholder="Filter by role name..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm pl-4"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setFilterOpen(true)}
            className="bg-[#1a2030] border-gray-700 hover:bg-[#242B35]"
          >
            <Filter size={20} className="text-[#B93DEB]" />
          </Button>
          {/* Create Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={onCreate}
            className="bg-[#1a2030] border-gray-700 hover:bg-[#242B35]"
          >
            <Image src={create} alt="Create" width={20} height={20} />
          </Button>

          {/* <Button
            size="icon"
            className="bg-transparent text-purple-400 border border-purple-400 hover:bg-purple-400 hover:text-white"
          >
            <Search size={20} />
          </Button> */}
        </div>

        {/* TABLE */}
        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-hide rounded-lg bg-[#15181E]">
          <table className="w-full min-w-[880px] table-fixed">
            <thead className="bg-[#242B35] sticky top-0">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-gray-800">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="whitespace-nowrap px-4 py-3 text-left text-white text-xs font-normal"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-[#1a2030] ${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 truncate">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="py-10">
                    <NoData title="No Roles found" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION — outside the scroller so it stays put while the rows
            scroll sideways. */}
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

      <RoleFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setCurrentPage(1);
        }}
      />

      {/* Permissions Dialog */}
      <RolePermissionsDialog
        role={selectedRole}
        open={permissionsDialogOpen}
        onClose={() => {
          setPermissionsDialogOpen(false);
          setSelectedRole(null);
        }}
      />
    </>
  );
}
