"use client";

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
import { CashBundle } from "@/types/cashbundletypes";

interface DeleteBundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: CashBundle | null;
  onConfirm: () => Promise<void> | void;
}

export function DeleteBundleDialog({
  open,
  onOpenChange,
  bundle,
  onConfirm,
}: DeleteBundleDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#101318] border-none text-white p-6 rounded-lg shadow-xl">
        {/* HEADER */}
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg font-semibold">
            Confirm Remove Cash Bundle?
          </AlertDialogTitle>

          <AlertDialogDescription className="text-gray-400 text-xs leading-relaxed">
            You are about to permanently delete the cash bundle
            <span className="text-red-400 font-medium">
              {" "}
              ({bundle?.coins.toLocaleString()} coins)
            </span>.
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* FOOTER */}
        <AlertDialogFooter className="pt-4 gap-3">
          <AlertDialogCancel className="bg-[#4A5568] hover:bg-[#5A6578] text-white border-none rounded-md px-6">
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={onConfirm}
            className="bg-[#B93DEB] hover:text-black text-white border-none rounded-md px-6"
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
