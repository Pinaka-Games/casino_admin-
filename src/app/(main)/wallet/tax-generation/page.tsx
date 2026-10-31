"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Eye, Loader2, UploadCloud } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/Pagination";
import ImagePreviewModal from "@/components/ImagePreviewModal/ImagePreviewModal";
import EmptyStatePage from "@/components/emptystatePage";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import { notfound } from "@/assets/icons";
import { uploadSingle } from "@/api/upload/upload.api";
import { redeemApi, AdminW9Submission, RedeemRequest, RedeemStatus } from "@/api/redeem/redeem.api";

type UserRedeemMetrics = {
  total: number;
  pending: number;
  count: number;
};

const STORAGE_KEY = "tax_generation_generated_years";
const USERS_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 8;

function getFinancialYearStart(value: string): number {
  const match = value.match(/^(\d{4})/);
  return match ? Number(match[1]) : Number(value);
}

function buildFinancialYearOptions(existingYears: string[]): string[] {
  const now = new Date();
  const currentStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const years = new Set(existingYears.filter(Boolean));

  for (let start = currentStart - 5; start <= currentStart + 1; start += 1) {
    years.add(`${start}-${String((start + 1) % 100).padStart(2, "0")}`);
  }

  return Array.from(years).sort((a, b) => getFinancialYearStart(b) - getFinancialYearStart(a));
}

function formatFinancialYear(value: string): string {
  if (!value) return "-";
  if (value === "all") return "All Years";

  if (/^\d{4}$/.test(value)) {
    const start = Number(value);
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  }

  const fullRange = value.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (fullRange) {
    const start = Number(fullRange[1]);
    const end = Number(fullRange[2]);
    return `${start}-${String(end % 100).padStart(2, "0")}`;
  }

  const shortRange = value.match(/^(\d{4})\s*-\s*(\d{2})$/);
  if (shortRange) {
    return `${shortRange[1]}-${shortRange[2]}`;
  }

  return value;
}

