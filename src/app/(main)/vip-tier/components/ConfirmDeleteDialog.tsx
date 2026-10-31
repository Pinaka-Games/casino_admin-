"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

interface ConfirmDeleteDialogProps {
  open: boolean;
  fileName?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  /**
   * Set false when the caller talks to an API and reports the real outcome
   * itself — otherwise a failed delete still shows "Deleted successfully".
   */
  showResultToast?: boolean;
}

export default function ConfirmDeleteDialog({
  open,
  fileName,
  onCancel,
  onConfirm,
  showResultToast = true,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
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
            onClick={() => {
              onCancel();
              toast.error("Action cancelled");
            }}
          >
            Cancel
          </Button>

          <Button
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={async () => {
              await onConfirm();
              if (showResultToast) toast.success("Deleted successfully");
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
