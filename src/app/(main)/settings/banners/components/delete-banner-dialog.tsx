"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialogDescription,
  AlertDialogTitle,
} from "@radix-ui/react-alert-dialog";
import { Banner } from "@/types/banner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner?: Banner | null;
  onConfirm: () => void;
}

export function DeleteBannerDialog({
  open,
  onOpenChange,
  banner,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#101318] border-none text-white p-6 rounded-lg shadow-xl">

        {/* HEADER */}
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg font-semibold">
            Confirm Remove Banner?
          </AlertDialogTitle>

          <AlertDialogDescription className="text-gray-400 text-xs leading-relaxed mt-2">
            You are about to permanently delete
            <span className="text-red-400 font-medium">
              {" "}
              "{banner?.titleEn}"
            </span>.
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* ACTIONS */}
        <AlertDialogFooter className="mt-4 gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            className="bg-[#B93DEB]"
            onClick={onConfirm}
          >
            Confirm
          </Button>
        </AlertDialogFooter>

      </AlertDialogContent>
    </AlertDialog>
  );
}