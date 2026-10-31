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
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/Pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Search, Wrench, Pencil, Trash2, Eye } from "lucide-react";
import Image from "next/image";
import * as XLSX from "xlsx";
import NoData from "@/components/NoData";

import { createnew, exportfile } from "@/assets/images/banner";
import { Banner } from "@/types/banner";
import { useBannerStore } from "@/store/banner-store";
import { BannerPreviewDialog } from "./banner-preview-dialog";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";

const PAGE_SIZE = 10;

interface Props {
  data: Banner[];
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onCreate: () => void;
}

export function BannerTable({ data, onEdit, onDelete, onCreate }: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [filters, setFilters] = React.useState<ColumnFiltersState>([]);
  const [currentPage, setCurrentPage] = React.useState(1);

  const { toggleActive, seedDefaultBanners, banners, loading } = useBannerStore();
  const [seedConfirmOpen, setSeedConfirmOpen] = React.useState(false);

  // Preview: renders the row the way the player hero does, so layout problems
  // (wrapped title, art covering the copy) are caught before the banner is live.
  const [previewBanner, setPreviewBanner] = React.useState<Banner | null>(null);

  /* ================= FILTER + ORDER ================= */
  // Newest banner first, whatever order the API hands back.
  const filtered = React.useMemo(() => {
    const search =
      (filters.find((f) => f.id === "titleEn")?.value as string) ?? "";

    const rows = search
      ? data.filter((b) =>
          b.titleEn?.toLowerCase().includes(search.toLowerCase())
        )
      : data;

    return [...rows].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    );
  }, [data, filters]);

  /* ================= PAGINATION ================= */
  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Searching down to fewer pages must not strand the operator on an empty one.
  React.useEffect(() => {
    setCurrentPage((page) => (page > totalPages ? 1 : page));
  }, [totalPages]);

  /* ================= TOGGLE ================= */
  const ToggleSwitch = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <button
      onClick={onChange}
      className={`w-11 h-6 flex items-center rounded-full p-1 transition ${
        checked ? "bg-purple-600" : "bg-gray-600"
      }`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );

  /* ================= COLUMNS ================= */
  const columns: ColumnDef<Banner>[] = [
    /* IMAGE */
    {
      accessorKey: "imageUrl",
      header: "Image",
      size: 90,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Image
            src={row.original.imageUrl}
            alt="banner"
            width={60}
            height={42}
            className="rounded object-cover"
            unoptimized
          />
        </div>
      ),
    },

    /* TITLE — image banners carry no copy, so name them by kind instead of
       leaving the cell blank. */
    {
      accessorKey: "titleEn",
      header: "Title",
      size: 140,
      cell: ({ row }) => {
        const isImage = row.original.bannerType === "IMAGE";
        return (
          <div className="text-center">
            <span className="text-xs font-normal text-gray-200 whitespace-nowrap">
              {row.original.titleEn || (isImage ? "Image banner" : "—")}
            </span>
            {isImage && (
              <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-purple-300 whitespace-nowrap">
                Image only
              </span>
            )}
          </div>
        );
      },
    },

    /* SUBTITLE */
    {
      accessorKey: "subtitleEn",
      header: "Subtitle",
      size: 140,
      cell: ({ row }) => (
        <div className="text-center text-xs text-gray-400 whitespace-nowrap">
          {row.original.subtitleEn || "—"}
        </div>
      ),
    },

    /* ONE LINE TEXT */
    {
      accessorKey: "oneLineEn",
      header: "One Line",
      size: 130,
      cell: ({ row }) => (
        <div className="text-center text-xs italic text-gray-500 whitespace-nowrap">
          {row.original.oneLineEn || "—"}
        </div>
      ),
    },

    /* AMOUNT */
    {
      accessorKey: "amountEn",
      header: "Amount",
      size: 90,
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="text-center">
            {b.amountEn ? (
              <span className="text-purple-400 font-normal text-xs">
                {b.amountEn}
              </span>
            ) : (
              <span className="text-gray-500 text-xs">—</span>
            )}
          </div>
        );
      },
    },

    /* BUTTON */
    // {
    //   accessorKey: "buttonTextEn",
    //   header: "Button",
    //   cell: ({ row }) => (
    //     <div className="text-center text-xs text-purple-400">
    //       {row.original.buttonTextEn || "—"}
    //     </div>
    //   ),
    // },

    /* ACTION TYPE */
    {
      accessorKey: "actionType",
      header: "Action",
      size: 180,
      cell: ({ row }) => (
        <div className="text-center">
          <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 whitespace-nowrap">
            {row.original.actionType}
          </span>
        </div>
      ),
    },

    /* ACTIVE TOGGLE */
    {
      accessorKey: "isActive",
      header: "Active",
      size: 80,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <ToggleSwitch
            checked={row.original.isActive}
            onChange={() =>
              toggleActive(row.original.id, !row.original.isActive)
            }
          />
        </div>
      ),
    },

    /* CREATED */
    {
      accessorKey: "createdAt",
      header: "Created",
      size: 100,
      cell: ({ row }) => (
        <div className="text-gray-400 text-xs text-center whitespace-nowrap">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </div>
      ),
    },

    /* UPDATED */
    {
      accessorKey: "updatedAt",
      header: "Updated",
      size: 100,
      cell: ({ row }) => (
        <div className="text-gray-400 text-xs text-center whitespace-nowrap">
          {new Date(row.original.updatedAt).toLocaleDateString()}
        </div>
      ),
    },

    /* ACTION MENU */
    {
      id: "actions",
      header: "Actions",
      size: 80,
      cell: ({ row }) => {
        const banner = row.original;

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
                className="bg-[#1a2030] text-white"
              >
                <DropdownMenuItem onClick={() => setPreviewBanner(banner)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onEdit(banner)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onDelete(banner)}>
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

  const table = useReactTable({
    data: paginated,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    state: { sorting, columnFilters: filters },
  });

  /* ================= EXPORT ================= */
  const exportExcel = () => {
    if (!data.length) return;

    const sheet = XLSX.utils.json_to_sheet(
      data.map((b) => ({
        ID: b.id,
        Title: b.titleEn,
        Subtitle: b.subtitleEn,
        Button: b.buttonTextEn,
        Action: b.actionType,
        Active: b.isActive ? "Yes" : "No",
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Banners");

    XLSX.writeFile(
      wb,
      `banners_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 sm:p-6 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg text-white text-sm sm:text-base font-normal shrink-0">
        Settings / Banner Listing
      </div>

      {/* SEARCH */}
      <div className="flex gap-2 mb-4 items-center shrink-0">
        <Input
          placeholder="Search banner..."
          value={(table.getColumn("titleEn")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("titleEn")?.setFilterValue(e.target.value)
          }
          className="bg-[#242B35] text-white"
        />

        <Button size="icon" variant="outline" onClick={exportExcel} className="shrink-0">
          <Image src={exportfile} alt="export" width={18} height={18} />
        </Button>

        <Button size="icon" variant="outline" onClick={onCreate} className="shrink-0">
          <Image src={createnew} alt="create" width={18} height={18} />
        </Button>

        {/* ⭐ SHOW ONLY IF NO DATA */}
        {banners.length === 0 && !loading && (
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 shrink-0"
            onClick={() => setSeedConfirmOpen(true)}
          >
            Set Default
          </Button>
        )}

        <ConfirmSeedDialog
          open={seedConfirmOpen}
          title="Seed default banners?"
          description="This adds the default home page banners. It only runs when there are no banners yet."
          effects={[
            "Default banners are created; active ones show on the player site straight away",
            "Nothing existing is changed or deleted",
          ]}
          onCancel={() => setSeedConfirmOpen(false)}
          onConfirm={() => {
            setSeedConfirmOpen(false);
            seedDefaultBanners();
          }}
        />
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto scrollbar-hide rounded-lg bg-[#15181E]">
        <table className="w-full min-w-[900px] table-auto">
          <thead className="bg-[#242B35] sticky top-0">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-800">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="px-4 py-3 text-xs text-white text-center font-normal whitespace-nowrap"
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
            {paginated.length ? (
              table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#1a2030] transition-colors ${
                    i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-center text-gray-300"
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
                <td colSpan={columns.length}>
                  <NoData title="No banners found" />
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <BannerPreviewDialog
        open={!!previewBanner}
        onOpenChange={(next) => {
          if (!next) setPreviewBanner(null);
        }}
        banner={previewBanner}
      />
    </div>
  );
}
