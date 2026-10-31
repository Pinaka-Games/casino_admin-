"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";

/* =========================
   TYPES
========================= */
export interface GameFormData {
  id?: string;
  name: string;
  gameCode: string;
  totalPlaying: string;
  sequence: string;
  isNew: boolean;
  isHot: boolean;
  isRecommend: boolean;
  isLobby: boolean;
  isActive: boolean;
  category?: string;
  image?: File | null;
  icon?: File | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: GameFormData) => void;
  initialData?: GameFormData | null;
}

/* =========================
   COMPONENT
========================= */
export default function CreateEditGameModal({
  open,
  onClose,
  onSubmit,
  initialData,
}: Props) {
  const imageRef = useRef<ImageUploaderRef>(null);
  const iconRef = useRef<ImageUploaderRef>(null);

  const [formData, setFormData] = useState<GameFormData>({
    name: "",
    gameCode: "",
    totalPlaying: "",
    sequence: "",
    isNew: false,
    isHot: false,
    isRecommend: false,
    isLobby: false,
    isActive: true,
    image: null,
    icon: null,
  });

  /* CREATE vs EDIT (SAME PATTERN YOU USE) */
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: "",
        gameCode: "",
        totalPlaying: "",
        sequence: "",
        isNew: false,
        isHot: false,
        isRecommend: false,
        isLobby: false,
        isActive: true,
        image: null,
        icon: null,
      });
    }
  }, [initialData]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-6xl rounded-xl bg-[#15181E] p-6 relative text-white">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">
            {initialData ? "Edit Game" : "Create new"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* LANGUAGE TABS (UI ONLY) */}
        <div className="flex gap-6 text-sm mb-4 border-b border-gray-700 pb-2">
          <span className="text-white cursor-pointer">
            Simplified Chinese
          </span>
          <span className="text-gray-400 cursor-pointer">
            Traditional Chinese
          </span>
        </div>

        {/* FORM */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData((p) => ({ ...p, name: e.target.value }))
              }
              className="bg-[#242B35]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Game Code</Label>
            <Input
              value={formData.gameCode}
              onChange={(e) =>
                setFormData((p) => ({ ...p, gameCode: e.target.value }))
              }
              className="bg-[#242B35]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Total Playing</Label>
            <Input
              value={formData.totalPlaying}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  totalPlaying: e.target.value,
                }))
              }
              className="bg-[#242B35]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Sequence</Label>
            <Input
              value={formData.sequence}
              onChange={(e) =>
                setFormData((p) => ({ ...p, sequence: e.target.value }))
              }
              className="bg-[#242B35]"
            />
          </div>

          {/* SWITCHES */}
          <SwitchRow
            label="Is New"
            value={formData.isNew}
            onChange={(v) =>
              setFormData((p) => ({ ...p, isNew: v }))
            }
          />
          <SwitchRow
            label="Is Hot"
            value={formData.isHot}
            onChange={(v) =>
              setFormData((p) => ({ ...p, isHot: v }))
            }
          />
          <SwitchRow
            label="Is Recommend"
            value={formData.isRecommend}
            onChange={(v) =>
              setFormData((p) => ({ ...p, isRecommend: v }))
            }
          />
          <SwitchRow
            label="Is Lobby"
            value={formData.isLobby}
            onChange={(v) =>
              setFormData((p) => ({ ...p, isLobby: v }))
            }
          />
          <SwitchRow
            label="Is Active"
            value={formData.isActive}
            onChange={(v) =>
              setFormData((p) => ({ ...p, isActive: v }))
            }
          />

          {/* IMAGE UPLOADS */}
          <ImageBlock
            label="Image"
            file={formData.image}
            onUpload={() => imageRef.current?.open()}
            onRemove={() =>
              setFormData((p) => ({ ...p, image: null }))
            }
          />

          <ImageBlock
            label="Icon"
            file={formData.icon}
            onUpload={() => iconRef.current?.open()}
            onRemove={() =>
              setFormData((p) => ({ ...p, icon: null }))
            }
          />
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-700"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            className="bg-purple-500 text-white hover:bg-purple-600"
            onClick={() => onSubmit(formData)}
          >
            {initialData ? "Update" : "Create"}
          </Button>
        </div>


        {/* UPLOADERS */}
        <ImageUploader
          ref={imageRef}
          aspect={1}
          onChange={(file) =>
            setFormData((p) => ({ ...p, image: file }))
          }
        />
        <ImageUploader
          ref={iconRef}
          aspect={1}
          onChange={(file) =>
            setFormData((p) => ({ ...p, icon: file }))
          }
        />
      </div>
    </div>
  );
}

/* =========================
   SMALL COMPONENTS
========================= */

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <Label className="w-32">{label}</Label>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        className="
          data-[state=checked]:bg-[#B93DEB]
          data-[state=unchecked]:bg-gray-600
        "
      />
    </div>
  );
}

function ImageBlock({
  label,
  file,
  onUpload,
  onRemove,
}: {
  label: string;
  file?: File | null;
  onUpload: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <Label className="w-32">{label}</Label>
      <Button
        variant="outline"
        className="bg-[#242B35]"
        onClick={onUpload}
      >
        <Upload size={16} className="mr-2" />
        Upload
      </Button>
      {file && (
        <div className="flex items-center gap-2 text-xs">
          <span>{file.name}</span>
          <Trash2
            size={14}
            className="cursor-pointer text-red-400"
            onClick={onRemove}
          />
        </div>
      )}
    </div>
  );
}
