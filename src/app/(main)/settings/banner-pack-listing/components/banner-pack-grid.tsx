"use client";

import { BannerPack } from "@/types/banner-pack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import { BannerPackCard } from "./banner-pack-card";
import { useRouter } from "next/navigation";

import React from "react";

interface Props {
  packs: BannerPack[];
  onCreate: () => void;
}

export function BannerPackGrid({ packs, onCreate }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");

  const filtered = packs.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-[#15181E] p-4 min-h-screen">

      <div className="bg-[#191D24] mb-3 px-4 py-2 rounded-lg">
        <h1 className="text-white">Settings / Banner Packs</h1>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder="Search pack..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#242B35] text-white"
        />

        <Button size="icon">
          <Search size={18} />
        </Button>

        <Button onClick={onCreate} className="bg-purple-600">
          Create Pack
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-4">

        {filtered.map((pack) => (
          <BannerPackCard
            key={pack.id}
            pack={pack}
            onClick={() =>
              router.push(`/admin/settings/banner-pack-listing/${pack.id}`)
            }
          />
        ))}
      </div>
    </div>
  );
}