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
import { Input } from "@/components/ui/input";

export interface GameReportFilters {
    gameType: string;
    status: string;
    provider: string;
    startDate?: Date;
    endDate?: Date;
    result: "all" | "win" | "loss";
    // Promotional free spin rows (server-side): all, only them, or exclude them.
    freeSpin: "all" | "only" | "exclude";
    // Player lookup (server-side), driven by the search box in the filter bar.
    player?: string;
    // Numeric range filters (client-side). Undefined = no bound.
    betMin?: number;
    betMax?: number;
    winMin?: number;
    winMax?: number;
    ggrMin?: number;
    ggrMax?: number;
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
    freeSpin: "all",
    player: "",
    betMin: undefined,
    betMax: undefined,
    winMin: undefined,
    winMax: undefined,
    ggrMin: undefined,
    ggrMax: undefined,
};

// Numeric range filters rendered as Min/Max pairs.
const RANGE_FIELDS: { label: string; minKey: keyof GameReportFilters; maxKey: keyof GameReportFilters }[] = [
    { label: "Bet Amount", minKey: "betMin", maxKey: "betMax" },
    { label: "Player Win", minKey: "winMin", maxKey: "winMax" },
    { label: "GGR", minKey: "ggrMin", maxKey: "ggrMax" },
];

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

    // A range is invalid only when BOTH bounds are set and Max <= Min. Leaving
    // Max empty is valid — it means "≥ Min" (open ended).
    const isRangeInvalid = (minKey: keyof GameReportFilters, maxKey: keyof GameReportFilters) => {
        const min = draftFilters[minKey];
        const max = draftFilters[maxKey];
        return min !== undefined && max !== undefined && Number(max) <= Number(min);
    };

    const hasInvalidRange = RANGE_FIELDS.some((f) => isRangeInvalid(f.minKey, f.maxKey));

    const handleReset = () => {
        setDraftFilters(DEFAULT_FILTERS);
        onApply(DEFAULT_FILTERS);
    };

    const handleApply = () => {
        if (hasInvalidRange) return;
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
                    <SheetTitle className="text-lg text-white">User Detail Filters</SheetTitle>
                    <SheetDescription className="text-sm text-gray-400">
                        Analyze specific player performance
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* DATE RANGE */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-300">Start Date</Label>
                            <DatePicker
                                date={draftFilters.startDate}
                                maxDate={draftFilters.endDate}
                                onChange={(date) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        startDate: date,
                                        endDate: prev.endDate && date && prev.endDate < date ? undefined : prev.endDate,
                                    }))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-300">End Date</Label>
                            <DatePicker
                                date={draftFilters.endDate}
                                minDate={draftFilters.startDate}
                                onChange={(date) =>
                                    setDraftFilters((prev) => ({
                                        ...prev,
                                        endDate: date,
                                        startDate: prev.startDate && date && prev.startDate > date ? undefined : prev.startDate,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    {/* RESULT — win/loss is the meaningful filter for a win-loss report */}
                    <div className="space-y-2">
                        <Label className="text-gray-300">Result</Label>
                        <Select
                            value={draftFilters.result}
                            onValueChange={(value) =>
                                setDraftFilters((prev) => ({ ...prev, result: value as GameReportFilters["result"] }))
                            }
                        >
                            <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                                <SelectValue placeholder="All results" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                                <SelectItem value="all">All Results</SelectItem>
                                <SelectItem value="win">Player Win</SelectItem>
                                <SelectItem value="loss">Player Loss</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* FREE SPIN — promotional spins stake 0.00, so admins can isolate or hide them */}
                    <div className="space-y-2">
                        <Label className="text-gray-300">Free Spin</Label>
                        <Select
                            value={draftFilters.freeSpin ?? "all"}
                            onValueChange={(value) =>
                                setDraftFilters((prev) => ({ ...prev, freeSpin: value as GameReportFilters["freeSpin"] }))
                            }
                        >
                            <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                                <SelectValue placeholder="All entries" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                                <SelectItem value="all">All Entries</SelectItem>
                                <SelectItem value="only">Free Spin Only</SelectItem>
                                <SelectItem value="exclude">Exclude Free Spin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

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
                        <Label className="text-gray-300">Category</Label>
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
                                <SelectItem value="all">All Categories</SelectItem>
                                {gameTypeOptions.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* NUMERIC RANGES — Bet Amount / Player Win / GGR (applied to the loaded rows) */}
                    {RANGE_FIELDS.map(({ label, minKey, maxKey }) => {
                        const invalid = isRangeInvalid(minKey, maxKey);
                        return (
                        <div key={label} className="space-y-2">
                            <Label className="text-gray-300">{label}</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    type="number"
                                    placeholder="Min"
                                    value={draftFilters[minKey] === undefined ? "" : String(draftFilters[minKey])}
                                    onChange={(e) =>
                                        setDraftFilters((prev) => ({
                                            ...prev,
                                            [minKey]: e.target.value === "" ? undefined : Number(e.target.value),
                                        }))
                                    }
                                    className="bg-[#242B35] border-gray-700 text-white"
                                />
                                <Input
                                    type="number"
                                    placeholder="Max"
                                    value={draftFilters[maxKey] === undefined ? "" : String(draftFilters[maxKey])}
                                    onChange={(e) =>
                                        setDraftFilters((prev) => ({
                                            ...prev,
                                            [maxKey]: e.target.value === "" ? undefined : Number(e.target.value),
                                        }))
                                    }
                                    className={`bg-[#242B35] text-white ${invalid ? "border-red-500" : "border-gray-700"}`}
                                />
                            </div>
                            {invalid && (
                                <p className="text-[11px] text-red-400">
                                    Max must be greater than Min. Leave Max empty to match everything above Min.
                                </p>
                            )}
                        </div>
                        );
                    })}

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
                        disabled={hasInvalidRange}
                        className="flex-1 bg-purple-500 cursor-pointer hover:bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Apply Filters
                    </Button>


                </div>
            </SheetContent>
        </Sheet>
    );
}
