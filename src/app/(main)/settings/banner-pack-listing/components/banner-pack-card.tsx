"use client";

import { BannerPack } from "@/types/banner-pack";
import Image from "next/image";

interface Props {
  pack: BannerPack;
  onClick: () => void;
}

export function BannerPackCard({ pack, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer bg-[#191D24] rounded-lg overflow-hidden hover:scale-[1.02] transition"
    >
      <Image
        src={pack.coverImage}
        alt={pack.title}
        width={400}
        height={200}
        className="w-full h-40 object-cover"
        unoptimized
      />

      <div className="p-3">

        <h3 className="text-white text-sm font-semibold">
          {pack.title}
        </h3>

        <p className="text-gray-400 text-xs mt-1 line-clamp-2">
          {pack.description}
        </p>

        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{pack.packSize}</span>
          <span>
            {new Date(pack.updatedAt).toLocaleDateString()}
          </span>
        </div>

      </div>
    </div>
  );
}