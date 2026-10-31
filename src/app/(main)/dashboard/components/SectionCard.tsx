"use client";

export default function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#171B23] rounded-xl border border-[#1F242D] p-3 w-full">
      {children}
    </div>
  );
}
