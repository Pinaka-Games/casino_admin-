"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const [gotoPage, setGotoPage] = React.useState("");

  if (totalPages < 1) return null;

  /**
   * `delta` is how many pages to show either side of the current one.
   *
   * Two on desktop, as before. Zero on a phone: eleven buttons plus the jump
   * field could not fit 390px, so the row wrapped and the pager became two
   * lines. First, current and last still reach everywhere, and the jump field
   * covers the rest.
   */
  const getPages = (delta: number) => {
    const pages: (number | string)[] = [];

    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);

    if (left > 2) pages.push("...");

    for (let i = left; i <= right; i++) {
      pages.push(i);
    }

    if (right < totalPages - 1) pages.push("...");

    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  // One row on a phone (the short page set below keeps it narrow enough);
  // `flex-wrap` from `sm` up so a cramped desktop footer wraps the pager as a
  // whole rather than crushing its children.
  //
  // On a phone the row spans its container — arrows and pages on the left,
  // "Go to" on the right. Centred as one clump it floated with dead space on
  // both sides, and inside a `justify-end` footer it hugged the right edge.
  return (
    <div className="flex w-full flex-nowrap items-center justify-between gap-1.5 text-white text-sm bg-[#191D24] rounded-lg sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2">

      {/* Groups the arrows and pages on a phone; `sm:contents` dissolves it so
          the desktop row is laid out exactly as before. */}
      <div className="flex items-center gap-1.5 sm:contents">

      {/* PREV */}
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="p-2 disabled:opacity-40"
      >
        <ChevronLeft size={18} />
      </button>

      {/* PAGE NUMBERS — the same markup twice, differing only in how many
          pages each set lists, so one row can fit a phone and the other keeps
          the desktop pager unchanged. */}
      {[
        { delta: 0, className: "flex items-center gap-1.5 sm:hidden" },
        { delta: 2, className: "hidden items-center gap-2 sm:flex" },
      ].map((set) => (
        <div key={set.delta} className={set.className}>
          {getPages(set.delta).map((page, i) =>
            page === "..." ? (
              <span key={i} className="px-1 text-gray-400 sm:px-2">
                ...
              </span>
            ) : (
              <button
                key={i}
                onClick={() => onPageChange(Number(page))}
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  currentPage === page
                    ? "bg-purple-500 text-white"
                    : "hover:bg-[#242B35]"
                }`}
              >
                {page}
              </button>
            ),
          )}
        </div>
      ))}

      {/* NEXT */}
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="p-2 disabled:opacity-40"
      >
        <ChevronRight size={18} />
      </button>

      </div>

      {/* GO TO */}
      {/* Shown at every width. Trimmed on phones so it sits on the same row as
          the page buttons instead of forcing a second one. */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 sm:mr-2">
        {/* Two words in a squeezed flex row broke onto separate lines and made
            the whole pager two rows tall. */}
        <span className="whitespace-nowrap text-xs sm:text-sm">Go to</span>
        <input
          value={gotoPage}
          onChange={(e) => setGotoPage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const page = Number(gotoPage);
              if (page >= 1 && page <= totalPages) {
                onPageChange(page);
              }
              setGotoPage("");
            }
          }}
          className="w-10 sm:w-12 h-7 sm:h-6 shrink-0 text-center text-xs sm:text-sm bg-[#242B35] border border-gray-700 rounded"
        />
      </div>
    </div>
  );
}