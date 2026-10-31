"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { create } from "@/assets/images/action";

interface Props {
  onAdd: () => void;
}

export default function CashBundleHeader({ onAdd }: Props) {
  return (
    <div className="bg-[#191D24] mb-3 px-4 py-2 rounded-lg flex items-center justify-between">
      <h1 className="text-base font-normal text-white">Settings / Cash Bundle</h1>

      <Button
        variant="outline"
        size="icon"
        className="bg-[#1a2030] border-gray-700 hover:bg-[#242B35]"
        onClick={onAdd}
      >
        <Image src={create} alt="Add" width={20} height={20} />
      </Button>
    </div>
  );
}
