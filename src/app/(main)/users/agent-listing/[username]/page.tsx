"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUserManagement } from "@/hooks/use-users";
import AgentBreadcrumb from "./components/AgentBreadcrumb";
import AgentHeaderCard from "./components/AgentHeaderCard";
import AgentTabs from "./components/AgentTabs";
import { ChevronLeft, Loader2 } from "lucide-react";
import { profileApi } from "@/api/users/users";
import { UserWithProfile } from "@/types/profile.type";

export default function AgentDetailsPage() {
  const { username: userId } = useParams<{ username: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSubAgentRoute = searchParams.get("view") === "subagent";
  const { selectedUser: user, fetchUser, loading } = useUserManagement();

  const [viewingSubAgentId, setViewingSubAgentId] = useState<string | null>(null);
  const [subAgentUser, setSubAgentUser] = useState<UserWithProfile | null>(null);
  const [subAgentLoading, setSubAgentLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUser(userId);
    }
  }, [userId, fetchUser]);

  useEffect(() => {
    if (!viewingSubAgentId) {
      setSubAgentUser(null);
      return;
    }
    setSubAgentLoading(true);
    profileApi
      .getUserProfile(viewingSubAgentId)
      .then((res) => setSubAgentUser(res.data))
      .catch(() => setSubAgentUser(null))
      .finally(() => setSubAgentLoading(false));
  }, [viewingSubAgentId]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B93DEB]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-white text-lg">
        <Loader2 className="h-8 w-8 animate-spin text-[#B93DEB]" />
      </div>
    );
  }

  /* ── Inline sub-agent view ── */
  if (viewingSubAgentId) {
    return (
      <div className="space-y-4 px-3 py-4 text-white md:px-5">
        <button
          onClick={() => setViewingSubAgentId(null)}
          className="flex items-center gap-1.5 rounded-lg bg-[#161A21] border border-white/10 px-3 py-2 text-sm text-gray-300 hover:text-white hover:border-[#B93DEB]/40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Agent Listing
        </button>

        {subAgentLoading && (
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#B93DEB]" />
          </div>
        )}

        {!subAgentLoading && subAgentUser && (
          <>
            <AgentHeaderCard user={subAgentUser} isSubAgentView />
            <AgentTabs user={subAgentUser} isSubAgentView />
          </>
        )}
      </div>
    );
  }

  /* ── Sub-agent direct view (via ?view=subagent) ── */
  if (isSubAgentRoute) {
    return (
      <div className="space-y-4 px-3 py-4 text-white md:px-5">
        <button
          onClick={() => router.push("/users/sub-agent-listing")}
          className="flex items-center gap-1.5 rounded-lg bg-[#161A21] border border-white/10 px-3 py-2 text-sm text-gray-300 hover:text-white hover:border-[#B93DEB]/40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Sub-Agent Listing
        </button>
        <AgentHeaderCard user={user} isSubAgentView />
        <AgentTabs user={user} isSubAgentView />
      </div>
    );
  }

  /* ── Normal parent agent view ── */
  return (
    <div className="space-y-4 px-3 py-4 text-white md:px-5">
      <AgentBreadcrumb user={user} />
      <AgentHeaderCard user={user} />
      <AgentTabs user={user} onViewSubAgent={setViewingSubAgentId} />
    </div>
  );
}
