"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { getRaceDetails } from "@/api/race/race.api";
import { Race } from "@/types/race";
import RaceDetailView from "../components/RaceDetailView";

export default function RaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? "");

  const [race, setRace] = useState<Race | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getRaceDetails(id);
        if (active) setRace(data);
      } catch {
        if (active) toast.error("Failed to load race");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#0E1014] md:bg-[#15181E] p-4 md:p-6 overflow-x-hidden text-white font-sans">
      {/* HEADER BREADCRUMB */}
      <div className="bg-[#1D222B]/40 border border-[#2A2F3A]/30 mb-6 px-5 py-4 rounded-xl shadow-sm flex items-center justify-between">
        <h1 className="text-white text-md">
          Games / Race Contests
          {race ? ` / ${race.name}` : ""}
        </h1>
        <button
          onClick={() => router.push("/settings/race-contests")}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#15181E] border border-[#2A2F3A]/80 text-gray-300 text-sm hover:bg-[#2A2F3A] transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>
      </div>

      {loading ? (
        <div className="space-y-5 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex min-h-[110px] flex-col justify-between rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-4"
              >
                <div className="flex justify-between">
                  <div className="h-2.5 w-20 bg-gray-700/40 rounded" />
                  <div className="h-6 w-6 bg-gray-700/40 rounded-md" />
                </div>
                <div className="h-7 w-20 bg-gray-700/40 rounded" />
              </div>
            ))}
          </div>
          <div className="h-72 rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/40" />
        </div>
      ) : race ? (
        <RaceDetailView race={race} />
      ) : (
        <div className="text-center py-20 text-gray-500">Race not found</div>
      )}
    </div>
  );
}
