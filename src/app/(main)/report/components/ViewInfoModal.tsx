"use client";

import React from "react";
import { X } from "lucide-react";

interface InfoItem {
  label: string;
  value: string | number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: InfoItem[];
}

export default function ViewInfoModal({ open, onClose, data }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center">
      {/* MODAL CARD */}
      <div className="relative w-[480px] rounded-xl bg-[#15181E] border border-gray-800 shadow-xl">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white text-base font-medium">
            Information
          </h3>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="px-6 py-5 space-y-4">
          {data.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[160px_1fr] gap-4"
            >
              <span className="text-gray-400 text-sm">
                {item.label}
              </span>

              <span className="text-gray-200 text-sm">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
