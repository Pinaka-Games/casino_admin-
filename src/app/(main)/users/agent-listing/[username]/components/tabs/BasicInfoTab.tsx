import { useParams } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import { useEffect } from "react";
import { useUserManagement } from "@/hooks/use-users";
import { UserWithProfile } from "@/types/profile.type";
import { Loader2 } from "lucide-react";
import { usePresence, resolvePresence } from "@/hooks/use-presence";
import { formatOnlineStatus } from "@/components/OnlineStatus";
import { formatCalendarDate } from "@/lib/calendar-date";
export default function BasicInfoTab({ user: userProp }: { user?: UserWithProfile }) {
  const { username: userId } = useParams<{ username: string }>();
  const { selectedUser: storeUser, fetchUser, loading } = useUserManagement();

  useEffect(() => {
    if (!userProp && userId) {
      fetchUser(userId);
    }
  }, [userId, fetchUser, userProp]);

  const user = userProp ?? storeUser;

  // Live presence, so the detail page tracks the agent signing in or out the
  // same way the listing does. Hooks run before the early returns below.
  const presence = usePresence();
  const live = resolvePresence(presence, (user as any)?.id, user as any);

  if (!userProp && loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#B93DEB]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-40 items-center justify-center text-white text-sm">
        User not found
      </div>
    );
  }

  const profile = user.profile;
  const anyUser = user as any;
  const referralCode = anyUser.agent?.referralCode || anyUser.subAgent?.referralCode || anyUser.referralCode || "N/A";
  const email = profile?.email || anyUser.email || user.entity || "N/A";
  const countryState = `${profile?.country || ""}${profile?.state ? ", " + profile.state : ""}` || "N/A";

  return (
    <div className="px-1 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 text-sm text-white md:px-5">
      <Info label="Full Name" value={profile?.fullName || user.name || "N/A"} />
      <Info label="Email" value={email} copyable />
      <Info
        label="Account Status"
        value={user.isActive ? "Active" : "Inactive"}
        green={user.isActive}
      />
      {/* Reads "Offline (last seen 13/08/2026, 10:24)" — inline rather than a
          second row, since this layout is one value per label. */}
      <Info
        label="Online Status"
        value={formatOnlineStatus(live)}
        green={live.isOnline}
      />
      <Info label="Display Name" value={profile?.displayName || "N/A"} copyable />
      <Info
        label="Gender"
        value={
          profile?.gender
            ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
            : "N/A"
        }
      />
      <Info label="Refferal Code" value={referralCode} copyable />
      <Info label="Date of Birth" value={formatCalendarDate(profile?.dateOfBirth)} />
      <Info label="Country/State" value={countryState} />
      <Info label="Phone" value={profile?.phone || "N/A"} />
    </div>
  );
}

function Info({
  label,
  value,
  green,
  copyable,
}: {
  label: string;
  value: string;
  green?: boolean;
  /** Identifiers staff paste elsewhere — email, display name, referral code. */
  copyable?: boolean;
}) {
  return (
    <div className="flex gap-3 md:gap-6">
      <span className="w-28 shrink-0 text-md font-normal text-[#9c999d] md:w-32">{label}:</span>
      <span className={`flex min-w-0 items-center gap-2 wrap-anywhere ${green ? "text-green-400" : "text-white"}`}>
        {value}
        {copyable && <CopyButton value={value} />}
      </span>
    </div>
  );
}
