"use client";

import Image from "next/image";
import { notfound } from "@/assets/icons";

interface NoDataProps {
  title?: string;
  image?: any;
}

export default function NoData({
  title = "No data found",
  image,
}: NoDataProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full  text-gray-400">
      <Image
        src={image ?? notfound}
        alt="No data"
        width={220}
        height={220}
      />

      <span className="text-sm">{title}</span>
    </div>
  );
}
