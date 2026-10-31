"use client";

import * as React from "react";
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
import Link from "next/link";
import { Wrench, ArrowUpDown, ArrowRight, Pencil, Trash2, Eye, Filter } from "lucide-react";
import { Employee } from "@/types/employee";
import { create } from "@/assets/images/action";
import Image from "next/image";
import NoData from "../NoData";
import Pagination from "../Pagination";
import CopyButton from "@/components/CopyButton";
import {
  EmployeeFilterSheet,
  type EmployeeFilters,
} from "./employee-filter-sheet";

interface EmployeeTableProps {
  data: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onView: (employee: Employee) => void;
  onCreate: () => void;
}

export function EmployeeTable({
  data,
  onEdit,
  onDelete,
  onView,
  onCreate,
}: EmployeeTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = React.useState(1);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filters, setFilters] = React.useState<EmployeeFilters>({
    username: "",
    email: "",
    role: "all",
    status: "all",
    loginState: "all",
  });

  const roleOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          data.flatMap((employee) =>
            (employee.roles ?? []).map((role) => role.name),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [data],
  );

  // Newest first, whatever order the API hands back — so a newly created
  // employee is the first row on page 1 instead of the last row on the last page.
  const filteredEmployees = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const usernameFilter = filters.username.trim().toLowerCase();
    const emailFilter = filters.email.trim().toLowerCase();
    const roleFilter = filters.role.toLowerCase();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const rows = data.filter((employee) => {
      const username = employee.username?.toLowerCase() ?? "";
      const email = employee.email?.toLowerCase() ?? "";
      const roleNames = (employee.roles ?? []).map((role) =>
        role.name.toLowerCase(),
      );
      const lastLoginTimestamp = employee.lastLoginAt
        ? new Date(employee.lastLoginAt).getTime()
        : NaN;
      const hasValidLastLogin = Number.isFinite(lastLoginTimestamp);

      const matchesSearch =
        !term || username.includes(term) || email.includes(term);
      const matchesUsername =
        !usernameFilter || username.includes(usernameFilter);
      const matchesEmail = !emailFilter || email.includes(emailFilter);
      const matchesRole =
        filters.role === "all" || roleNames.includes(roleFilter);
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && employee.isActive) ||
        (filters.status === "inactive" && !employee.isActive);
      const matchesLoginState =
        filters.loginState === "all" ||
        (filters.loginState === "last_1_day" &&
          hasValidLastLogin &&
          lastLoginTimestamp >= oneDayAgo) ||
        (filters.loginState === "last_1_week" &&
          hasValidLastLogin &&
          lastLoginTimestamp >= oneWeekAgo) ||
        (filters.loginState === "never_login" && !employee.lastLoginAt);

      return (
        matchesSearch &&
        matchesUsername &&
        matchesEmail &&
        matchesRole &&
        matchesStatus &&
        matchesLoginState
      );
    });

    return [...rows].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );
  }, [data, filters, searchTerm]);

  const formatLastLoginAt = (value: unknown) => {
    if (!value) return null;

    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return { date: String(value), time: "" };

    return {
      date: date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    };
  };

  const columns: ColumnDef<Employee>[] = [
    {
      id: "sr",
      header: "SR.",
      size: 55,
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs">#{row.index + 1}</div>
      ),
    },
    {
      accessorKey: "username",
      size: 140,
      header: ({ column }) => {
        return (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center text-white text-xs font-normal hover:text-purple-400 transition-colors"
          >
            Username
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </button>
        );
      },
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs truncate">{row.getValue("username")}</div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      size: 220,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-gray-300 text-xs">
          <span className="truncate lowercase">{row.getValue("email")}</span>
          <CopyButton value={row.original.email} />
        </div>
      ),
    },
    {
      accessorKey: "roles",
      header: "Roles",
      size: 120,
      cell: ({ row }) => {
        const roles = row.getValue("roles") || [];
        return (
          <div className="text-gray-300 text-xs truncate">
            {Array.isArray(roles) ? roles.map((r) => r.name).join(", ") : "-"}
          </div>
        );
      },
    },
    // {
    //   accessorKey: 'password',
    //   header: 'Password',
    //   cell: ({ row }) => <div className="text-gray-300 text-xs truncate">{row.getValue('password')}</div>,
    // },
    {
      accessorKey: "lastLoginAt",
      header: "Last Login Time",
      size: 170,
      cell: ({ row }) => {
        const formatted = formatLastLoginAt(row.getValue("lastLoginAt"));
        if (!formatted) {
          return <div className="text-gray-300 text-xs">N/A</div>;
        }

        return (
          <div className="text-gray-300 text-xs whitespace-nowrap">
            {formatted.date}{formatted.time ? ` ${formatted.time}` : ""}
          </div>
        );
      },
    },

    {
      accessorKey: "isActive",
      header: "Status",
      size: 90,
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
      id: "actions",
      header: "Action",
      size: 80,
      cell: ({ row }) => {
        const employee = row.original;

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
                <DropdownMenuItem
                  onClick={() => onView(employee)}
                  className="text-sm hover:bg-[#242B35] cursor-pointer"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onEdit(employee)}
                  className="text-sm hover:bg-[#242B35] cursor-pointer"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(employee)}
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
    data: filteredEmployees,
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
    Math.ceil(filteredEmployees.length / PAGE_SIZE),
  );

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* A new employee was added → jump to page 1, where the newest row now sits.
     Without this, creating one while on page 3 leaves the operator staring at
     page 3 wondering where the employee went. Growth only: deletes leave the
     current page alone. */
  const previousCount = React.useRef(data.length);
  React.useEffect(() => {
    if (data.length > previousCount.current) {
      setCurrentPage(1);
    }
    previousCount.current = data.length;
  }, [data.length]);

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 sm:p-6 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg flex items-center justify-between gap-4">
        <h1 className="text-base font-normal text-white">Admin/Employee Listing</h1>
        {/* Roles shown in the table are defined over there — one click rather
            than a trip through the sidebar. Access Control keeps its own
            sidebar row. */}
        <Link href="/admin/access-control">
          <Button
            variant="outline"
            className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
          >
            Access Control
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <Input
            placeholder="Search by email/username..."
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            className="bg-[#242B35]!  text-white placeholder:text-gray-500 text-sm pl-4"
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
      <div className="flex-1 overflow-auto scrollbar-hide rounded-lg bg-[#15181E]">
        <table className="w-full min-w-[875px] table-auto">
          {/* HEADERS */}
          <thead className="bg-[#242B35] sticky top-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-800">
                {headerGroup.headers.map((header) => {
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="px-4 py-3 text-left text-white text-xs font-normal whitespace-nowrap"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* BODY */}
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-4 ${cell.column.id === "lastLoginAt" ? "whitespace-nowrap" : "truncate max-w-0"
                        }`}
                    >
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
                  <NoData title="No Employee found" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION — outside the scroller: the table is wider than a phone, so
          a pager inside it slid away with the rows and left only "Go to"
          visible. */}
      {totalPages > 1 && (
        <div className="shrink-0 pt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <EmployeeFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setCurrentPage(1);
        }}
        roleOptions={roleOptions}
      />
    </div>
  );
}
