"use client";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
}

export default function DisableRewardToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between bg-[#161A21]  py-1 rounded-lg">
      <span className="text-white text-xl font-medium">Disable Reward</span>

      {/* SWITCH */}
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-300
          ${value ? "bg-[#B93DEB]" : "bg-white/20"}
        `}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300
            ${value ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    </div>
  );
}
