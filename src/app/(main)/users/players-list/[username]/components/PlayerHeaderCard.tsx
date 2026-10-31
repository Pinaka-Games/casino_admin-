"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import api from "@/api/config/axios.config";
import { Mail, Phone, CalendarDays, Globe, User } from "lucide-react";
import { getInitials, getAvatarColor } from "@/utils/defaultimgbg";
import CopyButton from "@/components/CopyButton";
import { Skeleton } from "@/components/ui/skeleton";

import EditPlayerModal from "@/app/(main)/users/components/player-list/EditPlayerModal";
import { BronzeTier } from "@/assets/images/banner";
import { vipAdminApi, UserVipProgress } from "@/api/vip/vip";
import { toCalendarDate } from "@/lib/calendar-date";
import { resolveNameParts } from "@/lib/player-name";

interface UserData {
  id: string;
  username?: string;
  entity?: string;
  name?: string;
  avatar?: string;
  isPremium?: boolean;
  isActive?: boolean;
  profile?: {
    displayName?: string;
    fullName?: string;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    phone?: string;
    email?: string;
    dateOfBirth?: string;
    country?: string;
  };
  vipTierId?: string | null;
  createdAt?: string;
  isOnline?: boolean;
  onlineStatus?: string;
}

/**
 * A two-letter ISO country code as its flag, using the regional-indicator
 * block. Anything else — a full country name, a bad code — returns null rather
 * than rendering the mojibake that offsetting arbitrary characters produces.
 */
