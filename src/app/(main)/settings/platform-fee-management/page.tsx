"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Percent, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ActivePlatformFee,
  PlatformFee,
  PlatformFeePayload,
  PlatformFeeType,
  platformFeeApi,
} from "@/api/platform-fee/platform-fee.api";
import { Category, getAdminCategories } from "@/api/games/games";

const FEE_TYPES: { value: PlatformFeeType; label: string }[] = [
  { value: "PLATFORM", label: "Platform Fee" },
  { value: "GAME", label: "Game Fee" },
  { value: "PROMOTION", label: "Promotion Charge" },
  { value: "OTHER", label: "Other Charge" },
];

// Single global platform fee — non-editable identity fields are fixed so the
// admin only sets the percentage and active state.
const FIXED_CODE = "PLATFORM_BASE";
const FIXED_NAME = "Platform Fee";
const FIXED_REASON = "Platform fee on GGR";

const EMPTY_FORM: PlatformFeePayload = {
  code: FIXED_CODE,
  name: FIXED_NAME,
  feeType: "PLATFORM",
  percent: 0,
  appliesTo: undefined,
  reason: FIXED_REASON,
  isActive: true,
};

export default function PlatformFeeManagementPage() {
  const [fees, setFees] = useState<PlatformFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PlatformFeePayload>(EMPTY_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PlatformFee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      const res = await platformFeeApi.list();
      setFees(res.data || []);
    } catch {
      toast.error("Failed to load platform fees");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    getAdminCategories()
      .then((cats) => setCategories(cats.filter((c) => c.isActive)))
      .catch(() => setCategories([]));
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (fee: PlatformFee) => {
    setEditId(fee.id);
    setForm({
      code: fee.code,
      name: fee.name,
      feeType: fee.feeType,
      percent: Number(fee.percent),
      appliesTo: undefined,
      reason: fee.reason || FIXED_REASON,
      isActive: fee.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!(form.percent >= 0 && form.percent <= 100)) {
      toast.error("Percent must be between 0 and 100");
      return;
    }
    try {
      setIsSaving(true);
      // Single global fee: identity fields are fixed; admin controls only the
      // percentage and active state.
      const payload: PlatformFeePayload = {
        ...form,
        code: editId ? form.code : FIXED_CODE,
        name: FIXED_NAME,
        feeType: "PLATFORM",
        appliesTo: undefined,
        reason: FIXED_REASON,
      };
      if (editId) {
        await platformFeeApi.update(editId, payload);
        toast.success("Fee updated — applies to new commissions immediately");
      } else {
        await platformFeeApi.create(payload);
        toast.success("Fee created — applies to new commissions immediately");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save fee");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (fee: PlatformFee) => {
    try {
      await platformFeeApi.update(fee.id, { isActive: !fee.isActive });
      setFees((prev) =>
        prev.map((f) => (f.id === fee.id ? { ...f, isActive: !f.isActive } : f)),
      );
    } catch {
      toast.error("Failed to update fee status");
    }
  };

  const confirmDelete = async () => {
    const fee = deleteTarget;
    if (!fee) return;
    try {
      setIsDeleting(true);
      await platformFeeApi.remove(fee.id);
      toast.success("Fee deleted");
      setFees((prev) => prev.filter((f) => f.id !== fee.id));
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete fee");
    } finally {
      setIsDeleting(false);
    }
  };

  const activeTotal = fees
    .filter((f) => f.isActive && !f.appliesTo)
    .reduce((s, f) => s + Number(f.percent), 0);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
        <div>
          <h1 className="text-white text-lg font-bold sm:text-xl">
            Dashboard / Platform Fee Management
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            A single platform fee, charged as a percentage of GGR and deducted from
            agent and sub-agent commissions automatically, with a per-earning
            breakdown visible to them.
          </p>
        </div>
        {/* Only ONE platform fee is allowed — hide Add once it exists. */}
        {fees.length === 0 && (
          <Button
            onClick={openCreate}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
          >
            <Plus size={16} className="mr-2" /> Add Fee
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-[#15181E] p-4 text-xs text-gray-400">
        Platform fee:{" "}
        <span className="text-purple-400 font-bold">{activeTotal.toFixed(1)}%</span>{" "}
        of GGR (house result), deducted from each commission. Capped at the
        commission so a payout never goes below 0.
      </div>

      {/* Card view rather than a table: there is only ever one platform fee, so
          seven header columns across an empty page said less than a single card
          does. */}
      {isLoading ? (
        <div className="rounded-xl border border-white/10 bg-[#15181E] py-16 text-center">
          <Loader2 className="animate-spin text-purple-500 inline" size={28} />
        </div>
      ) : fees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#15181E] py-16 text-center text-gray-500 text-sm">
          No platform fees configured. Commissions are paid at full rate.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fees.map((fee) => (
            <div
              key={fee.id}
              className={`rounded-xl border bg-[#191D24] p-4 md:p-5 transition-colors ${
                fee.isActive
                  ? "border-purple-500/40"
                  : "border-white/10 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{fee.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono truncate">
                    {fee.code}
                  </p>
                </div>
                {/* The switch is the card's status indicator as well as its
                    control — no separate badge needed. */}
                <Switch
                  checked={fee.isActive}
                  onCheckedChange={() => handleToggleActive(fee)}
                  className="shrink-0 data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                />
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-purple-400 text-3xl font-bold leading-none">
                  {Number(fee.percent).toFixed(1)}%
                </span>
                <span className="text-[11px] text-gray-500">of GGR</span>
              </div>

              <dl className="mt-4 space-y-2 border-t border-white/5 pt-4 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="text-gray-300 text-right">
                    {FEE_TYPES.find((t) => t.value === fee.feeType)?.label ||
                      fee.feeType}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-gray-500">Scope</dt>
                  <dd className="text-gray-300 text-right">
                    {fee.appliesTo || (
                      <span className="text-gray-600">All rounds</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-gray-500 shrink-0">Reason</dt>
                  <dd className="text-gray-400 text-right break-words">
                    {fee.reason || "—"}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/5 pt-3">
                <button
                  onClick={() => openEdit(fee)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(fee)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 md:p-0">
          <div className="w-full max-w-lg bg-[#15181E] rounded-xl border border-gray-800 shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-gray-800">
              <h2 className="text-white text-lg font-medium">
                {editId ? "Edit Platform Fee" : "Add Platform Fee"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4 md:px-6 space-y-4 text-sm">
              <div className="space-y-1">
                <Label className="text-white text-xs">Percent* (of GGR)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.percent || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, percent: parseFloat(e.target.value) || 0 }))
                    }
                    placeholder="10"
                    className="bg-[#191D24] border-gray-800 text-white text-xs h-10 pr-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Percent
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <Label className="text-white text-xs">Active</Label>
                <Switch
                  checked={form.isActive ?? true}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))}
                  className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-4 py-4 md:px-6 border-t border-gray-800">
              <Button
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-800"
                onClick={() => setModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={14} /> Saving...
                  </>
                ) : editId ? (
                  "Update Fee"
                ) : (
                  "Create Fee"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#15181E] rounded-2xl border border-gray-800 shadow-2xl p-4 md:p-6 space-y-4">
            <h2 className="text-white text-lg font-bold">Delete platform fee?</h2>
            <p className="text-gray-400 text-sm">
              Delete{" "}
              <span className="text-white font-medium">{deleteTarget.name}</span>?
              New commissions will be paid at full rate. Past deductions keep their
              recorded breakdowns. This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <Button
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-800"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={14} /> Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
