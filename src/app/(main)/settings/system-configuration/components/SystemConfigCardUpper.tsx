"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SystemConfigCardUpperProps {
  title: string;
  label: string;
  description?: string;
  value: string | number;
  placeholder?: string;
  type?: "text" | "number" | "time";
  onChange: (value: string) => void;
  onSave: () => void;
}

export default function SystemConfigCardUpperUpper({
  title,
  label,
  description,
  value,
  placeholder,
  type = "text",
  onChange,
  onSave,
}: SystemConfigCardUpperProps) {
  return (
    <div className="bg-[#191D24] rounded-xl p-4 flex flex-col h-[200px]">
      {/* TOP CONTENT */}
      <div className="space-y-4 flex-1">
        {/* Title */}
        <h3 className="text-white text-sm font-semibold">{title}</h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
        )}

        {/* Input */}
        <div className="space-y-2">
          <Label className="text-xs text-white">{label}</Label>

          <input
            className="
              w-full 
              bg-[#242B35] 
              border 
              border-[#2C323D] 
              rounded-lg 
              px-3 
              py-2 
              text-sm 
              text-white 
              placeholder:text-gray-500 
              focus:outline-none 
              focus:ring-2 
              focus:ring-purple-500
            "
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>

      {/* SAVE BUTTON — ALWAYS BOTTOM */}
      <div className="pt-3 mt-auto flex justify-end">
        <Button
          onClick={onSave}
          className="bg-purple-500 text-white hover:bg-purple-600 text-sm"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