function formatAmount(value: number): string {
  return `${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} SC`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

function w9StatusClass(status: AdminW9Submission["status"]): string {
  if (status === "VERIFIED") return "bg-green-500/15 text-green-300";
  if (status === "PENDING") return "bg-yellow-500/15 text-yellow-300";
  if (status === "REJECTED") return "bg-red-500/15 text-red-300";
  return "bg-gray-500/15 text-gray-300";
}

function redeemStatusClass(status: RedeemStatus): string {
  if (status === "PROCESSED" || status === "APPROVED") return "bg-green-500/15 text-green-300";
  if (status === "PENDING") return "bg-yellow-500/15 text-yellow-300";
  if (status === "REJECTED") return "bg-red-500/15 text-red-300";
  return "bg-gray-500/15 text-gray-300";
}

export default function WalletTaxGenerationPage() {
  const [submissions, setSubmissions] = useState<AdminW9Submission[]>([]);
  const [redeemRequests, setRedeemRequests] = useState<RedeemRequest[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [generatedYears, setGeneratedYears] = useState<Record<string, number>>({});
  const [activeEntityTab, setActiveEntityTab] = useState<"all" | "uploaded" | "notUploaded">("all");
  const [historyUser, setHistoryUser] = useState<AdminW9Submission | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [uploadTargetUser, setUploadTargetUser] = useState<AdminW9Submission | null>(null);
  const [uploadingUserId, setUploadingUserId] = useState<string | null>(null);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settingsYear, setSettingsYear] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("Preview");
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const loadTaxGenerationData = useCallback(async () => {
    setLoading(true);
    const [submissionsRes, requestsRes] = await Promise.allSettled([
      redeemApi.getW9Submissions(),
      redeemApi.getAllRequests(),
    ]);

    if (submissionsRes.status === "fulfilled") {
      setSubmissions(submissionsRes.value.data);
      if (submissionsRes.value.data.length > 0) {
        const years = Array.from(new Set(submissionsRes.value.data.map((item) => item.financialYear))).sort(
          (a, b) => getFinancialYearStart(b) - getFinancialYearStart(a),
        );
        setSelectedYear((current) => current || years[0] || "");
        setSettingsYear((current) => current || years[0] || "");
      }
    } else {
      toast.error("Failed to load tax generation data");
    }

    if (requestsRes.status === "fulfilled") {
      setRedeemRequests(requestsRes.value.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setGeneratedYears(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    void loadTaxGenerationData();
  }, [loadTaxGenerationData]);

  const stats = useMemo(() => {
    const grouped = new Map<string, AdminW9Submission[]>();
    submissions.forEach((submission) => {
      const arr = grouped.get(submission.financialYear) ?? [];
      arr.push(submission);
      grouped.set(submission.financialYear, arr);
    });

    return Array.from(grouped.entries())
      .map(([year, items]) => {
        const verified = items.filter((item) => item.status === "VERIFIED");
        const pending = items.filter((item) => item.status === "PENDING");
        return {
          year,
          total: items.length,
          verifiedCount: verified.length,
          pendingCount: pending.length,
          generatedCount: generatedYears[year] ?? 0,
        };
      })
      .sort((a, b) => getFinancialYearStart(b.year) - getFinancialYearStart(a.year));
  }, [submissions, generatedYears]);

  const availableYears = useMemo(() => {
    const yearsFromStats = stats.map((stat) => stat.year);
    const yearsFromStorage = Object.keys(generatedYears);
    return buildFinancialYearOptions([...yearsFromStats, ...yearsFromStorage]);
  }, [stats, generatedYears]);

  const usersForSelectedYear = useMemo(() => {
    if (!selectedYear) return [];
    const statusPriority: Record<AdminW9Submission["status"], number> = {
      VERIFIED: 4,
      PENDING: 3,
      REJECTED: 2,
      NOT_SUBMITTED: 1,
    };

    const byUser = new Map<string, AdminW9Submission>();
    for (const submission of submissions) {
      if (selectedYear !== "all" && submission.financialYear !== selectedYear) continue;

      const existing = byUser.get(submission.userId);
      if (!existing) {
        byUser.set(submission.userId, submission);
        continue;
      }

      const currentPriority = statusPriority[submission.status];
      const existingPriority = statusPriority[existing.status];

      if (currentPriority > existingPriority) {
        byUser.set(submission.userId, submission);
        continue;
      }

      const currentTimestamp = new Date(submission.submittedDate ?? 0).getTime();
      const existingTimestamp = new Date(existing.submittedDate ?? 0).getTime();
      if (currentPriority === existingPriority && currentTimestamp > existingTimestamp) {
        byUser.set(submission.userId, submission);
      }
    }

    return Array.from(byUser.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [submissions, selectedYear]);

  const filteredUsersForSelectedYear = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return usersForSelectedYear;

    return usersForSelectedYear.filter((user) => {
      const userName = (user.userName || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const userId = (user.userId || "").toLowerCase();
      return userName.includes(term) || email.includes(term) || userId.includes(term);
    });
  }, [usersForSelectedYear, userSearch]);

  const uploadedUserIdsForSelectedYear = useMemo(() => {
    const ids = new Set<string>();
    submissions.forEach((entry) => {
      if (selectedYear && selectedYear !== "all" && entry.financialYear !== selectedYear) return;
      if (entry.w10FileUrl) ids.add(entry.userId);
    });
    return ids;
  }, [submissions, selectedYear]);

  const filteredNotUploadedUsersForSelectedYear = useMemo(
    () => filteredUsersForSelectedYear.filter((user) => !uploadedUserIdsForSelectedYear.has(user.userId)),
    [filteredUsersForSelectedYear, uploadedUserIdsForSelectedYear],
  );

  const activeUsersForSelectedYear = useMemo(() => {
    if (activeEntityTab === "notUploaded") return filteredNotUploadedUsersForSelectedYear;
    return filteredUsersForSelectedYear;
  }, [activeEntityTab, filteredNotUploadedUsersForSelectedYear, filteredUsersForSelectedYear]);

  const totalUserPages = Math.max(1, Math.ceil(activeUsersForSelectedYear.length / USERS_PAGE_SIZE));

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PAGE_SIZE;
    return activeUsersForSelectedYear.slice(start, start + USERS_PAGE_SIZE);
  }, [activeUsersForSelectedYear, usersPage]);

  const redeemMetricsByUser = useMemo(() => {
    const map = new Map<string, UserRedeemMetrics>();

    for (const request of redeemRequests) {
      const amount = Number(request.amount) || 0;
      const current = map.get(request.userId) ?? { total: 0, pending: 0, count: 0 };
      current.total += amount;
      current.count += 1;
      if (request.status === "PENDING") current.pending += amount;
      map.set(request.userId, current);
    }

    return map;
  }, [redeemRequests]);

  const transactionsForHistoryUser = useMemo(() => {
    if (!historyUser) return [];
    return redeemRequests
      .filter((request) => request.userId === historyUser.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [redeemRequests, historyUser]);

  const totalHistoryPages = Math.max(1, Math.ceil(transactionsForHistoryUser.length / HISTORY_PAGE_SIZE));

  const paginatedTransactionsForHistoryUser = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return transactionsForHistoryUser.slice(start, start + HISTORY_PAGE_SIZE);
  }, [transactionsForHistoryUser, historyPage]);

  const uploadedForSelectedYear = useMemo(() => {
    const rows = submissions.filter((entry) => {
      if (!entry.w10FileUrl) return false;
      if (!selectedYear || selectedYear === "all") return true;
      return entry.financialYear === selectedYear;
    });
    return rows.sort((a, b) => new Date(b.w10UploadedAt ?? 0).getTime() - new Date(a.w10UploadedAt ?? 0).getTime());
  }, [submissions, selectedYear]);

  const persistGeneratedCount = (year: string, count: number) => {
    const next = { ...generatedYears, [year]: count };
    setGeneratedYears(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const openTransactionHistory = (submission: AdminW9Submission) => {
    setHistoryUser(submission);
    setHistoryPage(1);
    setIsHistoryDialogOpen(true);
  };

  const openFilePreview = (fileUrl: string | null | undefined, fileName?: string | null) => {
    if (!fileUrl) {
      toast.error("No file available for preview");
      return;
    }
    setPreviewUrl(fileUrl);
    setPreviewFileName(fileName || null);
    setPreviewTitle(fileName || "Document Preview");
    setPreviewOpen(true);
  };

  const triggerW10Upload = (submission: AdminW9Submission) => {
    setUploadTargetUser(submission);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
      uploadInputRef.current.click();
    }
  };

  const onW10FileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadTargetUser) return;

    setUploadingUserId(uploadTargetUser.userId);
    try {
      const uploadRes = await uploadSingle(file, `tax-documents/w10/${uploadTargetUser.financialYear}`);
      const fileUrl = uploadRes.data.url || uploadRes.data.signedUrl;
      await redeemApi.uploadW10ForSubmission(uploadTargetUser.submissionId, {
        fileName: file.name,
        fileUrl,
        fileKey: uploadRes.data.key,
      });

      setSubmissions((prev) =>
        prev.map((item) =>
          item.submissionId === uploadTargetUser.submissionId
            ? {
                ...item,
                w10FileName: file.name,
                w10FileUrl: fileUrl,
                w10FileKey: uploadRes.data.key,
                w10UploadedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setActiveEntityTab("uploaded");
      toast.success("W-10 form uploaded successfully");
    } catch {
      toast.error("Failed to upload W-10 form");
    } finally {
      setUploadingUserId(null);
      setUploadTargetUser(null);
      event.target.value = "";
    }
  };

  useEffect(() => {
    setUsersPage(1);
  }, [selectedYear, userSearch, activeEntityTab]);

  useEffect(() => {
    if (usersPage > totalUserPages) {
      setUsersPage(totalUserPages);
    }
  }, [usersPage, totalUserPages]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyUser?.userId, isHistoryDialogOpen]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  const openSettingsDialog = () => {
    if (selectedYear && selectedYear !== "all") {
      setSettingsYear(selectedYear);
    } else {
      setSettingsYear(availableYears[0] || "");
    }
    setIsSettingsDialogOpen(true);
  };

  const onGenerateExcel = async () => {
    if (!settingsYear) {
      toast.error("Please select financial year");
      return;
    }

    setIsGenerating(true);
    try {
      const filtered = submissions.filter((submission) => {
        if (submission.financialYear !== settingsYear) return false;
        if (submission.status !== "VERIFIED") return false;
        return true;
      });

      if (filtered.length === 0) {
        toast.error("No verified records found for selected filters");
        setIsGenerating(false);
        return;
      }

      const rows = filtered.map((submission) => ({
        "Financial Year": formatFinancialYear(submission.financialYear),
        "User ID": submission.userId,
        "User Name": submission.userName,
        "Email/Number": submission.email ?? "-",
        "Legal Name": submission.legalName ?? "-",
        "Business Name": submission.businessName ?? "-",
        "Tax Classification": submission.taxClassification ?? "-",
        "Tax ID Type": submission.taxIdType ?? "-",
        "Masked Tax ID": submission.maskedTaxId ?? "-",
        "Address Line 1": submission.addressLine1 ?? "-",
        "Address Line 2": submission.addressLine2 ?? "-",
        City: submission.city ?? "-",
        State: submission.state ?? "-",
        "ZIP Code": submission.zipCode ?? "-",
        "Total Withdrawal": Number(submission.totalWithdrawal),
        "W-9 Status": submission.status,
        "W-9 Submitted Date": submission.submittedDate ? new Date(submission.submittedDate).toLocaleDateString() : "-",
        "W-9 Reviewed Date": submission.reviewedAt ? new Date(submission.reviewedAt).toLocaleDateString() : "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 14 }, { wch: 34 }, { wch: 22 }, { wch: 32 }, { wch: 22 }, { wch: 22 },
        { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 14 },
        { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tax Forms");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const fileName = `tax-forms-${formatFinancialYear(settingsYear)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      persistGeneratedCount(settingsYear, filtered.length);
      setSelectedYear(settingsYear);
      setIsSettingsDialogOpen(false);
      toast.success("Excel generated successfully");
    } catch {
      toast.error("Failed to generate Excel");
    } finally {
      setIsGenerating(false);
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
    <div className="min-h-screen bg-[#0F1419] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1320px]">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 text-white">
              <div>
                <h1 className="text-2xl font-bold">Tax Document Generation</h1>
              </div>
            </div>
            {/* Entered from Tax Forms — this page is no longer in the sidebar,
                so it has to offer the way back. */}
            <Link href="/wallet/tax-forms">
              <Button
                variant="outline"
                className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tax Forms
              </Button>
            </Link>
          </div>
        </motion.div>

        {stats.length === 0 ? (
          <Card className="bg-[#191D24] border border-gray-800 p-4">
            <EmptyStatePage
              title="No Tax Records Yet"
              description="No verified or pending W-9 submissions were found for the selected range."
              image={notfound}
            />
          </Card>
        ) : (
          <>
            <Card className="bg-[#191D24] p-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <p className="text-lg text-white">Financial Year</p>
                  <div className="relative min-w-[190px]">
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        if (e.target.value !== "all") {
                          setSettingsYear(e.target.value);
                        }
                      }}
                      className="h-10 w-full appearance-none rounded-md bg-[#151B23] border border-gray-700 text-gray-200 px-3 pr-10"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {formatFinancialYear(year)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-300 whitespace-nowrap">
                    Total Users: <span className="font-semibold text-white">{usersForSelectedYear.length}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={openSettingsDialog}
                >
                  Generate Tax Report
                </Button>
              </div>
            </Card>

            <Card className="mt-6 bg-[#191D24] border border-gray-800 p-4">
              <Tabs
                value={activeEntityTab}
                onValueChange={(value) => setActiveEntityTab(value as "all" | "uploaded" | "notUploaded")}
               
              >  
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <TabsList className="bg-[#151B23] border border-gray-700 p-1 h-auto">
                  <TabsTrigger
                    value="all"
                    className="text-gray-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                  >
                    All Users
                  </TabsTrigger>
                  <TabsTrigger
                    value="uploaded"
                    className="text-gray-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                  >
                    Uploaded W-10
                  </TabsTrigger>
                  <TabsTrigger
                    value="notUploaded"
                    className="text-gray-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                  >
                    Not Uploaded
                  </TabsTrigger>

                   
                </TabsList>
                  <div className="w-full lg:w-auto lg:ml-auto">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search user name, email or number..."
                      className="h-9 w-full lg:w-[260px] rounded-md bg-[#151B23] border border-gray-700 text-gray-200 px-3 text-sm placeholder:text-gray-500"
                    />
                  </div>
</div>
                {activeEntityTab !== "uploaded" && (
                <div className="mt-4">
                  {activeUsersForSelectedYear.length === 0 ? (
                    <div className="rounded-lg border border-gray-800 bg-[#151B23] px-4">
                      <EmptyStatePage
                        title={`No users found for ${formatFinancialYear(selectedYear)}.`}
                        description=" "
                        image={notfound}
                      />
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-800 bg-[#151B23]">
                      <Table>
                        <TableHeader className="bg-[#121720]">
                          <TableRow>
                            <TableHead className="text-gray-400">User Name</TableHead>
                            <TableHead className="text-gray-400">Email/Number</TableHead>
                            <TableHead className="text-gray-400">Earned</TableHead>
                            <TableHead className="text-gray-400">Total Withdraw</TableHead>
                            <TableHead className="text-gray-400">W-9 Status</TableHead>
                            <TableHead className="text-gray-400 text-right">Transaction History</TableHead>
                            <TableHead className="text-gray-400 text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedUsers.map((user) => {
                            const metrics = redeemMetricsByUser.get(user.userId);
                            const earned = metrics?.total ?? user.totalWithdrawal;

                            return (
                              <TableRow key={`${user.userId}-${user.financialYear}`} className="hover:bg-[#1A2230]">
                                <TableCell className="text-white font-semibold">{user.userName}</TableCell>
                                <TableCell className="text-gray-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="min-w-0 break-all">{user.email || "-"}</span>
                                    <CopyButton value={user.email} size={12} />
                                  </span>
                                </TableCell>
                                <TableCell className="text-gray-200">{formatAmount(earned)}</TableCell>
                                <TableCell className="text-gray-200">{formatAmount(user.totalWithdrawal)}</TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${w9StatusClass(user.status)}`}>
                                    {user.status.replace("_", " ")}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="border-gray-600 text-gray-200 hover:bg-[#242B35]"
                                    onClick={() => openTransactionHistory(user)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </TableCell>
                                <TableCell className="text-right">
                                  {user.w10FileUrl ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="bg-green-600 text-white hover:bg-green-700"
                                      disabled
                                    >
                                      Uploaded W-10
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="bg-purple-600 hover:bg-purple-700 text-white"
                                      onClick={() => triggerW10Upload(user)}
                                      disabled={uploadingUserId === user.userId}
                                    >
                                      <UploadCloud className="h-4 w-4 mr-1" />
                                      {uploadingUserId === user.userId ? "Uploading..." : "Upload W-10"}
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {activeUsersForSelectedYear.length > 0 && totalUserPages > 1 && (
                    <div className="mt-4">
                      <Pagination currentPage={usersPage} totalPages={totalUserPages} onPageChange={setUsersPage} />
                    </div>
                  )}
                </div>
                )}

                <TabsContent value="uploaded" className="mt-4">
                  {uploadedForSelectedYear.length === 0 ? (
                    <div className="rounded-lg border border-gray-800 bg-[#151B23] px-4">
                      <EmptyStatePage
                        title="No Uploaded W-10 Found"
                        description={`No uploaded W-10 forms found for ${formatFinancialYear(selectedYear)}.`}
                        image={notfound}
                      />
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-800 bg-[#151B23]">
                      <Table>
                        <TableHeader className="bg-[#121720]">
                          <TableRow>
                            <TableHead className="text-gray-400">User Name</TableHead>
                            <TableHead className="text-gray-400">Email/Number</TableHead>
                            <TableHead className="text-gray-400">Year</TableHead>
                            <TableHead className="text-gray-400">File</TableHead>
                            <TableHead className="text-gray-400">Uploaded At</TableHead>
                            <TableHead className="text-gray-400">Total Withdraw</TableHead>
                            <TableHead className="text-gray-400 text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadedForSelectedYear.map((entry) => (
                            <TableRow key={entry.submissionId} className="hover:bg-[#1A2230]">
                              <TableCell className="text-white font-semibold">{entry.userName}</TableCell>
                              <TableCell className="text-gray-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="min-w-0 break-all">{entry.email || "-"}</span>
                                    <CopyButton value={entry.email} size={12} />
                                  </span>
                                </TableCell>
                              <TableCell className="text-gray-300">{formatFinancialYear(entry.financialYear)}</TableCell>
                              <TableCell className="text-gray-300">{entry.w10FileName || "-"}</TableCell>
                              <TableCell className="text-gray-300">{formatDate(entry.w10UploadedAt)}</TableCell>
                              <TableCell className="text-gray-300">{formatAmount(entry.totalWithdrawal)}</TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="border-gray-600 text-gray-200 hover:bg-[#242B35]"
                                    onClick={() => openFilePreview(entry.w10FileUrl, entry.w10FileName)}
                                  >
                                    View
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={() => triggerW10Upload(entry)}
                                    disabled={uploadingUserId === entry.userId}
                                  >
                                    <UploadCloud className="h-4 w-4 mr-1" />
                                    {uploadingUserId === entry.userId ? "Uploading..." : "Re-upload W-10"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </>
        )}

        <input
          ref={uploadInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.xls,.xlsx,.csv"
          onChange={onW10FileSelected}
        />

        <ImagePreviewModal
          open={previewOpen}
          imageUrl={previewUrl}
          title={previewTitle}
          fileName={previewFileName}
          onClose={() => setPreviewOpen(false)}
        />

        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent className="bg-[#1D222B] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Generate Tax Report</DialogTitle>
              <DialogDescription className="text-gray-400">
                Select a financial year to generate the report.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <label htmlFor="financialYear" className="text-xs text-gray-300">
                  Financial Year
                </label>
                <div className="relative">
                  <select
                    id="financialYear"
                    value={settingsYear}
                    onChange={(e) => setSettingsYear(e.target.value)}
                    className="w-full h-10 appearance-none rounded-md bg-[#151B23] border border-gray-700 text-gray-200 px-3 pr-10"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {formatFinancialYear(year)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)} disabled={isGenerating}>
                  Cancel
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={onGenerateExcel}
                  disabled={isGenerating || !settingsYear}
                >
                  {isGenerating ? "Generating..." : "Generate Tax Report"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="bg-[#1D222B] w-[96vw] max-w-[96vw] lg:max-w-[1280px] xl:max-w-[1400px] h-[88vh] flex flex-col">
            <DialogHeader>
              {/* `pr-10` reserves the top-right corner for the dialog's own
                  close button, which is absolutely positioned there — without
                  it the export control sat underneath the cross. */}
              <div className="flex items-start justify-between gap-3 pr-10">
                <div>
                  <DialogTitle className="text-white">
                    {historyUser?.userName || "User"} Transaction History
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    All withdrawal transactions for user: {historyUser?.userId || "-"}
                  </DialogDescription>
                </div>
                <ExportCSV
                  data={transactionsForHistoryUser}
                  headers={["Reference ID", "Amount", "Status", "Method", "Created At", "Processed At"]}
                  fileName={`transaction-history-${(historyUser?.userName || "user").replace(/\s+/g, "-").toLowerCase()}.csv`}
                  getRowDate={(row) => row.createdAt}
                  mapRow={(row) => [
                    row.id,
                    Number(row.amount || 0).toFixed(2),
                    row.status,
                    row.paymentMethod || "-",
                    row.createdAt ? new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19) : "-",
                    row.processedAt ? new Date(row.processedAt).toISOString().replace("T", " ").slice(0, 19) : "-",
                  ]}
                />
              </div>
            </DialogHeader>

            <div className="mt-2 flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-700">
                <div className="min-w-[840px]">
                  <Table>
                    <TableHeader className="bg-[#121720]">
                      <TableRow>
                        <TableHead className="text-gray-400">Reference ID</TableHead>
                        <TableHead className="text-gray-400">Amount</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Method</TableHead>
                        <TableHead className="text-gray-400">Created At</TableHead>
                        <TableHead className="text-gray-400">Processed At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionsForHistoryUser.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                            No withdrawal transactions found for this user.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTransactionsForHistoryUser.map((row) => (
                          <TableRow key={row.id} className="hover:bg-[#1A2230]">
                            <TableCell className="text-gray-300 font-mono">{row.id.slice(0, 12)}...</TableCell>
                            <TableCell className="text-gray-200">{formatAmount(Number(row.amount) || 0)}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${redeemStatusClass(row.status)}`}>
                                {row.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-gray-300">{row.paymentMethod || "-"}</TableCell>
                            <TableCell className="text-gray-300">{formatDate(row.createdAt)}</TableCell>
                            <TableCell className="text-gray-300">{formatDate(row.processedAt)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {transactionsForHistoryUser.length > 0 && totalHistoryPages > 1 && (
                <div className="pt-4">
                  <Pagination currentPage={historyPage} totalPages={totalHistoryPages} onPageChange={setHistoryPage} />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
