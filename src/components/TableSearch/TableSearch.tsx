"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Table } from "@tanstack/react-table";

interface TableSearchProps<TData> {
  table: Table<TData>;
  columnKey: string;
  placeholder?: string;
  showButton?: boolean;
}

export function TableSearch<TData>({
  table,
  columnKey,
  placeholder = "Search...",
  showButton = true,
}: TableSearchProps<TData>) {
  const column = table.getColumn(columnKey);

  const [value, setValue] = useState("");

  useEffect(() => {
    const filterValue = column?.getFilterValue();
    setValue((filterValue as string) ?? "");
  }, [column]);

  if (!column) return null;

  return (
    <div className="flex items-center gap-3 w-full">
      {/* INPUT */}
      <div className="flex-1">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            const val = e.target.value;
            setValue(val);                 
            column.setFilterValue(val); 
          }}
          className="bg-[#242B35]! text-white placeholder:text-gray-500 text-sm pl-4"
        />
      </div>

      {/* SEARCH BUTTON */}
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
