"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

/* =========================
   TYPES
========================= */
export interface PaymentChannel {
  id?: number;
  type: string;
  destination: string;
  destinationInfo: string;
  receiveCurrency: string;
  minDeposit: number;
  maxDeposit: number;
  attachment?: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentChannel & { attachmentFile?: File | null }) => void;
  initialData?: PaymentChannel | null;
}

/* =========================
   COMPONENT
========================= */
export default function PaymentChannelModal({
  open,
  onClose,
  onSubmit,
  initialData,
}: Props) {
  const [formData, setFormData] = useState<PaymentChannel>({
    type: "",
    destination: "",
    destinationInfo: "",
    receiveCurrency: "",
    minDeposit: 0,
    maxDeposit: 0,
    attachment: "",
    isActive: true,
  });

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    null
  );

  /* CREATE vs EDIT */
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setAttachmentPreview(initialData.attachment || null);
      setAttachmentFile(null);
    } else {
      setFormData({
        type: "",
        destination: "",
        destinationInfo: "",
        receiveCurrency: "",
        minDeposit: 0,
        maxDeposit: 0,
        attachment: "",
        isActive: true,
      });
      setAttachmentPreview(null);
      setAttachmentFile(null);
    }
  }, [initialData]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-4xl rounded-xl bg-[#15181E] p-6 relative">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-medium">
            {initialData ? "Edit Payment Channel" : "Create new"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* FORM */}
        <div className="grid grid-cols-2 gap-6">
          {/* PAYMENT CHANNEL */}
          <div>
            <Label className="text-white text-sm">Payment Channel</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData((p) => ({ ...p, type: value }))
              }
            >
              <SelectTrigger className="h-10 mt-1 bg-[#242B35] w-full border border-[#3b414d] text-white">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] border border-[#3b414d] text-white">
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Crypto">Crypto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* DESTINATION */}
          <div>
            <Label className="text-white text-sm">Destination</Label>
            <input
              value={formData.destination}
              onChange={(e) =>
                setFormData((p) => ({ ...p, destination: e.target.value }))
              }
              className="w-full h-10 mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm"
            />
          </div>

          {/* DESTINATION INFO */}
          <div>
            <Label className="text-white text-sm">Destination Info</Label>
            <input
              value={formData.destinationInfo}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  destinationInfo: e.target.value,
                }))
              }
              className="w-full h-10 mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm"
            />
          </div>

          {/* RECEIVE CURRENCY */}
          <div>
            <Label className="text-white text-sm">Receive Currency</Label>
            <Select
              value={formData.receiveCurrency}
              onValueChange={(value) =>
                setFormData((p) => ({ ...p, receiveCurrency: value }))
              }
            >
              <SelectTrigger className="h-10 mt-1 bg-[#242B35] w-full border border-[#3b414d] text-white">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] border border-[#3b414d] text-white">
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* MIN DEPOSIT */}
          <div>
            <Label className="text-white text-sm">Minimum Deposit</Label>
            <input
              type="number"
              value={formData.minDeposit}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  minDeposit: Number(e.target.value),
                }))
              }
              className="w-full h-10 mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm"
            />
          </div>

          {/* MAX DEPOSIT */}
          <div>
            <Label className="text-white text-sm">Maximum Deposit</Label>
            <input
              type="number"
              value={formData.maxDeposit}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  maxDeposit: Number(e.target.value),
                }))
              }
              className="w-full h-10 mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm"
            />
          </div>

          {/* IS ACTIVE */}
          <div className="flex items-center gap-3 mt-6">
            <Label className="text-white text-sm">Is Active</Label>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData((p) => ({ ...p, isActive: checked }))
              }
              className="
                data-[state=checked]:bg-[#B93DEB]
                data-[state=unchecked]:bg-gray-600
              "
            />
          </div>

          {/* ATTACHMENT */}
          <div>
            <Label className="text-white text-sm">Attachment</Label>
            <div className="mt-2">
              <label
                htmlFor="attachment"
                className="flex items-center justify-center w-32 h-32 bg-[#242B35] border border-[#3b414d] rounded-lg cursor-pointer overflow-hidden"
              >
                {attachmentPreview ? (
                  <Image
                    src={attachmentPreview}
                    alt="Attachment"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-400">Upload</span>
                )}
              </label>

              <input
                id="attachment"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setAttachmentFile(file);
                  setAttachmentPreview(URL.createObjectURL(file));
                }}
              />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 mt-8">
          <Button variant="outline" className="border-gray-600" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-purple-500 text-white hover:bg-purple-600"
            onClick={() =>
              onSubmit({
                ...formData,
                attachmentFile,
              })
            }
          >
            {initialData ? "Update" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
