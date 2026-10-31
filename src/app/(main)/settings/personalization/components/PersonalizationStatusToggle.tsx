"use client";

import { useEffect } from "react";

import { Switch } from "@/components/ui/switch";
import { usePersonalizationStore } from "@/store/personalization-store";

export default function PersonalizationStatusToggle() {
  const enabled = usePersonalizationStore(
    (state) => state.personalizationEnabled
  );
  const loadingStatus = usePersonalizationStore((state) => state.loadingStatus);
  const savingStatus = usePersonalizationStore((state) => state.savingStatus);
  const fetchStatus = usePersonalizationStore((state) => state.fetchStatus);
  const updateStatus = usePersonalizationStore((state) => state.updateStatus);

  useEffect(() => {
    fetchStatus().catch(() => undefined);
  }, [fetchStatus]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#15181E] px-3 py-2">
      <span className="text-sm text-gray-400">Personalization</span>
      <span
        className={`text-sm font-medium ${
          enabled ? "text-[#04AD37]" : "text-red-400"
        }`}
      >
        {enabled ? "Active" : "Inactive"}
      </span>
      <Switch
        checked={enabled}
        disabled={loadingStatus || savingStatus}
        onCheckedChange={(checked) => updateStatus(Boolean(checked))}
        className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-700"
      />
    </div>
  );
}
