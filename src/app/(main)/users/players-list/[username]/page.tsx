"use client";

import { useParams } from "next/navigation";
import AgentBreadcrumb from "./components/PlayerBreadcrumb";
import AgentHeaderCard from "./components/PlayerHeaderCard";
import AgentTabs from "./components/PlayerTabs";

export default function PlayerDetailsPage() {
  const { username } = useParams<{ username: string }>();
  
  return (
    <div className="space-y-4 px-3 py-4 md:px-5">
      <AgentBreadcrumb username={username} />
      <AgentHeaderCard username={username} />
      <AgentTabs username={username} />
    </div>
  );
}
