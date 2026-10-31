"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Announcement } from "@/types/announcement";
import {
  AlertDialogDescription,
  AlertDialogTitle,
} from "@radix-ui/react-alert-dialog";

export function DeleteAnnouncementDialog({
  open,
  onOpenChange,
  announcement,
  onConfirm,
}: any) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#101318] border-none text-white p-6 rounded-lg shadow-xl">
        {/* HEADER */}
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg font-semibold">
            Confirm Remove &quot;{announcement?.title}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400 text-xs leading-relaxed">
            You are about to permanently delete the announcement
            <span className="text-red-400 font-medium">
              {" "}
              &quot;{announcement?.title}&quot;
            </span>
            .
            <br />
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-4 gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-[#B93DEB]" onClick={onConfirm}>
            Confirm
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}