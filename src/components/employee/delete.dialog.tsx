"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Employee } from "@/types/employee";
import { Loader2 } from "lucide-react";

interface DeleteDialogProps { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onConfirm: () => Promise<void>;
}

export function DeleteDialog({
  open,
  onOpenChange,
  employee,
  onConfirm,
}: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // ✅ prevent auto close
    if (deleting) return;

    try {
      setDeleting(true);
      await onConfirm();        // ✅ wait API
      onOpenChange(false);      // ✅ close after success
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (deleting) return;   // ✅ prevent close while deleting
        onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className="bg-[#15181E] border-none text-white p-6 rounded-lg shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg font-semibold">
            Delete Employee?
          </AlertDialogTitle>

          <AlertDialogDescription className="text-gray-400 text-sm leading-relaxed">
            You are about to permanently delete
            <span className="text-red-400 font-medium">
              {" "}
              {employee?.username} ({employee?.email})
            </span>
            .
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="pt-4 gap-3">
          <AlertDialogCancel
            disabled={deleting}
            className="bg-[#4A5568] hover:bg-[#5A6578] text-white border-none rounded-md px-6"
          >
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-500/70 text-white border-none rounded-md px-6"
          >
            {deleting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