const flagOf = (country?: string | null) => {
  const code = (country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
};

/** Capitalises the first letter only — a display name is a name, not a title. */
const capitalise = (value?: string | null) => {
  const text = (value ?? "").trim();
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const formatJoined = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/** One fact in the header strip: an icon, the value, and nothing when empty. */
const HeaderFact = ({
  icon: Icon,
  value,
  copy,
  prefix,
}: {
  icon: typeof Mail;
  value?: string | null;
  copy?: string | null;
  prefix?: string;
}) => {
  if (!value) return null;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-400">
      <Icon size={13} className="shrink-0 text-gray-500" />
      {prefix && <span className="text-gray-500">{prefix}</span>}
      <span className="truncate text-gray-300">{value}</span>
      {copy ? <CopyButton value={copy} /> : null}
    </span>
  );
};

export default function PlayerHeaderCard({ username }: { username: string }) {
  const [data, setData] = useState<UserData | null>(null);
  const [vip, setVip] = useState<UserVipProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [openEdit, setOpenEdit] = useState(false);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/profile/user/${username}`);
      setData(res.data);
      if (res.data?.id) {
         try {
            const vipRes = await vipAdminApi.getUserVipProgress(res.data.id);
            setVip(vipRes.data);
         } catch (e) {
            console.error("Failed to fetch VIP progress", e);
         }
      }
    } catch (err) {
      console.error("Failed to fetch user header data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username) fetchUser();
  }, [username]);

  // Shaped like the card it replaces, so the header does not jump when the
  // request lands — a centred spinner in an 8rem box did exactly that.
  if (loading) {
    return (
      <div className="flex flex-col items-stretch gap-4 rounded-xl bg-[#161A21] p-4 md:flex-row md:items-center md:justify-between md:gap-6 md:p-8">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="h-30 w-30 shrink-0 rounded-full bg-[#242B35]" />
          <div className="min-w-0 space-y-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32 bg-[#242B35]" />
              <Skeleton className="h-4 w-16 rounded-full bg-[#242B35]" />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[150, 170, 130, 140, 90].map((width) => (
                <Skeleton
                  key={width}
                  className="h-3 bg-[#242B35]"
                  style={{ width }}
                />
              ))}
            </div>
          </div>
        </div>
        <Skeleton className="h-36 w-36 shrink-0 rounded-full bg-[#242B35]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#161A21] rounded-xl p-8 text-center text-gray-400">
        User data not available.
      </div>
    );
  }

  const displayName = data.username || data.profile?.displayName || "Unknown";
  // `entity` is whatever the account registered with — an email or a phone — so
  // it only stands in for the email when it actually looks like one.
  const email =
    data.profile?.email || (data.entity?.includes("@") ? data.entity : null);
  const phone = data.profile?.phone || null;
  const country = data.profile?.country || null;
  // The name the player chose, which the username above does not always spell.
  const profileName = capitalise(
    data.profile?.displayName || data.profile?.fullName || data.name,
  );
  const flag = flagOf(country);
  const joined = formatJoined(data.createdAt);
  const active = data.isActive !== false;
  const tierName = vip?.currentTier?.name || "Bronze";
  const tierBadge = vip?.currentTier?.badge || BronzeTier;
  const isLocalBadge = typeof tierBadge !== "string" && !!tierBadge;

  return (
    <div className="flex flex-col items-stretch gap-4 rounded-xl bg-[#161A21] p-4 md:flex-row md:items-center md:justify-between md:gap-6 md:p-8">
      {/* LEFT */}
      <div className="flex min-w-0 items-center gap-4">
        <div className="w-16 h-16 md:w-30 md:h-30 shrink-0 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden">
          {data.avatar ? (
            <img
              src={data.avatar}
              alt={displayName}
              className="object-cover w-16 h-16 md:w-30 md:h-30"
            />
          ) : (
            <div
              className="w-16 h-16 md:w-30 md:h-30 flex items-center justify-center text-white text-lg md:text-2xl font-bold rounded-full"
              style={{ backgroundColor: getAvatarColor(displayName) }}
            >
              {getInitials(displayName)}
            </div>
          )}
        </div>
        {/* Name, state, and the facts an admin otherwise had to open three tabs
            to collect. Wraps rather than truncating the row: on a narrow window
            the last fact drops to a second line instead of disappearing. */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base md:text-lg font-semibold text-white break-all">{displayName}</p>
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                active
                  ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#4ADE80]"
                  : "border-gray-700 bg-white/5 text-gray-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  active ? "bg-[#4ADE80]" : "bg-gray-500"
                }`}
              />
              {active ? "Active" : "Inactive"}
            </span>
            {data.onlineStatus && (
              <span className="text-[11px] text-gray-500">
                {data.onlineStatus}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            <HeaderFact icon={User} value={profileName} />
            <HeaderFact icon={Mail} value={email} copy={email} />
            <HeaderFact icon={Phone} value={phone} copy={phone} />
            <HeaderFact
              icon={CalendarDays}
              prefix="Joined:"
              value={joined}
            />
            <HeaderFact
              icon={Globe}
              value={country ? `${flag ? `${flag} ` : ""}${country}` : null}
            />
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex shrink-0 items-center gap-3 md:gap-4">
        <div className="text-left md:text-right">
          <p className="text-white text-xs md:text-sm font-bold uppercase">{tierName}</p>
        </div>
        {/* Badge first on a phone, name beside it. On desktop the order flips
            back so the name still reads into the badge at the card's edge. */}
        <div className="order-first md:order-none w-14 h-14 md:w-36 md:h-36 rounded-full flex items-center justify-center">
          {isLocalBadge ? (
            <Image
              src={tierBadge as any}
              alt={tierName}
              className="object-contain w-14 h-14 md:w-36 md:h-36 relative z-10"
            />
          ) : (
             <img
              src={tierBadge as string}
              alt={tierName}
              className="object-contain w-14 h-14 md:w-36 md:h-36 relative z-10"
              onError={(e) => {
                 (e.target as HTMLImageElement).src = BronzeTier.src || BronzeTier;
              }}
             />
          )}
        </div>
      </div>

      <EditPlayerModal
        open={openEdit}
        userId={username}
        initialData={{
          username: data.username || "",
          fullName: data.profile?.fullName || data.name || "",
          // Stored parts win; the composed name is only split for profiles
          // saved before those columns existed.
          ...resolveNameParts({
            firstName: data.profile?.firstName,
            middleName: data.profile?.middleName,
            lastName: data.profile?.lastName,
            fullName: data.profile?.fullName || data.name,
          }),
          displayName: data.profile?.displayName || "",
          phone: data.profile?.phone || "",
          email: data.profile?.email || data.entity || "",
          dob: data.profile?.dateOfBirth
            ? (toCalendarDate(data.profile.dateOfBirth) ?? "")
            : "",
          password: "",
        }}
        onClose={() => setOpenEdit(false)}
        onSubmit={async () => {
          setOpenEdit(false);
          await fetchUser();
        }}
      />
    </div>
  );
}
