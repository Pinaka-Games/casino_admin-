"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AmlAlertRow,
  type AmlAlertStatus,
} from "@/api/compliance/aml.api";
import { useAmlAlertsStore } from "@/store/aml-alerts-store";
import CopyButton from "@/components/CopyButton";

interface Props {
  open: boolean;
  data: AmlAlertRow | null;
  onClose: () => void;
}

const STATUS_OPTIONS: AmlAlertStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "FALSE_POSITIVE",
  "CLOSED",
  "ESCALATED",
];

const severityClass: Record<string, string> = {
  HIGH: "bg-red-500/20 text-red-400",
  MEDIUM: "bg-yellow-500/20 text-yellow-400",
  LOW: "bg-blue-500/20 text-blue-400",
};

const statusClass: Record<string, string> = {
  OPEN: "bg-blue-500/20 text-blue-400",
  IN_PROGRESS: "bg-yellow-500/20 text-yellow-400",
  FALSE_POSITIVE: "bg-gray-500/20 text-gray-300",
  CLOSED: "bg-green-500/20 text-green-400",
  ESCALATED: "bg-red-500/20 text-red-400",
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const iso = hasZone ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export default function AmlAlertDetailsModal({ open, data, onClose }: Props) {
  const { changeStatus, assign, escalate, isMutating } = useAmlAlertsStore();
  const [status, setStatus] = useState<AmlAlertStatus>("OPEN");
  const [assignee, setAssignee] = useState("");

  useEffect(() => {
    if (data) {
      setStatus(data.status);
      setAssignee(data.assignedTo || "");
    }
  }, [data]);

  if (!open || !data) return null;

  const details = asRecord(data.details);
  const matchTypes = Array.isArray(details?.matchTypes) ? (details?.matchTypes as unknown[]) : [];
  const amount = details?.amount;
  const currency = details?.currency;

  const handleStatus = async () => {
    if (status === data.status) return;
    try {
      await changeStatus(data.id, status);
      toast.success(`Status set to ${status}`);
    } catch {
      /* store surfaces the error */
    }
  };

  const handleAssign = async () => {
    if (!assignee.trim()) {
      toast.error("Enter an assignee");
      return;
    }
    try {
      await assign(data.id, assignee.trim());
      toast.success("Alert assigned");
    } catch {
      /* handled */
    }
  };

  const handleEscalate = async () => {
    try {
      await escalate(data.id, { summary: data.summary || undefined, priority: data.severity });
      toast.success("Alert escalated to a case");
    } catch {
      /* handled */
    }
  };

  const Row = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
    <div className="flex justify-between items-start gap-3">
      <span className="text-gray-400 text-sm">{label}:</span>
      <span className={`text-white text-sm text-right break-all max-w-[70%] ${mono ? "font-mono" : ""}`}>
        {value ?? "-"}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#191D24] rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-[#191D24] z-10">
          <h2 className="text-xl font-semibold text-white">AML Alert Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overview */}
          <div className="bg-[#242B35] rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-purple-400 mb-2">Overview</h3>
            <Row
              label="Alert ID"
              value={
                <span className="flex items-center gap-2 justify-end">
                  {data.id}
                  <CopyButton value={data.id} size={14} />
                </span>
              }
              mono
            />
            <Row label="Source" value={data.sourceType} />
            <Row
              label="Severity"
              value={
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${severityClass[data.severity] || "bg-gray-500/20 text-gray-400"}`}>
                  {data.severity}
                </span>
              }
            />
            <Row
              label="Status"
              value={
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass[data.status] || "bg-gray-500/20 text-gray-400"}`}>
                  {data.status}
                </span>
              }
            />
            <Row
              label="User"
              value={
                <span className="flex items-center gap-2 justify-end">
                  {data.userIdentifier || "-"}
                  <CopyButton value={data.userIdentifier} size={14} />
                </span>
              }
            />
            <Row label="Summary" value={data.summary || "-"} />
            <Row label="Assigned To" value={data.assignedTo || "Unassigned"} />
            <Row
              label="Case ID"
              value={
                <span className="flex items-center gap-2 justify-end">
                  {data.caseId || "-"}
                  <CopyButton value={data.caseId} size={14} />
                </span>
              }
              mono
            />
            <Row label="Created" value={formatDate(data.createdAt)} />
            <Row label="Updated" value={formatDate(data.updatedAt)} />
          </div>

          {/* Match info */}
          {(matchTypes.length > 0 || amount != null) && (
            <div className="bg-[#242B35] rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-purple-400 mb-2">Match</h3>
              {matchTypes.length > 0 && (
                <Row label="Match Types" value={matchTypes.join(", ")} />
              )}
              {amount != null && (
                <Row label="Amount" value={`${String(amount)} ${currency ? String(currency) : ""}`.trim()} />
              )}
            </div>
          )}

          {/* Raw details */}
          {details && (
            <div className="bg-[#242B35] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-2">Raw Details</h3>
              <pre className="bg-[#15181E] rounded p-3 text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                {JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="bg-[#242B35] rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-2">Actions</h3>

            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AmlAlertStatus)}
                className="bg-[#15181E] border border-[#242B35] text-white text-sm rounded-lg px-3 py-2 flex-1"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleStatus}
                disabled={isMutating || status === data.status}
                className="bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold disabled:opacity-50"
              >
                Update Status
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Assignee (employee id / name)"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="bg-[#15181E]! text-white text-sm flex-1"
              />
              <Button
                onClick={handleAssign}
                disabled={isMutating}
                className="bg-[#1a2030] border border-gray-700 hover:bg-[#242B35] text-white text-xs font-bold disabled:opacity-50"
              >
                Assign
              </Button>
            </div>

            <Button
              onClick={handleEscalate}
              disabled={isMutating || data.status === "ESCALATED"}
              className="w-full bg-red-500/80 hover:bg-red-600 text-white text-xs font-bold disabled:opacity-50"
            >
              {data.status === "ESCALATED" ? "Already Escalated" : "Escalate to Case"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
