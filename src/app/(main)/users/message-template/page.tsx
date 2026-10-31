"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, Wrench } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import MessageTemplateModal from "../components/MessageTemplateModal";
import MessageTemplatePreviewModal from "../components/MessageTemplatePreviewModal";
import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/TableSearch/ListSearch";

import { create } from "@/assets/images/action";

import { useMessageTemplateStore } from "@/store/message-template-store";

const PAGE_SIZE = 10;

export default function MessageTemplateListing() {
  const {
    templates,
    loading,
    fetchTemplates,
    deleteTemplate,
    toggleActive,
    createTemplate,
    updateTemplate,
  } = useMessageTemplateStore();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [previewRow, setPreviewRow] = useState<any | null>(null);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return templates;
    const lower = searchTerm.toLowerCase();
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        t.contents.toLowerCase().includes(lower)
    );
  }, [templates, searchTerm]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg">
        <h1 className="text-base font-normal text-white">
          User / Message Template
        </h1>
      </div>

      {/* TOOLBAR */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex items-center gap-3 shrink-0">
        <ListSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search templates..."
          showButton={false}
        />

        {/* CREATE BUTTON */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setEditRow(null);
            setOpenModal(true);
          }}
          className="h-9 w-9 shrink-0 bg-[#1a2030] text-gray-400 border-gray-700"
        >
          <Image src={create} alt="Create" width={20} height={20} />
        </Button>

        {/* EXPORT */}
        <ExportCSV
          data={filteredRows}
          fileName="message_templates.csv"
          getRowDate={(row) => row.createdAt}
          headers={[
            "Title",
            "Duration (Days)",
            "Contents",
            "Created At",
            "Active",
          ]}
          mapRow={(row) => [
            row.title,
            row.displayDurationDays ?? 1,
            row.contents,
            row.createdAt,
            row.isActive ? "Active" : "Inactive",
          ]}
        />
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E]">
        <table className="w-full min-w-[820px] table-fixed">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-white text-xs w-[100px] whitespace-nowrap">Image</th>
              <th className="px-4 py-3 text-left text-white text-xs whitespace-nowrap">Title</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[100px] whitespace-nowrap">Duration (Days)</th>
              <th className="px-4 py-3 text-left text-white text-xs whitespace-nowrap">
                Contents
              </th>
              <th className="px-4 py-3 text-left text-white text-xs whitespace-nowrap">
                Created
              </th>
              <th className="px-4 py-3 text-center text-white text-xs whitespace-nowrap">
                Active
              </th>
              <th className="px-4 py-3 text-center text-white text-xs whitespace-nowrap">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {!loading && paginatedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16">
                  <NoData title="No templates found" />
                </td>
              </tr>
            )}

            {paginatedRows.map((row, index) => (
              <tr
                key={row.id}
                className={`hover:bg-[#1a2030] ${
                  index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                }`}
              >
                <td className="px-4 py-3">
                  {row.imageUrl ? (
                    <div className="relative w-16 h-10 rounded overflow-hidden border border-gray-700">
                      <Image
                        src={row.imageUrl}
                        alt={row.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-10 rounded bg-gray-800 flex items-center justify-center text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                      No Img
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">{row.title}</td>

                <td className="px-4 py-3 text-gray-300 text-xs text-center font-bold">
                  {row.displayDurationDays ?? 1}d
                </td>

                <td className="px-4 py-3 text-gray-300 text-xs truncate max-w-[300px]">
                  {row.contents}
                </td>

                <td className="px-4 py-3 text-gray-300 text-xs">
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>

                {/* ACTIVE SWITCH */}
                <td className="px-4 py-3 text-center">
                  <Switch
                    checked={row.isActive}
                    onCheckedChange={(checked) => toggleActive(row.id, checked)}
                    className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                  />
                </td>

                {/* ACTION MENU */}
                <td className="px-4 py-3 text-center w-[60px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-red-400 hover:text-orange-400">
                        <Wrench size={16} />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="end"
                      className="bg-[#1a2030] text-white border border-white/10 p-1"
                    >
                      <DropdownMenuItem onClick={() => setPreviewRow(row)}>
                        Preview
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          setEditRow(row);
                          setOpenModal(true);
                        }}
                      >
                        Edit
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => deleteTemplate(row.id)}
                        className="text-red-400 focus:text-red-400"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <MessageTemplateModal
        open={openModal}
        initialData={editRow}
        onClose={() => setOpenModal(false)}
        onSubmit={async (data) => {
          const primaryMessageType = data.messageTypes.find(
            (type) => type && type.trim() !== "",
          );

          if (!primaryMessageType) {
            return;
          }

          if (editRow) {
            await updateTemplate(editRow.id, {
              title: data.title,
              contents: data.contents,
              messageType: primaryMessageType,
              isActive: data.isActive,
              imageUrl: data.imageUrl,
              displayDurationDays: data.displayDurationDays,
            });
          } else {
            await createTemplate({
              title: data.title,
              contents: data.contents,
              messageType: primaryMessageType,
              isActive: data.isActive,
              imageUrl: data.imageUrl,
              displayDurationDays: data.displayDurationDays,
            });
          }

          setOpenModal(false);
        }}
      />

      {/* PREVIEW MODAL — shows the template like the user-side pop-up */}
      <MessageTemplatePreviewModal
        open={!!previewRow}
        onClose={() => setPreviewRow(null)}
        template={previewRow}
      />

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
