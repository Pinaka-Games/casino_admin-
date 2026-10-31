"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { profileApi } from "@/api/users/users";
import { UserWithProfile } from "@/types/profile.type";
import { useFreeSpinGrantsStore } from "@/store/free-spin-grants-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { summarizeGames } from "@/lib/free-spin-selection";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // data and onSubmit are kept for interface compatibility but we handle granting internally
  data?: any | null; 
  onSubmit?: (data: any) => void;
}

export function VipLuckySpinDialog({
  open,
  onOpenChange,
}: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Free Spin state
  const { configs, loadingConfigs, isGranting, fetchActiveConfigs, grantSpins } =
    useFreeSpinGrantsStore();
  const [selectedConfigId, setSelectedConfigId] = useState("");

  // User search state
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserWithProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  // Load configs on mount
  useEffect(() => {
    if (open) {
      fetchActiveConfigs();
    }
  }, [open, fetchActiveConfigs]);

  // Handle outside click for search dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced user search
  useEffect(() => {
    if (!userSearch.trim() || selectedUser) {
      setUserResults([]);
      setDropdownOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await profileApi.getAllUsers({
          search: userSearch,
          limit: 10,
          page: 1,
        });
        setUserResults(res.data.data);
        setDropdownOpen(true);
      } catch {
        // ignore errors
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [userSearch, selectedUser]);

  const handleSelectUser = (user: UserWithProfile) => {
    setSelectedUser(user);
    setUserSearch(user.username || user.profile?.email || user.id);
    setDropdownOpen(false);
    setUserResults([]);
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setUserSearch("");
  };

  const handleReset = () => {
    setSelectedUser(null);
    setUserSearch("");
    setSelectedConfigId("");
  };

  const handleGrant = async () => {
    if (!selectedUser) {
      toast.error("Please select a user");
      return;
    }
    if (!selectedConfigId) {
      toast.error("Please select a free spin configuration");
      return;
    }

    try {
      await grantSpins(selectedConfigId, selectedUser.id);
      handleReset();
      onOpenChange(false);
    } catch (e: any) {
      // Error handled in store/api
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15181E] text-white max-w-lg border-gray-800 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-4">
          <DialogTitle className="text-xl font-bold">Grant Free Spins</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Search */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs font-medium uppercase tracking-wider">Select Player</Label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <Input
                  ref={inputRef}
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    if (selectedUser) setSelectedUser(null);
                  }}
                  placeholder="Search by username or email..."
                  className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500 pl-10 pr-10 h-11 rounded-lg focus:ring-purple-500/50"
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={handleClearUser}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {(dropdownOpen && userResults.length > 0) || searching ? (
                <div
                  ref={dropdownRef}
                  className="absolute top-full mt-1 left-0 right-0 z-[60] bg-[#1a2030] border border-gray-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden divide-y divide-gray-800"
                >
                  {searching && (
                    <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                       <Loader2 size={14} className="animate-spin" /> Searching...
                    </div>
                  )}
                  {!searching &&
                    userResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-[#242B35] flex flex-col transition-colors"
                      >
                        <span className="font-semibold text-white">{u.username || "—"}</span>
                        <span className="text-[10px] text-gray-500 mt-0.5 truncate">
                          {u.profile?.email || u.entity || "—"}
                        </span>
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Config Selection */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs font-medium uppercase tracking-wider">Free Spin Config</Label>
            <Select
              value={selectedConfigId}
              onValueChange={setSelectedConfigId}
            >
              <SelectTrigger className="w-full h-11 bg-[#242B35] border-gray-700 text-white rounded-lg focus:ring-purple-500/50">
                <SelectValue placeholder={loadingConfigs ? "Loading configs..." : "Select configuration"} />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] border-gray-700 text-white rounded-lg max-h-80">
                {configs.length === 0 && !loadingConfigs && (
                  <div className="p-4 text-center text-sm text-gray-500">No active configs found</div>
                )}
                {configs.map((cfg) => (
                  <SelectItem key={cfg.id} value={cfg.id} className="cursor-pointer hover:bg-purple-600/20 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{cfg.name}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        {cfg.numberOfFreeSpins} spins | {summarizeGames(cfg)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-3">
             <p className="text-[11px] text-purple-200/70 leading-relaxed italic">
                Granting spins is permanent. The player will be able to play these spins immediately on their next login or game launch.
             </p>
          </div>
        </div>

        <DialogFooter className="gap-3 pt-4 border-t border-gray-800">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isGranting}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGrant}
            disabled={isGranting || !selectedUser || !selectedConfigId}
            className="bg-[#B93DEB] hover:bg-purple-500 text-white min-w-[130px] font-bold h-11 shadow-lg shadow-purple-600/20"
          >
            {isGranting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Granting...
              </span>
            ) : (
              "Confirm Grant"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
