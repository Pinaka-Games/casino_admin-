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
import NoData from "@/components/NoData";
import { FAQ } from "@/types/faq";
import { Switch } from "@/components/ui/switch";
import { useFaqStore } from "@/store/faq-store";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";


const PAGE_SIZE = 10;

interface FAQTableProps {
  data: FAQ[];
  onEdit: (faq: FAQ) => void;
  onDelete: (faq: FAQ) => void;
  onCreate: () => void;
  loading?: boolean;
}

export function FAQTable({
  data,
  onEdit,
  onDelete,
  onCreate,
  loading = false,
}: FAQTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
  { id: "createdAt", desc: true },
]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const { seedDefaultFaqs } = useFaqStore();
  const [seedConfirmOpen, setSeedConfirmOpen] = React.useState(false);

  /* ✅ store action */
  const { setFaqActive } = useFaqStore();

  // local copy so Switch toggle re-renders properly
  const [localData, setLocalData] = React.useState<FAQ[]>(data);

  React.useEffect(() => {
    setLocalData(data);
  }, [data]);

  // prevent NoData flash
  const [hasClientPainted, setHasClientPainted] = React.useState(false);
  React.useEffect(() => {
    setHasClientPainted(true);
  }, []);

  const showLoader = loading || (!hasClientPainted && data.length === 0);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters]);

  /* ================= COLUMNS ================= */
  const columns = React.useMemo<ColumnDef<FAQ>[]>(
    () => [
      {
        accessorKey: "questionEn",
        header: "Question English",
        cell: ({ row }) => (
          <div className="text-gray-300 text-sm truncate max-w-[220px]">
            {row.original.questionEn}
          </div>
        ),
      },
      {
        accessorKey: "questionEs",
        header: "Question Spanish",
        cell: ({ row }) => (
          <div className="text-gray-400 text-sm truncate max-w-[220px]">
            {row.original.questionEs}
          </div>
        ),
      },
      {
        accessorKey: "answerEn",
        header: "Answer English",
        cell: ({ row }) => (
          <div className="text-gray-400 text-xs truncate max-w-[260px]">
            {row.original.answerEn}
          </div>
        ),
      },
      {
        accessorKey: "answerEs",
        header: "Answer Spanish",
        cell: ({ row }) => (
          <div className="text-gray-400 text-xs truncate max-w-[260px]">
            {row.original.answerEs}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => {
          const isActive = row.original.isActive;

          const handleToggle = async (checked: boolean) => {
            // optimistic UI update
            setLocalData((prev) =>
              prev.map((item) =>
                item.id === row.original.id
                  ? { ...item, isActive: checked }
                  : item
              )
            );

            try {
              await setFaqActive(row.original.id, { isActive: checked });
            } catch {
              // rollback if API fails
              setLocalData((prev) =>
                prev.map((item) =>
                  item.id === row.original.id
                    ? { ...item, isActive: !checked }
                    : item
                )
              );
            }
          };

          return (
            <div className="flex items-center justify-center gap-2">
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
  sortingFn: "datetime",
  cell: ({ row }) => (
    <div className="text-gray-400 text-xs">
      {new Date(row.original.createdAt).toLocaleDateString()}
    </div>
  ),
},
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
          const faq = row.original;

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
                  className="bg-[#1A2030] text-white p-2"
                >
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />

                  <DropdownMenuItem onClick={() => onEdit(faq)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => onDelete(faq)}>
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
    [onDelete, onEdit, setFaqActive]
  );

  const table = useReactTable({
    data: localData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  });

  const filteredSortedRows = table.getRowModel().rows;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredSortedRows.length / PAGE_SIZE)
  );

  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSortedRows.slice(start, start + PAGE_SIZE);
  }, [filteredSortedRows, currentPage]);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleDownloadExcel = () => {
    if (!localData.length) return;

    const worksheet = XLSX.utils.json_to_sheet(
      localData.map((item) => ({
        "Question EN": item.questionEn,
        "Answer EN": item.answerEn,
        "Question ES": item.questionEs,
        "Answer ES": item.answerEs,
        Status: item.isActive ? "Active" : "Inactive",
        "Created At": new Date(item.createdAt).toLocaleString(),
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FAQs");
    XLSX.writeFile(workbook, `faqs_${Date.now()}.xlsx`);
  };

  if (showLoader) {
    return (
      <div className="flex items-center justify-center h-120">
        <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="h-auto flex flex-col bg-[#15181E] p-4 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-3 px-4 py-2 rounded-lg">
        <h1 className="text-base text-white">Settings / FAQ Listing</h1>
      </div>

      {/* SEARCH */}
      <div className="mb-2 bg-[#191D24] p-2 rounded-lg flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search question ..."
            value={
              (table.getColumn("questionEn")?.getFilterValue() as string) ?? ""
            }
            onChange={(e) =>
              table.getColumn("questionEn")?.setFilterValue(e.target.value)
            }
            className="bg-[#242B35]! text-white text-sm"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          className="bg-[#1A2030]"
          onClick={handleDownloadExcel}
        >
          <Image src={exportfile} alt="Export" width={18} height={18} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="bg-[#1A2030]"
          onClick={onCreate}
        >
          <Image src={createnew} alt="Create" width={18} height={18} />
        </Button>

        {data.length === 0 && !loading && (
          <Button
            onClick={() => setSeedConfirmOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3"
          >
            Set Default
          </Button>
        )}

        <ConfirmSeedDialog
          open={seedConfirmOpen}
          title="Seed default FAQs?"
          description="This adds the default FAQ list. It only runs when there are no FAQs yet."
          effects={[
            "Default FAQs are created as active, so players see them straight away",
            "Nothing existing is changed or deleted",
          ]}
          onCancel={() => setSeedConfirmOpen(false)}
          onConfirm={() => {
            setSeedConfirmOpen(false);
            seedDefaultFaqs();
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
              paginatedRows.map((row, index) => (
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
                  <NoData title="No FAQs found" />
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
