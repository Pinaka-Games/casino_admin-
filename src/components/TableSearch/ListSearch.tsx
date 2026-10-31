"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface ListSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showButton?: boolean;
}

export default function ListSearch({
  value,
  onChange,
  placeholder = "Search...",
  showButton = true,
}: ListSearchProps) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm pl-4"
        />
      </div>

      {showButton && (
        <Button
          size="icon"
          type="button"
          className="bg-transparent text-purple-400 border border-[#B93DEB]
                     hover:bg-[#B93DEB] hover:text-white"
        >
          <Search size={20} />
        </Button>
      )}
    </div>
  );
}
