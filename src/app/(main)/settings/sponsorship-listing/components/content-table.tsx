"use client";

import * as React from "react";
import Image from "next/image";
import type { Sponsorship } from "@/types/sponsorship";

import { Switch } from "@/components/ui/switch";
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

import { Search, Wrench, Pencil, Trash2, Loader2 } from "lucide-react";
import { createnew } from "@/assets/images/banner";
import NoData from "@/components/NoData";
import { useSponsorshipStore } from "@/store/sponsorship-store";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";

/* =====================================================
   HELPER: truncate text + tooltip (same as KYC pattern)
===================================================== */
const truncateText = (value: any, maxLength = 40) => {
  if (!value) {
    return { display: "-", tooltip: "-" };
  }

  const str = typeof value === "string" ? value : JSON.stringify(value);

  return {
    display: str.length > maxLength ? str.slice(0, maxLength) + "..." : str,
    tooltip: str,
  };
};

interface Props {
  data: Sponsorship[];
  loading?: boolean;

  togglingId?: string | null;
  onToggleActive: (item: Sponsorship, nextActive: boolean) => void;

  onCreate: () => void;
  onEdit: (item: Sponsorship) => void;
  onDelete: (item: Sponsorship) => void;
}

export function ContentTable({
  data,
  loading,
  togglingId,
  onToggleActive,
  onCreate,
  onEdit,
  onDelete,
}: Props) {
  const [search, setSearch] = React.useState("");

  /* ================= FILTER + ORDER ================= */
  // Newest first, whatever order the API hands back.
  const filteredData = React.useMemo(() => {
    const rows = search
      ? data.filter((item) =>
          item.sectionsEn?.[0]?.heading
            ?.toLowerCase()
            .includes(search.toLowerCase())
        )
      : data;

    return [...rows].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    );
  }, [data, search]);

  const {
    sponsorships,
    seedDefaults,
    loading: storeLoading,
  } = useSponsorshipStore();

  const [seedConfirmOpen, setSeedConfirmOpen] = React.useState(false);

  const handleSeedDefaults = async () => {
    setSeedConfirmOpen(false);
    await seedDefaults();
  };

  // The page owns the initial fetch — this component used to fire a second one
  // on mount, doubling every page load's request.

  // Only the first load gets the full-panel spinner. Refreshes after a toggle
  // or a save keep the rows on screen; the toast is the feedback.
  const showInitialLoader = !!loading && data.length === 0;

  return (
    <div className="h-auto flex flex-col bg-[#15181E] p-4 overflow-hidden">
      {/* ================= HEADER ================= */}
      <div className="bg-[#191D24] mb-3 px-4 py-2 rounded-lg">
        <h1 className="text-base font-normal text-white">
          Settings / Sponsorship Listing
        </h1>
      </div>

      {/* ================= ACTION BAR ================= */}
      <div className="mb-2 bg-[#191D24] p-2 rounded-lg flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by English heading..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#242B35]! text-white placeholder:text-gray-500 text-sm pl-4"
          />
        </div>
        {/* Set Default Button */}
        {sponsorships.length === 0 && (
          <Button
            onClick={() => setSeedConfirmOpen(true)}
            disabled={storeLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4"
          >
            {storeLoading ? "Seeding..." : "Set Default"}
          </Button>
        )}

        <ConfirmSeedDialog
          open={seedConfirmOpen}
          title="Seed default sponsorship content?"
          description="This adds the default sponsorship sections. It only runs when there is no sponsorship content yet."
          effects={[
            "Default sponsorship content is created; active items show to players straight away",
            "Nothing existing is changed or deleted",
          ]}
          onCancel={() => setSeedConfirmOpen(false)}
          onConfirm={handleSeedDefaults}
        />

        <Button
          variant="outline"
          size="icon"
          className="bg-[#1a2030]"
          onClick={onCreate}
        >
          <Image src={createnew} alt="Create" width={18} height={18} />
        </Button>
      </div>

      {/* ================= TABLE ================= */}
      <div className="flex-1 overflow-y-auto bg-[#15181E] rounded-lg">
        <table className="w-full table-fixed">
          {/* ===== HEADER ===== */}
          <thead className="bg-[#242B35] sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-xs text-white text-center w-[120px]">
                Image
              </th>
              <th className="px-4 py-3 text-xs text-white text-left w-[200px]">
                ENGLISH
              </th>
              <th className="px-4 py-3 text-xs text-white text-left w-[200px]">
                SPANISH
              </th>
              <th className="px-4 py-3 text-xs text-white text-left">
                Preview
              </th>
              <th className="px-4 py-3 text-xs text-white text-center w-[100px]">
                Status
              </th>
              <th className="px-4 py-3 text-xs text-white text-center w-[120px]">
                Created
              </th>
              <th className="px-4 py-3 text-xs text-white text-center w-[80px]">
                Action
              </th>
            </tr>
          </thead>

          {/* ===== BODY ===== */}
          <tbody>
            {!showInitialLoader && filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-500">
                  <NoData title="No sponsorships found" />
                </td>
              </tr>
            )}

            {filteredData.map((item, index) => {
              const isToggling = togglingId === item.id;

              const enHeading = item.sectionsEn?.[0]?.heading || "-";
              const esHeading = item.sectionsEs?.[0]?.heading || "-";
              const preview =
                item.sectionsEn?.[0]?.blocks?.find(
                  (b) => b.type === "paragraph"
                )?.content || "-";

              const enText = truncateText(enHeading, 35);
              const esText = truncateText(esHeading, 35);
              const previewText = truncateText(preview, 60);

              return (
                <tr
  key={item.id}
  className={`
    ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}
    hover:bg-[#1a2030]
    ${togglingId === item.id ? "animate-row-blink" : ""}
  `}
>
                  {/* IMAGE */}
                  <td className="px-4 py-3 text-center">
                    <Image
                      src={item.imageUrl}
                      alt="Sponsorship"
                      width={90}
                      height={45}
                      className="rounded object-cover mx-auto"
                      unoptimized
                    />
                  </td>

                  {/* EN */}
                  <td
                    className="px-4 py-3 text-sm text-white truncate"
                    title={enText.tooltip}
                  >
                    {enText.display}
                  </td>

                  {/* ES */}
                  <td
                    className="px-4 py-3 text-sm text-gray-300 truncate"
                    title={esText.tooltip}
                  >
                    {esText.display}
                  </td>

                  {/* PREVIEW */}
                  <td
                    className="px-4 py-3 text-xs text-gray-400 truncate max-w-[400px]"
                    title={previewText.tooltip}
                  >
                    {previewText.display}
                  </td>

                  {/* ACTIVE */}
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={item.isActive}
                      disabled={!!loading || isToggling}
                      onCheckedChange={(checked) =>
                        onToggleActive(item, checked)
                      }
                      className="
                        data-[state=checked]:bg-purple-500
                        data-[state=unchecked]:bg-gray-700
                      "
                    />
                  </td>

                  {/* CREATED */}
                  <td className="px-4 py-3 text-xs text-gray-400 text-center">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>

                  {/* ACTION */}
                  <td className="px-4 py-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-orange-400 hover:text-orange-300">
                          <Wrench size={16} />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent className="bg-[#1a2030] text-white p-2">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(item)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {showInitialLoader && (
          <div className="flex items-center justify-center h-120">
            {" "}
            <Loader2 className="h-16 w-16 animate-spin text-purple-400" />{" "}
          </div>
        )}
      </div>
    </div>
  );
}
