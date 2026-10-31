"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const CONFIRM_WORD = "SEED";

interface ConfirmSeedDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** e.g. "Seed default FAQs?" */
  title: string;
  /** One-line summary of what the seed does. */
  description: ReactNode;
  /** What happens to data, one fact per bullet. */
  effects?: ReactNode[];
  /** Closing line under the bullets, e.g. "Nothing existing is changed." */
  note?: ReactNode;
  /**
   * The seed overwrites or deletes existing data. Styles the dialog as a
   * warning and requires typing SEED, so one misclick on a live environment
   * cannot wipe admin-tuned config.
   */
  destructive?: boolean;
  confirmLabel?: string;
}

/**
 * Shared guard in front of every admin "seed defaults" button. Seeds write
 * straight to the database of whichever environment the admin is signed in to,
 * so none of them run on a single click.
 */
export default function ConfirmSeedDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  effects = [],
  note,
  destructive = false,
  confirmLabel = "Seed defaults",
}: ConfirmSeedDialogProps) {
  const [typed, setTyped] = useState("");

  // Start empty every time, so a previous confirmation never pre-arms it.
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const armed = !destructive || typed.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent className="bg-[#15181E] border border-[#2a2f3a] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle
              className={`h-5 w-5 ${destructive ? "text-red-400" : "text-amber-400"}`}
            />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-gray-400">
              <p>{description}</p>
              {effects.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {effects.map((effect, index) => (
                    <li key={index}>{effect}</li>
                  ))}
                </ul>
              )}
              {note && (
                <p className={destructive ? "text-red-400" : "text-amber-400"}>{note}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {destructive && (
          <div className="space-y-2">
            <label htmlFor="confirm-seed" className="text-sm text-gray-300">
              Type <span className="font-mono font-semibold text-white">{CONFIRM_WORD}</span> to
              confirm
            </label>
            <input
              id="confirm-seed"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && armed) onConfirm();
              }}
              autoComplete="off"
              autoFocus
              className="w-full rounded-md border border-gray-700 bg-[#1a2030] px-3 py-2 text-sm text-white outline-none focus:border-red-500"
            />
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" className="border-gray-600 text-white" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className={
              destructive
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }
            disabled={!armed}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
