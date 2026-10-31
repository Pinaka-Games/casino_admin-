"use client";

import React, { useEffect, useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import type { FilterField, FilterValues } from "@/components/filters/types";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Settings } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import TaxFormsTable, { AdminTaxForm } from "@/components/tax/TaxFormsTable";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { redeemApi, AdminW9Submission } from "@/api/redeem/redeem.api";
import W9SettingsModal from "./components/W9SettingsModal";
import { jsPDF } from "jspdf";

const mapSubmissionToForm = (submission: AdminW9Submission): AdminTaxForm => ({
  submissionId: submission.submissionId,
  userId: submission.userId,
  userName: submission.userName,
  email: submission.email,
  formType: "W-9",
  financialYear: submission.financialYear,
  status:
    submission.status === "VERIFIED"
      ? "verified"
      : submission.status === "REJECTED"
        ? "rejected"
        : submission.status === "NOT_SUBMITTED"
          ? "not_submitted"
          : "pending",
  submittedDate: submission.submittedDate,
  totalWithdrawal: submission.totalWithdrawal,
});

export default function WalletTaxFormsPage() {
  const TAX_FILTER_DEFAULTS: FilterValues = {
  formType: "all",
  year: "all",
  status: "all",
};

const PAGE_SIZE = 10;

  const [search, setSearch] = useState("");
  const [submissions, setSubmissions] = useState<AdminW9Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "W-9" | "1099">("W-9");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "verified" | "rejected">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedForm, setSelectedForm] = useState<AdminTaxForm | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<AdminW9Submission | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [rejectingForm, setRejectingForm] = useState<AdminTaxForm | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const loadForms = async () => {
    setLoading(true);
    try {
      const res = await redeemApi.getW9Submissions();
      setSubmissions(res.data);
    } catch {
      toast.error("Failed to load W-9 submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadForms();
  }, []);

  const forms = useMemo(() => submissions.map(mapSubmissionToForm), [submissions]);
  const availableYears = useMemo(
    () => Array.from(new Set(submissions.map((item) => item.financialYear))).sort((a, b) => Number(b) - Number(a)),
    [submissions],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const taxFilterFields: FilterField[] = useMemo(
    () => [
      {
        type: "select",
        key: "formType",
        label: "Form type",
        options: [
          { value: "all", label: "All Form Types" },
          { value: "W-9", label: "W-9" },
        ],
      },
      {
        type: "select",
        key: "year",
        label: "Financial year",
        options: [
          { value: "all", label: "All Years" },
          ...availableYears.map((year) => ({ value: year, label: year })),
        ],
      },
      {
        type: "select",
        key: "status",
        label: "Status",
        options: [
          { value: "all", label: "All Status" },
          { value: "pending", label: "Pending" },
          { value: "verified", label: "Verified" },
          { value: "rejected", label: "Rejected" },
        ],
      },
    ],
    [availableYears]
  );

  const filteredForms = useMemo(() => {
    return forms.filter((form) => {
      const queryLower = search.toLowerCase();
      const matchesSearch =
        form.userName.toLowerCase().includes(queryLower) ||
        (form.email || "").toLowerCase().includes(queryLower) ||
        form.userId.toLowerCase().includes(queryLower);
      const matchesType = filterType === "all" || form.formType === filterType;
      const matchesYear = filterYear === "all" || form.financialYear === filterYear;
      const matchesStatus = filterStatus === "all" || form.status === filterStatus;
      return matchesSearch && matchesType && matchesYear && matchesStatus;
    });
  }, [forms, search, filterType, filterYear, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredForms.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedForms = filteredForms.slice(startIndex, endIndex);

  const handleView = (form: AdminTaxForm) => {
    setSelectedForm(form);
    setSelectedSubmission(submissions.find((item) => item.submissionId === form.submissionId) ?? null);
    setIsViewModalOpen(true);
  };

  const handleDownload = (form: AdminTaxForm) => {
    const submission = submissions.find((item) => item.submissionId === form.submissionId);
    const doc = new jsPDF();
    
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55);
    doc.text("Tax Form Summary", 20, 20);
    
    // Divider
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.line(20, 26, 190, 26);
    
    // Data list
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    
    const fields = [
      { label: "User ID:", value: form.userId },
      { label: "User Name:", value: form.userName },
      { label: "Email/Number:", value: form.email ?? "-" },
      { label: "Form Type:", value: form.formType },
      { label: "Financial Year:", value: form.financialYear },
      { label: "Status:", value: form.status },
      { label: "Submitted Date:", value: form.submittedDate ?? "-" },
      { label: "Total Withdrawal:", value: String(form.totalWithdrawal) },
      { label: "Legal Name:", value: submission?.legalName ?? "-" },
      { label: "Business Name:", value: submission?.businessName ?? "-" },
      { label: "Tax Classification:", value: submission?.taxClassification ?? "-" },
      { label: "Tax ID Type:", value: submission?.taxIdType ?? "-" },
      { label: "Masked Tax ID:", value: submission?.maskedTaxId ?? "-" },
    ];
    
    let y = 38;
    fields.forEach((field) => {
      doc.setFont("helvetica", "bold");
      doc.text(field.label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(field.value, 65, y);
      y += 9;
    });
    
    doc.save(`${form.formType}-${form.userId}-${form.financialYear}.pdf`);
  };

  const handleVerify = async (form: AdminTaxForm) => {
    try {
      await redeemApi.updateW9SubmissionStatus(form.submissionId, "VERIFIED");
      toast.success("W-9 verified");
      await loadForms();
    } catch {
      toast.error("Failed to verify W-9");
    }
  };

  const handleReject = async (form: AdminTaxForm) => {
    setRejectingForm(form);
    setRejectionReason("");
  };

  const confirmReject = async () => {
    if (!rejectingForm) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      toast.error("Rejection reason is required");
      return;
    }

    setRejectSubmitting(true);
    try {
      await redeemApi.updateW9SubmissionStatus(rejectingForm.submissionId, "REJECTED", reason);
      toast.success("W-9 rejected");
      setRejectingForm(null);
      setRejectionReason("");
      await loadForms();
    } catch {
      toast.error("Failed to reject W-9");
    } finally {
      setRejectSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-white">
            <div>
              <h1 className="text-2xl font-bold">User W-9 Tax Forms List</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* W-9 Form Config is reached from here rather than the sidebar —
                the config and the submissions it shapes are one flow. */}
            <Link href="/settings/spin-config">
              <Button
                variant="outline"
                className="border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
              >
                W-9 Form Config
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wallet/tax-generation">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">Tax Generation</Button>
            </Link>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-3 mb-4">
        <div className="rounded-lg bg-[#191D24] p-2">
          <FilterToolbar
            className="mb-0"
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search by User ID, Email/Number or Name"
            activeCount={
              (filterType !== "all" ? 1 : 0) +
              (filterYear !== "all" ? 1 : 0) +
              (filterStatus !== "all" ? 1 : 0)
            }
            onOpenFilters={() => setSheetOpen(true)}
            actions={
              <>
                {/* Sits right after Filters: the W-9 switch and threshold belong
                    with the submissions they govern. */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettingsOpen(true)}
                  className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
                <ExportCSV
                data={filteredForms}
                fileName="tax_forms.csv"
                getRowDate={(form) => form.submittedDate}
                headers={[
                  "User",
                  "Email/Number",
                  "Form Type",
                  "Financial Year",
                  "Status",
                  "Submitted Date",
                ]}
                mapRow={(form) => [
                  form.userName,
                  form.email ?? "-",
                  form.formType,
                  form.financialYear,
                  form.status.replace("_", " ").toUpperCase(),
                  form.submittedDate
                    ? new Date(form.submittedDate).toLocaleDateString()
                    : "-",
                ]}
                />
              </>
            }
          />
        </div>

        <W9SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

        <EntityFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Tax Form Filters"
          description="Narrow which submissions this list shows."
          fields={taxFilterFields}
          values={{
            formType: filterType,
            year: filterYear,
            status: filterStatus,
          }}
          defaults={TAX_FILTER_DEFAULTS}
          onApply={(values) => {
            setFilterType((values.formType ?? "all") as "all" | "W-9" | "1099");
            setFilterYear(values.year ?? "all");
            setFilterStatus(
              (values.status ?? "all") as "all" | "pending" | "verified" | "rejected"
            );
            setCurrentPage(1);
          }}
        />
      </motion.div>

      <TaxFormsTable
        forms={paginatedForms}
        onView={handleView}
        onDownload={handleDownload}
        onVerify={handleVerify}
        onReject={handleReject}
      />

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-gray-400 text-xs">
          Showing {filteredForms.length === 0 ? 0 : startIndex + 1} to{" "}
          {Math.min(endIndex, filteredForms.length)} of {filteredForms.length} forms
        </div>
        {totalPages > 1 && (
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="bg-[#1D222B] border border-gray-800 w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Tax Form Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Review submission details for this tax form.
            </DialogDescription>
          </DialogHeader>

          {selectedForm && (
            <div className="mt-2 overflow-y-auto pr-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">User</p>
                <p className="text-white font-semibold">{selectedForm.userName}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Email</p>
                <p className="flex items-center gap-1.5 text-white font-semibold">
                  <span className="min-w-0 break-all">{selectedForm.email || "-"}</span>
                  <CopyButton value={selectedForm.email} size={12} />
                </p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Form Type</p>
                <p className="text-white font-semibold">{selectedForm.formType}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Financial Year</p>
                <p className="text-white font-semibold">{selectedForm.financialYear}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Status</p>
                <p className="text-white font-semibold capitalize">{selectedForm.status}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Submitted Date</p>
                <p className="text-white font-semibold">
                  {selectedForm.submittedDate ? new Date(selectedForm.submittedDate).toLocaleDateString() : "-"}
                </p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3 sm:col-span-2">
                <p className="text-gray-400 text-xs">Total Withdrawal</p>
                <p className="text-white font-semibold">${selectedForm.totalWithdrawal.toLocaleString()}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Legal Name</p>
                <p className="text-white font-semibold">{selectedSubmission?.legalName || "-"}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Masked Tax ID</p>
                <p className="text-white font-semibold">{selectedSubmission?.maskedTaxId || "-"}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Tax Classification</p>
                <p className="text-white font-semibold">{selectedSubmission?.taxClassification || "-"}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Tax ID Type</p>
                <p className="text-white font-semibold">{selectedSubmission?.taxIdType || "-"}</p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3 sm:col-span-2">
                <p className="text-gray-400 text-xs">Address</p>
                <p className="text-white font-semibold">
                  {[
                    selectedSubmission?.addressLine1,
                    selectedSubmission?.addressLine2,
                    selectedSubmission?.city,
                    selectedSubmission?.state,
                    selectedSubmission?.zipCode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </p>
              </div>
              <div className="bg-[#191D24] rounded-lg p-3 sm:col-span-2">
                <p className="text-gray-400 text-xs">Rejection Reason</p>
                <p className="text-white font-semibold">{selectedSubmission?.rejectionReason || "-"}</p>
              </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectingForm)} onOpenChange={(open) => !open && setRejectingForm(null)}>
        <DialogContent className="bg-[#1D222B] border border-gray-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Reject W-9 Submission</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add the rejection reason. The user will receive this reason in their notification and can update the same W-9 form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-gray-800 bg-[#191D24] p-3 text-sm">
              <p className="text-gray-400 text-xs mb-1">User</p>
              <p className="text-white font-semibold">{rejectingForm?.userName}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Reason</label>
              <Textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Tell the user what needs to be corrected before resubmitting."
                className="min-h-[120px] bg-[#191D24] border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectingForm(null)}
              className="border-gray-700 text-white hover:bg-[#242B35]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmReject}
              disabled={rejectSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {rejectSubmitting ? "Rejecting..." : "Reject W-9"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
