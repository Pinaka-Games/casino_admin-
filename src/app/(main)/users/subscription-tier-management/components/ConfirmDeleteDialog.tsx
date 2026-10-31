"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  fileName?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDeleteDialog({
  open,
  fileName,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onConfirm(); // main page logic stays untouched
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isDeleting ? () => {} : onCancel}>
      <DialogContent className="bg-[#15181E] border border-[#2a2f3a]">
        <DialogHeader>
          <DialogTitle className="text-white text-lg font-medium">
            Confirm delete
          </DialogTitle>

          <p className="text-md text-gray-400 mt-2">
            Are you sure you want to delete{" "}
            <span className="text-white">{fileName ?? "this file"}</span>?
          </p>
        </DialogHeader>
        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            className="border-gray-600 text-white"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            className="bg-red-500 text-white hover:bg-red-600 flex items-center gap-2"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
