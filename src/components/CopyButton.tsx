"use client";

import { Copy } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Small inline copy-to-clipboard button. Drop it next to an id/email/code cell:
 * `<span>{value}</span><CopyButton value={value} />`. Renders nothing for empty
 * / placeholder values.
 */
export default function CopyButton({
  value,
  size = 13,
  className,
}: {
  value?: string | number | null;
  size?: number;
  className?: string;
}) {
  const text = value == null ? "" : String(value).trim();
  if (!text || ["n/a", "—", "-", "---", "--"].includes(text.toLowerCase())) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        toast.success("Copied");
      }}
      title="Copy"
      className={`shrink-0 text-gray-500 hover:text-purple-400 transition-colors ${className ?? ""}`}
    >
      <Copy size={size} />
    </button>
  );
}
