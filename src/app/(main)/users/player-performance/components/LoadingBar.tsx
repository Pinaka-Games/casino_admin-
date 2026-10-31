"use client";

/**
 * Thin indeterminate bar pinned to the top of the page's scroll area. It is
 * always 2px tall, so showing it never shifts the layout under the cursor.
 */
export default function LoadingBar({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none sticky top-0 z-40 h-0.5 w-full overflow-hidden"
    >
      {/* `shimmer` keyframes come from globals.css; reduced motion keeps a still bar. */}
      <div
        className={`h-full w-full bg-linear-to-r from-transparent via-[#B93DEB] to-transparent transition-opacity duration-300 ${
          active ? "opacity-100 motion-safe:animate-[shimmer_1.2s_ease-in-out_infinite]" : "opacity-0"
        }`}
      />
    </div>
  );
}
