"use client";

import { BannerPack } from "@/types/banner-pack";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Wrench, Trash, Download, Eye, Folder } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { notfound } from "@/assets/icons";
import EmptyStatePage from "@/components/emptystatePage";

interface Props {
  packs: BannerPack[];
  onDelete: (id: string) => void;
  onEdit: (pack: BannerPack) => void;
  onToggle: (id: string) => void;
}

/** "229KB" / "1.4 MB" -> bytes, for sorting. Unparseable values sort last. */
const parsePackSize = (value?: string | null): number | null => {
  if (!value) return null;
  const match = /^\s*([\d.]+)\s*(B|KB|MB|GB|TB)?\s*$/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return null;
  const unit = (match[2] ?? "B").toUpperCase();
  const factor =
    { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit] ?? 1;
  return amount * factor;
};

export function BannerPackTable({ packs, onDelete, onEdit, onToggle }: Props) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { sort, toggle } = useTableSort<"size" | "updated">();
  const sortedPacks = useSortedRows(packs, sort, {
    size: (pack) => parsePackSize(pack.packSize),
    updated: (pack) => new Date(pack.updatedAt || pack.createdAt).getTime(),
  });

  return (
    <div className="overflow-x-auto rounded-md border border-[#242B35] bg-[#191D24]">
      <Table className="min-w-[860px]">
        <TableHeader className="bg-[#242B35]">
          <TableRow className="border-gray-800 hover:bg-transparent">
            <TableHead className="whitespace-nowrap px-4 py-3 text-xs text-white">Pack</TableHead>
            <TableHead className="whitespace-nowrap px-4 py-3 text-xs text-white">Folders</TableHead>
            <TableHead className="whitespace-nowrap px-4 py-3 text-xs text-white">Total Files</TableHead>
            <SortableTh
              label="Size"
              sortKey="size"
              sort={sort}
              onToggle={toggle}
              className="px-4 py-3 text-left align-middle text-xs text-white"
            />
            <TableHead className="whitespace-nowrap px-4 py-3 text-xs text-white">Status</TableHead>
            <SortableTh
              label="Last Updated"
              sortKey="updated"
              sort={sort}
              onToggle={toggle}
              className="px-4 py-3 text-left align-middle text-xs text-white"
            />
            <TableHead className="px-4 py-3 text-right text-xs text-white">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPacks.map((pack) => (
            <TableRow key={pack.id} className="border-[#242B35] hover:bg-[#242B35]/50 transition-colors">
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <div 
                    className="relative w-12 h-12 rounded overflow-hidden border border-[#242B35] cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      if (pack.coverImage) {
                        setPreviewImage(pack.coverImage);
                        setPreviewOpen(true);
                      }
                    }}
                  >
                    <Image
                      src={pack.coverImage || "/placeholder-image.png"}
                      alt={pack.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-semibold">{pack.title}</span>
                    <span className="text-gray-500 text-xs line-clamp-1 max-w-[200px]">{pack.description}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-gray-400">
                  <Folder className="w-4 h-4" />
                  <span>{pack.folderCount ?? 0}</span>
                </div>
              </TableCell>
              <TableCell className="text-gray-400">
                {pack.fileCount ?? 0}
              </TableCell>
              <TableCell className="text-gray-400">{pack.packSize || "0MB"}</TableCell>
              <TableCell>
                <button
                  onClick={() => onToggle(pack.id)}
                  title={pack.isActive ? "Click to deactivate" : "Click to activate"}
                  className="flex items-center gap-2 group"
                >
                  {/* Toggle pill only — no label */}
                  <span
                    className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-300 ${
                      pack.isActive ? 'bg-purple-600' : 'bg-[#2A2F3A]'
                    }`}
                  >
                    <span
                      className={`inline-block w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                        pack.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
              </TableCell>
              <TableCell className="text-gray-400 text-xs">
                {new Date(pack.updatedAt || pack.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Row actions"
                        className="cursor-pointer text-red-400 transition-colors hover:bg-[#242B35] hover:text-orange-400"
                      >
                        <Wrench className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#191D24] border-[#242B35] text-white">
                      <DropdownMenuItem 
                        className="hover:bg-[#242B35] cursor-pointer"
                        onClick={() => router.push(`/settings/banner-pack-listing/${pack.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" /> Manage Assets
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="hover:bg-[#242B35] cursor-pointer"
                        onClick={() => onEdit(pack)}
                      >
                        <Edit className="w-4 h-4 mr-2" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover:bg-[#242B35] cursor-pointer text-red-500 focus:text-red-500" onClick={() => onDelete(pack.id)}>
                        <Trash className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {packs.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-12">
                <EmptyStatePage
                  type="default"
                  image={notfound}
                  title="No Packs Found"
                  description="You haven't created any banner packs yet. Click 'Create New Pack' to get started."
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <ImagePreviewModal
        open={previewOpen}
        imageUrl={previewImage}
        title="Banner Pack Preview"
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
