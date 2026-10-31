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
import DatePicker from "@/components/DatePicker";

export interface GameReportFilters {
    status: string;
    provider: string;
    gameType: string;
    startDate?: Date;
    endDate?: Date;
    result: "all" | "win" | "loss";
}

interface GameReportFilterSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: GameReportFilters;
    onApply: (filters: GameReportFilters) => void;
    providerOptions: string[];
    gameTypeOptions: string[];
}

const DEFAULT_FILTERS: GameReportFilters = {
    status: "all",
    provider: "all",
    gameType: "all",
    startDate: undefined,
    endDate: undefined,
    result: "all",
};

export function GameReportFilterSheet({
    open,
    onOpenChange,
    filters,
    onApply,
    providerOptions,
    gameTypeOptions,
}: GameReportFilterSheetProps) {
    const [draftFilters, setDraftFilters] = React.useState<GameReportFilters>(filters);

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
                    <SheetTitle className="text-lg text-white">Game Report Filters</SheetTitle>
                    <SheetDescription className="text-sm text-gray-400">
                        Filter game logs by specific criteria
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* DATE RANGE */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-300">Start Date</Label>
                            <DatePicker
                                date={draftFilters.startDate}
                                onChange={(date) =>
                                    setDraftFilters((prev) => ({ ...prev, startDate: date }))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-300">End Date</Label>
                            <DatePicker
                                date={draftFilters.endDate}
                                onChange={(date) =>
                                    setDraftFilters((prev) => ({ ...prev, endDate: date }))
                                }
                            />
                        </div>
                    </div>

                    {/* STATUS */}
                    <div className="space-y-2">
                        <Label className="text-gray-300">Status</Label>
                        <Select
                            value={draftFilters.status}
                            onValueChange={(value) =>
                                setDraftFilters((prev) => ({ ...prev, status: value }))
                            }
                        >
                            <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* RESULT (WIN/LOSS) */}
                    {/* <div className="space-y-2">
                        <Label className="text-gray-300">Result (Win/Loss)</Label>
                        <Select
                            value={draftFilters.result}
                            onValueChange={(value) =>
                                setDraftFilters((prev) => ({ ...prev, result: value as GameReportFilters["result"] }))
                            }
                        >
                            <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                                <SelectValue placeholder="Select result" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="win">Win</SelectItem>
                                <SelectItem value="loss">Loss</SelectItem>
                            </SelectContent>
                        </Select>
                    </div> */}

                    {/* PROVIDER */}
                    <div className="space-y-2">
                        <Label className="text-gray-300">Provider</Label>
                        <Select
                            value={draftFilters.provider}
                            onValueChange={(value) =>
                                setDraftFilters((prev) => ({ ...prev, provider: value }))
                            }
                        >
                            <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                                <SelectItem value="all">All Providers</SelectItem>
                                {providerOptions.map((provider) => (
                                    <SelectItem key={provider} value={provider}>
                                        {provider}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* GAME TYPE */}
                    <div className="space-y-2">
                        <Label className="text-gray-300">Game Type</Label>
                        <Select
                            value={draftFilters.gameType}
                            onValueChange={(value) =>
                                setDraftFilters((prev) => ({ ...prev, gameType: value }))
                            }
                        >
                            <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                                <SelectItem value="all">All Types</SelectItem>
                                {gameTypeOptions.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>


                <div className="mt-auto p-4 border-t border-gray-700 flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        className="flex-1 bg-[#2A3240] border-gray-700 cursor-pointer text-white hover:bg-[#313B4A]"
                    >
                        Reset Filters
                    </Button>
                    <Button
                        type="button"
                        onClick={handleApply}
                        className="flex-1 bg-purple-500 cursor-pointer hover:bg-purple-600 text-white"
                    >
                        Apply Filters
                    </Button>


                </div>
            </SheetContent>
        </Sheet>
    );
}
