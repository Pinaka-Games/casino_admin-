"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, XCircle, FileText, Copy } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MOCK_W9_DATA = {
  id: "tf-001",
  userId: "user-123",
  userName: "John Doe",
  email: "john@example.com",
  fullName: "John Michael Doe",
  businessName: "Doe Gaming Consulting",
  taxClassification: "individual",
  streetAddress: "123 Main Street",
  apartment: "Apt 4B",
  city: "New York",
  state: "NY",
  zipCode: "10001",
  country: "United States",
  tinType: "ssn",
  tin: "XXX-XX-1234",
  submittedDate: "2026-01-15",
  ipAddress: "192.168.1.1",
  totalWithdrawal: 1250,
};

export default function WalletW9ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const [adminNotes, setAdminNotes] = useState("");
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push("/wallet/tax-forms");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push("/wallet/tax-forms");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1419] to-[#1A1F2E]">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-gray-800 bg-[#191D24]/50 backdrop-blur-sm sticky top-0 z-40"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">W-9 Review</h1>
              <p className="text-gray-400 text-sm">ID: {params?.id ?? MOCK_W9_DATA.id}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#191D24] border border-gray-800 rounded-lg p-6"
            >
              <h2 className="text-lg font-semibold text-white mb-4">User Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Full Name</p>
                  <p className="text-white font-medium">{MOCK_W9_DATA.userName}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white font-medium">{MOCK_W9_DATA.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">User ID</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{MOCK_W9_DATA.userId}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(MOCK_W9_DATA.userId)}
                      className="text-gray-400 hover:text-white p-1 h-auto"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Withdrawal</p>
                  <p className="text-white font-medium">${MOCK_W9_DATA.totalWithdrawal.toLocaleString()}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#191D24] border border-gray-800 rounded-lg p-6"
            >
              <h2 className="text-lg font-semibold text-white mb-4">W-9 Form Details</h2>
              <div className="mb-6 pb-6 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs">Full Name (Legal)</p>
                    <p className="text-white font-medium">{MOCK_W9_DATA.fullName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Business Name</p>
                    <p className="text-white font-medium">{MOCK_W9_DATA.businessName || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Tax Classification</h3>
                <p className="text-white font-medium capitalize">{MOCK_W9_DATA.taxClassification}</p>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Address</h3>
                <p className="text-white">{MOCK_W9_DATA.streetAddress}</p>
                {MOCK_W9_DATA.apartment && <p className="text-white">{MOCK_W9_DATA.apartment}</p>}
                <p className="text-white">{MOCK_W9_DATA.city}, {MOCK_W9_DATA.state} {MOCK_W9_DATA.zipCode}</p>
                <p className="text-gray-400">{MOCK_W9_DATA.country}</p>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Taxpayer ID ({MOCK_W9_DATA.tinType.toUpperCase()})</h3>
                <div className="flex items-center gap-2 p-3 bg-gray-900 border border-gray-800 rounded">
                  <p className="text-white font-mono font-medium">{MOCK_W9_DATA.tin}</p>
                  <span className="text-gray-500 text-xs italic ml-auto">(Masked for security)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs">Submitted Date</p>
                  <p className="text-white font-medium">{new Date(MOCK_W9_DATA.submittedDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">IP Address</p>
                  <p className="text-white font-medium">{MOCK_W9_DATA.ipAddress}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#191D24] border border-gray-800 rounded-lg p-6"
            >
              <h2 className="text-lg font-semibold text-white mb-4">Admin Notes</h2>
              <Textarea
                placeholder="Add any internal notes about this submission..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="bg-gray-900 border-gray-700 text-white placeholder-gray-500 min-h-24"
              />
              <p className="text-gray-500 text-xs mt-2">Optional internal context that can be shared with your audit team.</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsRejectDialogOpen(true)}>
                  Reject
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => setIsApproveDialogOpen(true)}>
                  Approve
                </Button>
              </div>
            </motion.div>
          </div>

          <div className="space-y-4">
            <Card className="bg-[#191D24] border border-gray-800 p-4">
              <p className="text-gray-400 text-xs">Auto-saved notes will appear in the activity feed.</p>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="bg-[#1D222B] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Approval</DialogTitle>
            <DialogDescription className="text-gray-400">Approve this W-9 submission and mark it as verified.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={isLoading}>{isLoading ? "Processing..." : "Confirm"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="bg-[#1D222B] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Reject W-9</DialogTitle>
            <DialogDescription className="text-gray-400">Provide rejection reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Reason for rejection"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleReject} disabled={isLoading || !rejectReason.trim()}>{isLoading ? "Rejecting..." : "Reject"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
