"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIENCE_OPTIONS,
  updateModal,
  type AdminModal,
  type ModalAudience,
} from "@/api/modals/modal.api";

export default function ModalConfigDialog({
  modal,
  open,
  onClose,
  onSaved,
}: {
  modal: AdminModal | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: AdminModal) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<ModalAudience>("authenticated");
  const [delaySeconds, setDelaySeconds] = useState<number>(10);
  const [saving, setSaving] = useState(false);

  // Reset form whenever a different modal is opened for editing.
  useEffect(() => {
    if (!modal) return;
    setTitle(modal.title ?? "");
    setDescription(modal.description ?? "");
    setAudience(modal.audience);
    setDelaySeconds(modal.delaySeconds);
  }, [modal]);

  const handleSave = async () => {
    if (!modal) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const delay = Number.isFinite(delaySeconds) && delaySeconds >= 0 ? Math.round(delaySeconds) : 0;
    setSaving(true);
    try {
      const updated = await updateModal(modal.id, {
        title: title.trim(),
        description: description.trim(),
        audience,
        delaySeconds: delay,
      });
      toast.success("Modal updated");
      onSaved(updated);
      onClose();
    } catch {
      toast.error("Failed to update modal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#191D24] border border-gray-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Configure modal</DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage how this existing modal behaves. Content is managed by its own feature.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-300">Display name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Welcome Bonus"
              className="bg-[#15181E] border-gray-700 text-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-300">Description (admin note)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="bg-[#15181E] border-gray-700 text-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-300">Visible to</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as ModalAudience)}>
              <SelectTrigger className="bg-[#15181E] border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#191D24] border-gray-700 text-white">
                {AUDIENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="focus:bg-[#B93DEB]/20">
                    <span className="font-medium">{o.label}</span>
                    <span className="ml-2 text-xs text-gray-500">{o.hint}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-300">Delay before showing (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={Number.isNaN(delaySeconds) ? "" : delaySeconds}
              onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10))}
              className="bg-[#15181E] border-gray-700 text-white"
            />
            <p className="text-[11px] text-gray-500">
              Wait this long after the previous modal is closed before showing this one.
            </p>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#a32cd4] disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
