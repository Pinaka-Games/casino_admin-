import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  roleName: string;
}

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  roleName,
}: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    try {
      setDeleting(true);
      await onConfirm();          // ✅ wait for API
      onOpenChange(false);        // ✅ close only after success
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (deleting) return;      // ✅ prevent close while deleting
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="bg-[#15181E] text-white border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">
            Delete Role
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-gray-300 text-sm">
            Are you sure you want to delete the role{" "}
            <span className="text-white font-semibold">
              "{roleName}"
            </span>
            ? This action cannot be undone.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="bg-[#4A5568] hover:bg-[#5A6578] text-white px-6"
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white px-6"
          >
            {deleting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
