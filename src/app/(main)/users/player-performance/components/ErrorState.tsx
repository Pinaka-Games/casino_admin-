"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-xl border border-red-500/30 bg-red-500/5 px-6 py-12 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
        <AlertTriangle size={20} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">Couldn&apos;t load player performance</p>
        <p className="max-w-md text-sm text-gray-400">{message}</p>
      </div>
      <Button
        type="button"
        onClick={onRetry}
        className="gap-2 bg-purple-500 text-white hover:bg-purple-600"
      >
        <RotateCw size={14} /> Retry
      </Button>
    </div>
  );
}
