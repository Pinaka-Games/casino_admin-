"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ImageUploader from "@/components/image-upload/ImageUploader";

interface TemplateForm {
  title: string;
  contents: string;
  messageTypes: string[]; // kept for API compatibility; always ["general"]
  isActive: boolean;
  imageUrl?: string;
  displayDurationDays: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TemplateForm) => void;
  initialData?: any | null;
}

// Type is no longer a user-facing concept — every template is stored as
// "general" so the backend's messageType stays satisfied.
const DEFAULT_TYPE = "general";

// Small red asterisk for required-field labels.
const Req = () => <span className="text-red-400 ml-0.5">*</span>;

export default function MessageTemplateModal({
  open,
  onClose,
  onSubmit,
  initialData,
}: Props) {
  const [formData, setFormData] = useState<TemplateForm>({
    title: "",
    contents: "",
    messageTypes: [DEFAULT_TYPE],
    isActive: true,
    imageUrl: "",
    displayDurationDays: 1,
  });

  const imageUploaderRef = useRef<any>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title ?? "",
        contents: initialData.contents ?? "",
        messageTypes: [DEFAULT_TYPE],
        isActive: initialData.isActive ?? true,
        imageUrl: initialData.imageUrl ?? "",
        displayDurationDays: initialData.displayDurationDays ?? 1,
      });
    } else {
      setFormData({
        title: "",
        contents: "",
        messageTypes: [DEFAULT_TYPE],
        isActive: true,
        imageUrl: "",
        displayDurationDays: 1,
      });
    }
  }, [initialData, open]);

  const isFormValid = useMemo(() => {
    return (
      !!formData.title.trim() &&
      !!formData.contents.trim() &&
      !!formData.imageUrl &&
      formData.displayDurationDays >= 1
    );
  }, [formData]);

  if (!open) return null;

  // All fields are required — surface the first missing one as a toast.
  const validate = (): boolean => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return false;
    }
    if (!formData.contents.trim()) {
      toast.error("Message is required");
      return false;
    }
    if (!formData.imageUrl) {
      toast.error("Template image is required");
      return false;
    }
    if (!formData.displayDurationDays || formData.displayDurationDays < 1) {
      toast.error("Display duration must be at least 1 day");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto scrollbar-hide rounded-2xl border border-white/10 bg-[#15181E] p-6 relative shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-semibold">
            {initialData ? "Edit Template" : "Create Template"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>

        {/* FORM */}
        <div className="space-y-5">
          {/* TITLE */}
          <div>
            <Label className="text-white text-sm">Title<Req /></Label>
            <input
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              className="w-full h-10 mt-1.5 bg-[#242B35] border border-[#3b414d] rounded-lg px-3 text-white text-sm focus:outline-none focus:border-purple-500/60"
              placeholder="Template title"
            />
          </div>

          {/* CONTENTS */}
          <div>
            <Label className="text-white text-sm">Message<Req /></Label>
            <textarea
              value={formData.contents}
              maxLength={250}
              onChange={(e) => setFormData((p) => ({ ...p, contents: e.target.value }))}
              rows={5}
              className="w-full mt-1.5 bg-[#242B35] border border-[#3b414d] rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-purple-500/60"
              placeholder="Enter message..."
            />
            <div className="flex items-center justify-end mt-1">
              <p className={`text-xs ${formData.contents?.length >= 250 ? "text-red-400" : "text-gray-500"}`}>
                {formData.contents?.length ?? 0}/250
              </p>
            </div>
          </div>

          {/* ACTIVE + DURATION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/5 bg-[#191D24] p-4 space-y-3">
              <Label className="text-white text-xs">Active Status</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))}
                  className="data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-600"
                />
                <span className="text-xs text-white">
                  {formData.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#191D24] p-4 space-y-3">
              <Label className="text-white text-xs">Display Duration (Days)<Req /></Label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={formData.displayDurationDays}
                  onChange={(e) => setFormData((p) => ({ ...p, displayDurationDays: parseInt(e.target.value) || 1 }))}
                  className="w-24 h-10 bg-[#242B35] border border-[#3b414d] rounded-lg px-3 text-white text-sm focus:outline-none focus:border-purple-500/60"
                />
                <span className="text-[10px] text-gray-500 uppercase font-bold">Total Days</span>
              </div>
              <p className="text-[10px] text-gray-500">Auto-hides from user views after this many days.</p>
            </div>
          </div>

          {/* IMAGE UPLOAD */}
          <div className="space-y-3">
            <Label className="text-white text-sm">Template Image<Req /></Label>
            <div className="flex items-center gap-4">
              {formData.imageUrl ? (
                <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-gray-700">
                  <Image src={formData.imageUrl} alt="Preview" fill className="object-cover" unoptimized />
                  <button
                    onClick={() => setFormData((p) => ({ ...p, imageUrl: "" }))}
                    className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => imageUploaderRef.current?.open()}
                  className="w-32 h-20 rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-white hover:border-purple-500 transition-all"
                >
                  <Upload size={20} />
                  <span className="text-[10px] font-medium uppercase">Upload</span>
                </button>
              )}
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Recommended Size</p>
                <p className="text-xs text-gray-400">1200x800px (1.5:1 ratio) for best appearance on user-side pop-ups.</p>
              </div>
            </div>

            <ImageUploader
              ref={imageUploaderRef}
              aspect={1.5}
              folder="message-templates"
              onUploadComplete={(url) => setFormData((p) => ({ ...p, imageUrl: url }))}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 mt-8">
          <Button variant="outline" className="border-gray-600 text-white" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50"
            disabled={!isFormValid}
            onClick={handleSubmit}
          >
            {initialData ? "Update" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
