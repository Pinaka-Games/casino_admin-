"use client";

import * as React from "react";
import { TournamentStatus } from "@/types/tournament";

interface Props {
  startTime: string;
  endTime: string;
  status: TournamentStatus;
}

export function TournamentCountdown({ startTime, endTime, status }: Props) {
  const [timeLeft, setTimeLeft] = React.useState<string>("");
  const [isEnded, setIsEnded] = React.useState(false);

  React.useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();

      let diff = 0;
      let label = "";

      if (now < start) {
        // Starts in...
        diff = start - now;
        label = "Starts in: ";
      } else if (now < end) {
        // Ends in...
        diff = end - now;
        label = "Ends in: ";
      } else {
        setIsEnded(true);
        setTimeLeft("Tournament Ended");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours.toString().padStart(2, '0')}h`);
      parts.push(`${minutes.toString().padStart(2, '0')}m`);
      parts.push(`${seconds.toString().padStart(2, '0')}s`);

      setTimeLeft(`${label} ${parts.join(" ")}`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);

    return () => clearInterval(timer);
  }, [startTime, endTime]);

  if (status === TournamentStatus.COMPLETED || isEnded || status === TournamentStatus.STOPPED || status === TournamentStatus.CANCELLED) {
    const label = status === TournamentStatus.STOPPED ? "EVENT STOPPED" : 
                  status === TournamentStatus.CANCELLED ? "EVENT CANCELLED" : "EVENT ENDED";
    return (
      <div className={`text-center text-[10px] py-1 px-2 rounded bg-gray-800/50 font-bold uppercase ${status === TournamentStatus.STOPPED ? "text-red-500" : "text-gray-500"}`}>
        {label}
      </div>
    );
  }

  const isEndingSoon = timeLeft.includes("Ends in:") && !timeLeft.includes("d");

  return (
    <div className={`text-center font-mono text-xs tabular-nums ${isEndingSoon ? "text-red-400 animate-pulse" : "text-yellow-500"}`}>
       <div className="font-bold text-[10px] uppercase opacity-60 mb-0.5">
          {timeLeft.split(":")[0]}
       </div>
       <div className="text-[14px]">
          {timeLeft.split(":")[1]?.trim()}
       </div>
    </div>
  );
}
