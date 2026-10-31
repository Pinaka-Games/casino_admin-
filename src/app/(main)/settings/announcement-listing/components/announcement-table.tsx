"use client";
import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
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

import { Search, Wrench, Pencil, Trash2, Loader2 } from "lucide-react";
import Image from "next/image";
import * as XLSX from "xlsx";

import { createnew, exportfile } from "@/assets/images/banner";
import { Announcement } from "@/types/announcement";
import NoData from "@/components/NoData";
import { useAnnouncementStore } from "@/store/announcement-store";
import { Switch } from "@/components/ui/switch";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";

/* ================= CONSTANT ================= */
const PAGE_SIZE = 10;

interface AnnouncementTableProps {
  data: Announcement[];
  onEdit: (announcement: Announcement) => void;
  onDelete: (announcement: Announcement) => void;
  onCreate: () => void;
}

export function AnnouncementTable({
  data,
  onEdit,
  onDelete,
  onCreate,
}: AnnouncementTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const { announcements, seedAnnouncements, loading } = useAnnouncementStore();
  const [seedConfirmOpen, setSeedConfirmOpen] = React.useState(false);

  const hasData = announcements.length > 0;

  const { setAnnouncementActive } = useAnnouncementStore();

  /* ✅ LOCAL DATA (same as FAQ) */
  const [localData, setLocalData] = React.useState<Announcement[]>(data);

  React.useEffect(() => {
    setLocalData(data);
  }, [data]);

  /* ================= FILTERING ================= */
  // Newest first, whatever order the API hands back.
  const filteredRows = React.useMemo(() => {
    const titleFilter =
      (columnFilters.find((f) => f.id === "title")?.value as string) ?? "";

    const rows = titleFilter
      ? localData.filter((row) =>
        row.title.toLowerCase().includes(titleFilter.toLowerCase())
      )
      : localData;

    return [...rows].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    );
  }, [localData, columnFilters]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  /* ================= COLUMNS ================= */
  const columns = React.useMemo<ColumnDef<Announcement>[]>(
    () => [
      {
        accessorKey: "imageUrl",
        header: "Image",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Image
              src={row.original.imageUrl}
              alt="announcement"
              width={120}
              height={60}
              className="rounded object-cover"
              unoptimized
            />
          </div>
        ),
      },
      {
        accessorKey: "title",
        header: "Title (EN)",
        cell: ({ row }) => (
          <div className="text-gray-300 text-sm font-medium truncate max-w-[150px]">
            {row.original.title}
          </div>
        ),
      },
      {
        accessorKey: "titleEs",
        header: "Title (ES)",
        cell: ({ row }) => (
          <div className="text-gray-400 text-sm truncate max-w-[150px]">
            {row.original.titleEs}
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description (EN)",
        cell: ({ row }) => (
          <div className="text-gray-400 text-xs truncate max-w-[200px]">
            {row.original.description}
          </div>
        ),
      },
      {
        accessorKey: "descriptionEs",
        header: "Description (ES)",
        cell: ({ row }) => (
          <div className="text-gray-400 text-xs truncate max-w-[200px]">
            {row.original.descriptionEs}
          </div>
        ),
      },

      /* ✅ STATUS (FAQ-STYLE TOGGLE) */
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => {
          const announcement = row.original;
          const isActive = announcement.isActive;

          const handleToggle = async (checked: boolean) => {
            // 1️⃣ Optimistic update
            setLocalData((prev) =>
              prev.map((item) =>
                item.id === announcement.id
                  ? { ...item, isActive: checked }
                  : item
              )
            );

            try {
              // 2️⃣ API call
              await setAnnouncementActive(announcement.id, checked);
            } catch {
              // 3️⃣ Rollback
              setLocalData((prev) =>
                prev.map((item) =>
                  item.id === announcement.id
                    ? { ...item, isActive: !checked }
                    : item
                )
              );
            }
          };

          return (
            <div className="flex justify-center">
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                className="
                  data-[state=checked]:bg-purple-500
                  data-[state=unchecked]:bg-gray-600
                "
              />
            </div>
          );
        },
      },

      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <div className="text-gray-400 text-xs">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </div>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <div className="text-gray-400 text-xs">
            {new Date(row.original.updatedAt).toLocaleDateString()}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
          const announcement = row.original;

          return (
            <div className="text-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-purple-400 hover:text-purple-300">
                    <Wrench size={16} />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="bg-[#1a2030] text-white p-2"
                >
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />

                  <DropdownMenuItem onClick={() => onEdit(announcement)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => onDelete(announcement)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onEdit, onDelete, setAnnouncementActive]
  );

  /* ================= TABLE ================= */
  const table = useReactTable({
    data: paginatedRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  });

  /* ================= EXPORT ================= */
  const handleDownloadExcel = () => {
    if (!localData.length) return;

    const worksheet = XLSX.utils.json_to_sheet(
      localData.map((item) => ({
        "Title (EN)": item.title,
        "Title (ES)": item.titleEs,
        "Description (EN)": item.description,
        "Description (ES)": item.descriptionEs,
        Status: item.isActive ? "Active" : "Inactive",
        "Image URL": item.imageUrl,
        "Created At": new Date(item.createdAt).toLocaleString(),
        "Updated At": new Date(item.updatedAt).toLocaleString(),
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Announcements");
    XLSX.writeFile(workbook, `announcements_${Date.now()}.xlsx`);
  };

  return (
    <div className="h-auto flex flex-col bg-[#15181E] p-4 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-3 px-4 py-2 rounded-lg">
        <h1 className="text-base font-normal text-white">
          Settings / Announcement Listing
        </h1>
      </div>

      {/* SEARCH */}
      <div className="mb-2 bg-[#191D24] p-2 rounded-lg flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by title..."
            value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn("title")?.setFilterValue(e.target.value)
            }
            className="bg-[#242B35]! text-white text-sm"
          />
        </div>

        {/* EXPORT */}
        <Button
          variant="outline"
          size="icon"
          className="bg-[#1a2030]"
          onClick={handleDownloadExcel}
        >
          <Image src={exportfile} alt="Export" width={18} height={18} />
        </Button>

        {/* CREATE */}
        <Button
          variant="outline"
          size="icon"
          className="bg-[#1a2030]"
          onClick={onCreate}
        >
          <Image src={createnew} alt="Create" width={18} height={18} />
        </Button>

        {/* ✅ DEFAULT SEED BUTTON */}
        {!hasData && !loading && (
          <Button
            onClick={() => setSeedConfirmOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3"
          >
            Set Default
          </Button>
        )}

        <ConfirmSeedDialog
          open={seedConfirmOpen}
          title="Seed default announcements?"
          description="This adds the default announcements. It only runs when there are no announcements yet."
          effects={[
            "Default announcements are created; active ones show to players straight away",
            "Nothing existing is changed or deleted",
          ]}
          onCancel={() => setSeedConfirmOpen(false)}
          onConfirm={() => {
            setSeedConfirmOpen(false);
            seedAnnouncements();
          }}
        />
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto scrollbar-hide bg-[#15181E] rounded-lg">
        <table className="w-full min-w-[1000px] table-auto">
          <thead className="bg-[#242B35] sticky top-0">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-800">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-xs text-white text-center whitespace-nowrap"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {paginatedRows.length ? (
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#1a2030] ${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-xs text-gray-300 text-center"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-16">
                  <NoData title="No announcements found" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="mt-4">
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