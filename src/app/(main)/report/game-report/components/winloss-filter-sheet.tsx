"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import DatePicker from "@/components/DatePicker";

export interface WinLossFilters {
    provider: string;
    category: string;
    status: string;
    startDate?: Date;
    endDate?: Date;
}

interface WinLossFilterSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: WinLossFilters;
    onApply: (filters: WinLossFilters) => void;
    providerOptions: string[];
    categoryOptions: string[];
}

const DEFAULT_FILTERS: WinLossFilters = {
    provider: "all",
    category: "all",
    status: "all",
    startDate: undefined,
    endDate: undefined,
};

export function WinLossFilterSheet({
    open,
    onOpenChange,
    filters,
    onApply,
    providerOptions,
    categoryOptions,
}: WinLossFilterSheetProps) {
    const [draftFilters, setDraftFilters] = React.useState<WinLossFilters>(filters);

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
                className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px] flex flex-col h-full p-0"
            >
                <SheetHeader className="p-4 border-b border-gray-700">
                    <SheetTitle className="text-lg text-white font-normal">Game Report Filters</SheetTitle>
                    <SheetDescription className="text-sm text-gray-400">
                        Narrow down your game report results.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* DATE RANGE */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-gray-300 text-xs font-normal">Start Date</Label>
                                <DatePicker
                                    date={draftFilters.startDate}
                                    onChange={(date) =>
                                        setDraftFilters((prev) => ({ ...prev, startDate: date }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-300 text-xs font-normal">End Date</Label>
                                <DatePicker
                                    date={draftFilters.endDate}
                                    onChange={(date) =>
                                        setDraftFilters((prev) => ({ ...prev, endDate: date }))
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* GAME PROVIDER */}
                    <div className="space-y-2">
                        <Label className="text-gray-300 text-xs font-normal">Game Provider</Label>
                        <Select
                            value={draftFilters.provider}
                            onValueChange={(value) =>
                                setDraftFilters((prev) => ({ ...prev, provider: value }))
                            }
                        >
                            <SelectTrigger className="w-full bg-[#1A1F2B] border-white/5 text-gray-200 h-10 rounded-lg">
                                <SelectValue placeholder="All Providers" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A1F2B] border border-gray-700 text-white">
                                <SelectItem value="all">All Providers</SelectItem>
                                {providerOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* CATEGORY */}
                    <div className="space-y-2">
                        <Label className="text-gray-300 text-xs font-normal">Category</Label>
                        <Select
                            value={draftFilters.category}
                            onValueChange={(value) =>
                                setDraftFilters((prev) => ({ ...prev, category: value }))
                            }
                        >
                            <SelectTrigger className="w-full bg-[#1A1F2B] border-white/5 text-gray-200 h-10 rounded-lg">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A1F2B] border border-gray-700 text-white">
                                <SelectItem value="all">All Categories</SelectItem>
                                {categoryOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* STATUS */}

                </div>

                <div className="p-4 border-t border-gray-700 flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 bg-transparent cursor-pointer border-gray-600 text-white hover:bg-gray-700 h-11 rounded-xl"
                        onClick={handleReset}
                    >
                        Reset
                    </Button>
                    <Button
                        className="flex-1 bg-purple-600 cursor-pointer hover:bg-purple-700 text-white h-11 rounded-xl"
                        onClick={handleApply}
                    >
                        Apply Filters
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
