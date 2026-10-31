"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth-store";

interface Props {
  open: boolean;
  type: "username" | "name" | "email" | null;
  initialValue: string;
  onClose: () => void;
  onUpdate: (value: string) => void;
}

export default function EditProfileModal({
  open,
  type,
  initialValue,
  onClose,
  onUpdate,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const { isLoading } =
    useAuthStore();

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (!type) return null;

  const trimmedValue = value.trim();
  const isSame = trimmedValue === initialValue;
  const isInvalid = !trimmedValue || isSame;

  const handleUpdate = () => {
    if (!trimmedValue) {
      toast.error(`${type} cannot be empty`);
      return;
    }

    if (type === "email" && !/\S+@\S+\.\S+/.test(trimmedValue)) {
      toast.error("Invalid email address");
      return;
    }

    onUpdate(trimmedValue);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#15181E] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">
            Update {type}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs text-white capitalize">
            {type}
          </Label>

          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-[#242B35] border-none text-white"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="bg-gray-600 text-white hover:bg-gray-500"
          >
            Cancel
          </Button>

          <Button
            onClick={handleUpdate}
            disabled={isInvalid || isLoading}
            className="bg-[#B93DEB] text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {isLoading ? "Updating..." : "Update"}
          </Button>


        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
