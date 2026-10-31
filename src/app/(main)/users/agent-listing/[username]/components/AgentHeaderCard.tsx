import { admin } from "@/assets/icons";
import { agentimage } from "@/assets/images/banner";
import { UserWithProfile } from "@/types/profile.type";
import Image from "next/image";
import { getAvatarColor, getInitials } from "@/utils/defaultimgbg";
import { useEffect, useState } from "react";
import { adminGetUserPackage } from "@/api/package/admin-package.api";
import { AgentActivePackage } from "@/types/agent-package.types";
import { useAgentPackagingEnabled } from "@/hooks/use-agent-packaging";

export default function AgentHeaderCard({ user, isSubAgentView }: { user: UserWithProfile; isSubAgentView?: boolean }) {
  const [activePackage, setActivePackage] = useState<AgentActivePackage | null>(null);
  // Packages switched off entirely → no plan is in force, so don't advertise
  // one here either. `null` (loading / lookup failed) leaves the block visible.
  const packagingEnabled = useAgentPackagingEnabled();
  const showPackage = !isSubAgentView && packagingEnabled !== false;

  useEffect(() => {
    if (user?.id) {
      adminGetUserPackage(user.id)
        .then((pkg) => {
          setActivePackage(pkg);
        })
        .catch(() => {
          // Ignore 404s if the agent doesn't have a package yet
          setActivePackage(null);
        });
    }
  }, [user?.id]);

  return (
    <div className="bg-[#161A21] rounded-xl p-4 flex flex-col items-stretch gap-4 md:p-8 md:flex-row md:justify-between md:items-center md:gap-0">
      {/* LEFT */}
      <div className="flex min-w-0 items-center gap-4">
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt="AgentImage"
            width={120}
            height={120}
            className="w-16 h-16 shrink-0 rounded-full object-cover md:w-30 md:h-30"
          />
        ) : (
          <div
            className="w-16 h-16 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xl md:w-30 md:h-30 md:text-4xl"
            style={{
              backgroundColor: getAvatarColor(user.username || user.name || "Agent"),
            }}
          >
            {getInitials(user.username || user.name || "Agent")}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-white text-sm break-words">
            {user.name || user.username || "Agent"} (ID: {user.id.slice(0, 8)})
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Status: <span className={user.isActive ? "text-green-400" : "text-red-400"}>
              {user.isActive ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
      </div>

      {/* RIGHT */}
      {showPackage && (
        <div className="flex items-center gap-3">
          <div className="text-left flex flex-col items-start md:text-right md:items-end">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Current Package</p>
            <p className="text-white text-sm font-black uppercase tracking-wider text-[#B146F5] md:text-lg">
              {activePackage ? activePackage.package.name : "Free / Base"}
            </p>
          </div>
          <div className="w-14 h-14 shrink-0 rounded-full bg-purple-500/20 flex items-center justify-center md:w-36 md:h-36">
            <Image
              src={agentimage}
              alt="AgentImage"
              className="w-10 h-10 object-contain relative z-10 md:w-auto md:h-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
