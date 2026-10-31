"use client";

import React from "react";
import CopyButton from "@/components/CopyButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Download, Check, Wrench, X } from "lucide-react";

export interface AdminTaxForm {
  submissionId: string;
  userId: string;
  userName: string;
  email: string | null;
  formType: "W-9" | "1099";
  financialYear: string;
  status: "pending" | "verified" | "rejected" | "not_submitted";
  submittedDate: string | null;
  totalWithdrawal: number;
}

interface TaxFormsTableProps {
  forms: AdminTaxForm[];
  onView: (form: AdminTaxForm) => void;
  onDownload: (form: AdminTaxForm) => void;
  onVerify: (form: AdminTaxForm) => void;
  onReject?: (form: AdminTaxForm) => void;
}

export default function TaxFormsTable({ forms, onView, onDownload, onVerify, onReject }: TaxFormsTableProps) {
  if (!forms.length) {
    return (
      <div className="bg-[#191D24] border border-gray-800 rounded-lg p-10 text-center">
        <div className="text-gray-400 text-3xl mb-3">📄</div>
        <p className="text-gray-300 font-semibold">No user tax forms found.</p>
        <p className="text-gray-500 mt-2">Adjust filters to see forms.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800 bg-[#191D24]">
      <Table>
        <TableHeader className="bg-[#242B35]">
          <TableRow>
            <TableHead className="px-4 py-3 text-xs text-white">User</TableHead>
            <TableHead className="px-4 py-3 text-xs text-white">Email/Number</TableHead>
            <TableHead className="px-4 py-3 text-xs text-white">Form Type</TableHead>
            <TableHead className="px-4 py-3 text-xs text-white">Financial Year</TableHead>
            <TableHead className="px-4 py-3 text-xs text-white">Status</TableHead>
            <TableHead className="px-4 py-3 text-xs text-white">Submitted Date</TableHead>
            <TableHead className="px-4 py-3 text-right text-xs text-white">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {forms.map((form) => (
            <TableRow key={form.submissionId} className="hover:bg-[#1f2937] cursor-pointer">
              <TableCell className="text-white font-semibold" onClick={() => onView(form)}>{form.userName}</TableCell>
              <TableCell className="text-gray-300">
                <span className="flex items-center gap-1.5">
                  <span
                    className="cursor-pointer"
                    onClick={() => onView(form)}
                  >
                    {form.email || "-"}
                  </span>
                  <CopyButton value={form.email} size={12} />
                </span>
              </TableCell>
              <TableCell className="text-gray-300">{form.formType}</TableCell>
              <TableCell className="text-gray-300">{form.financialYear}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                  form.status === "pending"
                    ? "bg-yellow-500/15 text-yellow-300"
                    : form.status === "verified"
                    ? "bg-green-500/15 text-green-300"
                    : form.status === "not_submitted"
                    ? "bg-gray-500/15 text-gray-300"
                    : "bg-red-500/15 text-red-300"
                }`}>
                  {form.status.replace("_", " ").toUpperCase()}
                </span>
              </TableCell>
              <TableCell className="text-gray-300">{form.submittedDate ? new Date(form.submittedDate).toLocaleDateString() : "-"}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={`Open actions for ${form.userName}`}
                      className="text-red-400 hover:text-orange-400 transition-colors"
                    >
                      <Wrench size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-[#1a2030] text-white p-2 border border-[#334155]"
                  >
                    <DropdownMenuLabel className="text-gray-400 text-xs">
                      Actions
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gray-700" />
                    <DropdownMenuItem
                      onClick={() => onView(form)}
                      className="text-sm hover:bg-[#242B35] cursor-pointer"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDownload(form)}
                      className="text-sm hover:bg-[#242B35] cursor-pointer"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </DropdownMenuItem>
                    {form.status === "pending" && (
                      <>
                        <DropdownMenuItem
                          onClick={() => onVerify(form)}
                          className="text-green-400 text-sm hover:bg-[#242B35] cursor-pointer"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Verify
                        </DropdownMenuItem>
                        {onReject && (
                          <DropdownMenuItem
                            onClick={() => onReject(form)}
                            className="text-red-400 text-sm hover:bg-[#242B35] cursor-pointer"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
