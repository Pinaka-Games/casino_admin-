"use client";

import React, { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  date?: Date;
  onChange: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export default function DatePicker({ date, onChange, minDate, maxDate, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const formatDate = (d?: Date) =>
    d ? format(d, "MM/dd/yyyy") : "Select date";

  const handleSelect = (d: Date | undefined) => {
    onChange(d ?? undefined);
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild className="w-full">
          <button
            type="button"
            className={cn(
              "h-9 min-w-0 px-2 rounded-md bg-[#242B35] text-gray-200 border border-[#3b414d] flex items-center gap-2 text-sm transition-all hover:bg-[#2b323b]",
              className?.includes("w-full") && "w-full"
            )}
          >
            <CalendarIcon size={16} className="text-gray-400 shrink-0" />
            <span className="truncate flex-1 text-left">{formatDate(date)}</span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-auto p-0 rounded-lg border border-[#2b323b] bg-[#111418] shadow-xl z-[20000]"
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            disabled={(d) => {
              if (minDate && d < minDate) return true;
              if (maxDate && d > maxDate) return true;
              return false;
            }}
            initialFocus
            className="text-white p-3"
            classNames={{
              months: "flex flex-col text-white",
              month: "space-y-4",
              caption: "flex justify-between items-center text-gray-200 mb-2",
              caption_label: "text-gray-200 font-medium",
              nav_button: "text-gray-400 hover:text-white",
              head_cell: "text-gray-500 pb-2 font-normal text-xs",
              day: "h-9 w-9 flex items-center justify-center rounded-md text-gray-300 hover:bg-[#1f2430] hover:text-white",
              day_today: "border border-purple-500 text-white",
              day_selected:
                "bg-purple-600 text-white hover:bg-purple-700",
              day_outside: "text-gray-600 opacity-40",
            }}
          />
        </PopoverContent>
      </Popover>

    </div>
  );
}
