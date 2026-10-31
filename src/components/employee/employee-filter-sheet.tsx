"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface EmployeeFilters {
  username: string;
  email: string;
  role: string;
  status: "all" | "active" | "inactive";
  loginState: "all" | "last_1_day" | "last_1_week" | "never_login";
}

interface EmployeeFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: EmployeeFilters;
  onApply: (filters: EmployeeFilters) => void;
  roleOptions: string[];
}

const DEFAULT_FILTERS: EmployeeFilters = {
  username: "",
  email: "",
  role: "all",
  status: "all",
  loginState: "all",
};

export function EmployeeFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  roleOptions,
}: EmployeeFilterSheetProps) {
  const [draftFilters, setDraftFilters] = React.useState<EmployeeFilters>(filters);

  React.useEffect(() => {
    if (open) {
      setDraftFilters(filters);
    }
  }, [filters, open]);

  const handleReset = () => {
    setDraftFilters(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
  };

  const handleApply = () => {
    onApply(draftFilters);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px]"
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">Employee Filters</SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Filter employees by required fields
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Role</Label>
            <Select
              value={draftFilters.role}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, role: value }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All Roles</SelectItem>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Status</Label>
            <Select
              value={draftFilters.status}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  status: value as EmployeeFilters["status"],
                }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Last Login</Label>
            <Select
              value={draftFilters.loginState}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  loginState: value as EmployeeFilters["loginState"],
                }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="last_1_day">Last 1 Day</SelectItem>
                <SelectItem value="last_1_week">Last 1 Week</SelectItem>
                <SelectItem value="never_login">Never Logged In</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-gray-700 space-y-3">
          <Button
            type="button"
            onClick={handleApply}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white"
          >
            Apply Filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="w-full bg-[#2A3240] border-gray-700 text-white hover:bg-[#313B4A]"
          >
            Reset Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
