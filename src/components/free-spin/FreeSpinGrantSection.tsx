"use client";

import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { useFreeSpinGrantsStore } from "@/store/free-spin-grants-store";
import { FreeSpinGrant } from "@/types/free-spin";

interface FreeSpinGrantSectionProps {
  userId?: string;
  title?: string;
  emptyMessage?: string;
  showGrantActions?: boolean;
}

export default function FreeSpinGrantSection({
  userId,
  title = "Free Spins",
  emptyMessage = "No free spin grants found for this player",
  showGrantActions = true,
}: FreeSpinGrantSectionProps) {
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [cancelConfirmGrant, setCancelConfirmGrant] = useState<FreeSpinGrant | null>(null);
  const {
    grants: freeSpinGrants,
    configs: freeSpinConfigs,
    isGranting,
    isCancelling,
    fetchGrants,
    fetchActiveConfigs,
    grantSpins,
    cancelGrant,
    prependGrant,
  } = useFreeSpinGrantsStore();

  const userIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    fetchActiveConfigs();
  }, [fetchActiveConfigs]);

  useEffect(() => {
    if (!userId) return;
    fetchGrants(userId);
  }, [fetchGrants, userId]);

  useEffect(() => {
    const onFreeSpinGranted = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (!payload) return;

      const currentUserId = userIdRef.current;
      if (!currentUserId) return;
      if (payload.userId !== currentUserId && payload.user_id !== currentUserId) return;

      const newGrant: FreeSpinGrant = {
        id: payload.id,
        freeSpinConfigId: payload.bonus_config_id ?? payload.bonusConfigId ?? "",
        userId: payload.user_id ?? payload.userId ?? currentUserId,
        sourceTransactionId: payload.casino_bonus_id ?? payload.casinoBonusId ?? "",
        grantedAt: payload.created_at ?? payload.createdAt ?? new Date().toISOString(),
        expiresAt: payload.expires_at ?? payload.expiresAt ?? undefined,
        status: (payload.status ?? "granted").toLowerCase() as FreeSpinGrant["status"],
        config: payload.config ?? {
          name: "-",
          numberOfFreeSpins: payload.spinsGranted ?? payload.spins_granted ?? 0,
          softwareId: payload.softwareId ?? payload.software_id ?? 0,
          softwareName: payload.softwareName ?? payload.software_name,
          gameId: payload.gameId ?? payload.game_id ?? 0,
          gameName: payload.gameName ?? payload.game_name,
        },
      };

      prependGrant(newGrant);
    };

    window.addEventListener("free-spin:granted", onFreeSpinGranted);
    return () => window.removeEventListener("free-spin:granted", onFreeSpinGranted);
  }, [prependGrant]);

  const handleGrantFreeSpins = async () => {
    if (!selectedConfigId || !userId) return;

    try {
      await grantSpins(selectedConfigId, userId);
      setShowGrantForm(false);
      setSelectedConfigId("");
    } catch {
      // Toast is handled in the store.
    }
  };

  const handleCancelGrant = async (casinoBonusId: string) => {
    try {
      await cancelGrant(casinoBonusId);
      setCancelConfirmGrant(null);
    } catch {
      // Toast is handled in the store.
    }
  };

  const visibleGrants = userId ? freeSpinGrants : [];
  const showGrantControls = showGrantForm && Boolean(userId);
  const activeCancelConfirmGrant = userId ? cancelConfirmGrant : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="text-xl text-white">{title}</p>
        {showGrantActions && (
          <button
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium disabled:opacity-40"
            onClick={() => setShowGrantForm((value) => !value)}
            disabled={!userId}
          >
            {showGrantForm ? "Close" : "+ Grant Free Spins"}
          </button>
        )}
      </div>

      {!userId && (
        <div className="bg-[#1C2127] border border-dashed border-gray-700 rounded-xl p-4 mb-4 text-sm text-gray-400">
          Enter or select a player ID to load and manage free spin grants.
        </div>
      )}

      {showGrantActions && showGrantControls && (
        <div className="bg-[#1C2127] border border-purple-500/30 rounded-xl p-4 mb-4 flex items-end gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block font-medium">Select Free Spin Config</label>
            <select
              className="w-full h-10 bg-[#242B35] rounded-lg px-3 text-white text-sm border border-gray-700"
              value={selectedConfigId}
              onChange={(e) => setSelectedConfigId(e.target.value)}
            >
              <option value="">-- Select a config --</option>
              {freeSpinConfigs.map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.name} - {cfg.numberOfFreeSpins} spins
                </option>
              ))}
            </select>
          </div>
          <button
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg disabled:opacity-40 font-medium h-10"
            onClick={handleGrantFreeSpins}
            disabled={!selectedConfigId || isGranting}
          >
            {isGranting ? "Granting..." : "Confirm Grant"}
          </button>
        </div>
      )}

      {activeCancelConfirmGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1C2127] border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-white font-medium mb-2">Cancel Free Spin Grant</h3>
            <p className="text-gray-400 text-sm mb-1">You are about to cancel the following grant:</p>
            <div className="bg-[#242B35] rounded-lg p-3 mb-4 text-xs text-gray-300 space-y-1">
              <p>
                <span className="text-gray-500">Config:</span> {activeCancelConfirmGrant.config?.name ?? "-"}
              </p>
              <p>
                <span className="text-gray-500">Spins:</span> {activeCancelConfirmGrant.config?.numberOfFreeSpins ?? "-"}
              </p>
              <p>
                <span className="text-gray-500">Transaction ID:</span>{" "}
                <span className="font-mono">{activeCancelConfirmGrant.sourceTransactionId}</span>
              </p>
            </div>
            <p className="text-yellow-400 text-xs mb-4">
              This will cancel the grant on AleaPlay&apos;s side. This action cannot be undone if the player
              has already started playing.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg"
                onClick={() => setCancelConfirmGrant(null)}
              >
                Keep Grant
              </button>
              <button
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40"
                onClick={() => handleCancelGrant(activeCancelConfirmGrant.sourceTransactionId)}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Cancel Grant"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#242B35]">
            <tr>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Config</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Spins</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Software</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Game</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Transaction ID</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Granted</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Expires</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {visibleGrants.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-gray-500 text-xs">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleGrants.map((grant) => {
                const statusNorm = (grant.status ?? "").toLowerCase();
                const isGranted = statusNorm === "granted" || statusNorm === "active";
                const statusColor = isGranted
                  ? "bg-green-500/20 text-green-400"
                  : statusNorm === "cancelled"
                    ? "bg-red-500/20 text-red-400"
                    : statusNorm === "completed" || statusNorm === "used"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-gray-500/20 text-gray-400";
                const txId = grant.sourceTransactionId ?? "";

                return (
                  <tr key={grant.id} className="bg-[#1C2127] hover:bg-[#1a2030] transition-colors">
                    <td className="px-4 py-3 text-white text-xs font-medium">
                      {grant.config?.name ?? grant.bonusLabel ?? "Manual Grant"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {grant.config?.numberOfFreeSpins ?? grant.spinsGranted ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {grant.config?.softwareName ?? grant.softwareName ?? grant.config?.softwareId ?? grant.softwareId ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {grant.config?.gameName ?? grant.gameName ?? grant.config?.gameId ?? grant.gameId ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className="font-mono text-purple-300 text-[10px] cursor-pointer hover:text-purple-200"
                        title={txId}
                        onClick={() => {
                          navigator.clipboard.writeText(txId);
                          toast.success("Copied");
                        }}
                      >
                        {txId.length > 20 ? `${txId.slice(0, 10)}...${txId.slice(-8)}` : txId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {grant.grantedAt ? new Date(grant.grantedAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${statusColor}`}>
                        {statusNorm || "unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isGranted && (
                        <button
                          className="px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded text-xs font-medium transition-colors"
                          onClick={() => setCancelConfirmGrant(grant)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
