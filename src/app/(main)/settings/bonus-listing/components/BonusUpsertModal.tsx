"use client";

import { CircleHelp, X, Upload, Trash2, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  BonusRewardCurrency,
  BonusType,
  FreeSpinWinningsTarget,
  PlayerStatus,
  WageringType,
  CreateBonusDto,
} from "@/types/bonus";
import { systemConfigApi } from "@/api/system-config/system-config.api";
import { getAllAdminGames, Game as AdminGame } from "@/api/games/games";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import {
  BONUS_IMAGE_PRESETS,
  getBonusDefaultImageForType,
} from "@/config/bonus-image-presets";

interface Props {
  open: boolean;
  initialData?: any | null;
  forcedType?: BonusType;
  /** True when a Profile Complete Bonus already exists — only one is allowed. */
  profileCompleteExists?: boolean;
  /** True when a Welcome Bonus (no deposit) already exists — only one is allowed. */
  welcomeBonusExists?: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBonusDto) => void | Promise<void>;
}

const NAME_MAX_LENGTH = 25;
const DESCRIPTION_MAX_LENGTH = 35;

function capitalizeFirstCharacter(value: string): string {
  if (!value) return value;
  const firstLetterIndex = value.search(/[A-Za-z]/);
  if (firstLetterIndex < 0) return value;
  return (
    value.slice(0, firstLetterIndex) +
    value.charAt(firstLetterIndex).toUpperCase() +
    value.slice(firstLetterIndex + 1)
  );
}

/**
 * Click-to-open help beside a field label. Popover rather than tooltip because
 * several of these run to a few lines and admins need to read them, not hover.
 */
function FieldInfo({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${title} information`}
          className="ml-1.5 inline-flex items-center align-middle text-gray-500 hover:text-purple-400 transition-colors"
        >
          <Info size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={`${
          wide ? "w-96" : "w-72"
        } bg-[#1a2030] border border-gray-700 text-white p-3 z-[60]`}
      >
        <p className="text-xs font-semibold mb-1.5">{title}</p>
        <div className="text-[11px] text-gray-300 leading-5 space-y-1.5">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Label + its info button, so every field reads the same way. */
function InfoLabel({
  text,
  required = false,
  info,
  wide = false,
}: {
  text: string;
  required?: boolean;
  info: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Label className="text-white text-xs">
      {text}
      {required && <span className="text-red-500">*</span>}
      <FieldInfo title={text} wide={wide}>
        {info}
      </FieldInfo>
    </Label>
  );
}

const VIP_TIER_OPTIONS = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Immortal",
];

/**
 * Field values Profile Complete must carry regardless of how it was reached.
 * The Type dropdown applies these on switch; a fresh modal that *opens* on
 * Profile Complete (because the Welcome Bonus slot is taken) needs them too,
 * otherwise it would submit a deposit-shaped payload.
 */
const PROFILE_COMPLETE_DEFAULTS = {
  playerStatus: PlayerStatus.ALL,
  minDeposit: 0,
  matchPercentage: 0,
  wageringMultiplier: 1,
  rewardCurrency: BonusRewardCurrency.WULF_COIN,
} as const;

export default function BonusUpsertModal({
  open,
  initialData,
  forcedType,
  profileCompleteExists = false,
  welcomeBonusExists = false,
  onClose,
  onSubmit,
}: Props) {
  const uploaderRef = useRef<ImageUploaderRef>(null);
  // Deposit Match has no per-type limit, so it is always a safe default.
  const defaultCreateType = BonusType.DEPOSIT_MATCH;
  const initialType = forcedType ?? defaultCreateType;
  const initialImageUrl = getBonusDefaultImageForType(initialType) ?? "";
  const [formData, setFormData] = useState<CreateBonusDto>({
    name: "",
    description: "",
    imageUrl: initialImageUrl,
    type: initialType,
    matchPercentage: undefined,
    cashbackPercentage: undefined,
    minClaimAmount: undefined,
    maxBonus: undefined,
    rewardCurrency: BonusRewardCurrency.WULF_COIN,
    minDeposit: undefined,
    minNetLosses: undefined,
    maxPayout: undefined,
    wageringMultiplier: undefined,
    aleaSoftwareId: undefined,
    aleaGameId: undefined,
    aleaBetLevel: undefined,
    aleaCasinoCampaignId: "",
    aleaGrantExpiresInDays: undefined,
    freeSpinWinningsTarget: FreeSpinWinningsTarget.REAL_SC,
    freeSpinWinningsWageringMultiplier: undefined,
    wageringType: WageringType.BONUS,
    gameWeighting: {
      slots: 100,
      table_games: 10,
      excluded: [],
    },
    validityDays: 30,
    playerStatus: PlayerStatus.NEW,
    vipTierRestriction: [],
    grantWulfCoin: false,
    wulfCoinAmount: undefined,
    kycRequired: false,
    isActive: true,
    startDate: undefined,
    endDate: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [freeSpinGames, setFreeSpinGames] = useState<AdminGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [profileWageringEnabled, setProfileWageringEnabled] = useState(false);
  const checkboxClass =
    "border-gray-500 data-[state=checked]:!bg-[lab(36_55.06_-52.92)] data-[state=checked]:!border-[lab(36_55.06_-52.92)] data-[state=checked]:!text-white focus-visible:ring-2 focus-visible:ring-[lab(36_55.06_-52.92)]/100";
  const selectedImageUrl = (formData.imageUrl ?? "").trim();
  const isPresetImageSelected = BONUS_IMAGE_PRESETS.includes(selectedImageUrl);
  const nameLength = (formData.name ?? "").length;
  const descriptionLength = (formData.description ?? "").length;
  const isNameTooLong = nameLength > NAME_MAX_LENGTH;
  const isDescriptionTooLong = descriptionLength > DESCRIPTION_MAX_LENGTH;
  const isCashbackType = [
    BonusType.HOURLY_RAKEBACK,
    BonusType.DAILY_RAKEBACK,
    BonusType.WEEKLY_RAKEBACK,
    BonusType.MONTHLY_RAKEBACK,
  ].includes(formData.type);

  const freeSpinSoftwareOptions = freeSpinGames.reduce<
    { label: string; softwareId: number }[]
  >((acc, game) => {
    if (game.provider !== "aleaplay") return acc;

    const softwareId = Number(game.providerMetadata?.softwareId ?? 0);
    const label = game.providerMetadata?.softwareName || game.studio || "";
    if (!softwareId || !label) return acc;
    if (acc.some((item) => item.softwareId === softwareId)) return acc;

    acc.push({ softwareId, label });
    return acc.sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const freeSpinGameOptions = freeSpinGames
    .filter((game) => {
      if (game.provider !== "aleaplay") return false;
      if (!formData.aleaSoftwareId) return false;
      return Number(game.providerMetadata?.softwareId ?? 0) === Number(formData.aleaSoftwareId);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedFreeSpinGame = freeSpinGameOptions.find(
    (game) => Number(game.providerGameId ?? 0) === Number(formData.aleaGameId ?? 0)
  );

  useEffect(() => {
    // Don't do anything when the modal is just closing
    if (!open) return;

    if (initialData) {
      setProfileWageringEnabled(Number(initialData.wageringMultiplier ?? 0) > 1);
      setFormData((prev) => {
        const incomingType = forcedType ?? initialData.type ?? prev.type;
        const incomingImageUrl =
          (initialData.imageUrl || "").trim() ||
          getBonusDefaultImageForType(incomingType) ||
          "";

        return {
          ...prev,
          ...initialData,
          type: incomingType,
          imageUrl: incomingImageUrl,
          // Ensure numeric fields are converted from strings to numbers
          matchPercentage: Number(initialData.matchPercentage) || prev.matchPercentage,
          cashbackPercentage: initialData.cashbackPercentage ? Number(initialData.cashbackPercentage) : prev.cashbackPercentage,
          minClaimAmount: initialData.minClaimAmount ? Number(initialData.minClaimAmount) : undefined,
          maxBonus: Number(initialData.maxBonus) || prev.maxBonus,
          rewardCurrency: initialData.rewardCurrency || prev.rewardCurrency,
          minDeposit: Number(initialData.minDeposit) || prev.minDeposit,
          minNetLosses: initialData.minNetLosses ? Number(initialData.minNetLosses) : undefined,
          maxPayout: initialData.maxPayout ? Number(initialData.maxPayout) : undefined,
          wageringMultiplier: Number(initialData.wageringMultiplier) || prev.wageringMultiplier,
          aleaSoftwareId: initialData.aleaSoftwareId ? Number(initialData.aleaSoftwareId) : undefined,
          aleaGameId: initialData.aleaGameId ? Number(initialData.aleaGameId) : undefined,
          aleaBetLevel: initialData.aleaBetLevel ? Number(initialData.aleaBetLevel) : undefined,
          aleaCasinoCampaignId: initialData.aleaCasinoCampaignId || "",
          aleaGrantExpiresInDays: initialData.aleaGrantExpiresInDays
            ? Number(initialData.aleaGrantExpiresInDays)
            : undefined,
          freeSpinWinningsTarget: initialData.freeSpinWinningsTarget || prev.freeSpinWinningsTarget,
          freeSpinWinningsWageringMultiplier: initialData.freeSpinWinningsWageringMultiplier
            ? Number(initialData.freeSpinWinningsWageringMultiplier)
            : undefined,
          validityDays: Number(initialData.validityDays) || prev.validityDays,
          gameWeighting: initialData.gameWeighting || prev.gameWeighting,
          vipTierRestriction: Array.isArray(initialData.vipTierRestriction)
            ? initialData.vipTierRestriction
            : [],
          grantWulfCoin: Boolean(initialData.grantWulfCoin),
          wulfCoinAmount: initialData.wulfCoinAmount
            ? Number(initialData.wulfCoinAmount)
            : undefined,
          startDate: initialData.startDate,
          endDate: initialData.endDate,
        };
      });

    } else {
      setProfileWageringEnabled(false);
      const createType = forcedType ?? defaultCreateType;
      const nextDefaults: CreateBonusDto = {
        name: "",
        description: "",
        imageUrl: getBonusDefaultImageForType(createType) || "",
        type: createType,
        matchPercentage: undefined,
        cashbackPercentage: undefined,
        minClaimAmount: undefined,
        maxBonus: undefined,
        rewardCurrency: BonusRewardCurrency.WULF_COIN,
        minDeposit: undefined,
        minNetLosses: undefined,
        maxPayout: undefined,
        wageringMultiplier: undefined,
        aleaSoftwareId: undefined,
        aleaGameId: undefined,
        aleaBetLevel: undefined,
        aleaCasinoCampaignId: "",
        aleaGrantExpiresInDays: undefined,
        freeSpinWinningsTarget: FreeSpinWinningsTarget.REAL_SC,
        freeSpinWinningsWageringMultiplier: undefined,
        wageringType: WageringType.BONUS,
        gameWeighting: {
          slots: 100,
          table_games: 10,
          excluded: [],
        },
        validityDays: 30,
        playerStatus: PlayerStatus.NEW,
        vipTierRestriction: [],
        grantWulfCoin: false,
        wulfCoinAmount: undefined,
        kycRequired: false,
        isActive: true,
        startDate: undefined,
        endDate: undefined,
        ...(createType === BonusType.PROFILE_COMPLETE
          ? PROFILE_COMPLETE_DEFAULTS
          : {}),
      };

      setFormData(nextDefaults);
      void (async () => {
        try {
          const response = await systemConfigApi.get();
          const bonusDefaults = response.config.bonus_defaults;

          setFormData((prev) => ({
            ...prev,
            // Profile Complete pins its own multiplier (1 = no wagering until
            // the admin opts in), so the system default must not overwrite it.
            wageringMultiplier:
              prev.type !== BonusType.PROFILE_COMPLETE &&
              typeof bonusDefaults.default_wagering_multiplier === "number"
                ? bonusDefaults.default_wagering_multiplier
                : prev.wageringMultiplier,
            kycRequired:
              typeof bonusDefaults.default_kyc_required === "boolean"
                ? bonusDefaults.default_kyc_required
                : prev.kycRequired,
          }));
        } catch {
          // Keep local defaults if config fetch fails.
        }
      })();
    }
  }, [open, initialData, forcedType, defaultCreateType]);

  useEffect(() => {
    if (!open) return;

    const shouldLoadFreeSpinCatalog =
      forcedType === BonusType.FREE_SPINS ||
      initialData?.type === BonusType.FREE_SPINS ||
      formData.type === BonusType.FREE_SPINS;

    if (!shouldLoadFreeSpinCatalog || freeSpinGames.length > 0) return;

    let cancelled = false;
    const loadFreeSpinCatalog = async () => {
      try {
        setGamesLoading(true);
        const games = await getAllAdminGames({ provider: "aleaplay" });
        if (!cancelled) {
          setFreeSpinGames(games.filter((game) => game.provider === "aleaplay"));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load free spin game catalog:", error);
          toast.error("Failed to load free spin game options");
        }
      } finally {
        if (!cancelled) {
          setGamesLoading(false);
        }
      }
    };

    loadFreeSpinCatalog();

    return () => {
      cancelled = true;
    };
  }, [open, forcedType, initialData?.type, formData.type, freeSpinGames.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="w-full max-w-6xl h-[90vh] bg-[#15181E] rounded-xl p-6 relative flex flex-col">
        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white text-lg font-medium">
            {initialData ? "Edit" : "Create new"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* ================= BODY (SCROLL) ================= */}
        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* ================= LEFT COLUMN ================= */}
            <div className="contents">
              {/* Name and Description are shown for every type, Profile Complete
                  included — they are the heading and subtitle on the player's
                  bonus card, which used to render blank for it. */}
              <div>
                  <Label className="text-white text-xs">
                    Name<span className="text-red-500">*</span>
                  </Label>
                  <input
                    className={`w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm ${
                      isNameTooLong ? "ring-1 ring-red-500" : ""
                    }`}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: capitalizeFirstCharacter(e.target.value),
                      })
                    }
                    placeholder="e.g., Welcome Deposit 5 Match"
                  />
                  <p className={`mt-1 text-xs ${isNameTooLong ? "text-red-400" : "text-gray-400"}`}>
                    {nameLength}/{NAME_MAX_LENGTH}
                  </p>
              </div>

              <div>
                  <Label className="text-white text-xs">Description</Label>
                  <Textarea
                    className={`w-full mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm min-h-[80px] ${
                      isDescriptionTooLong ? "ring-1 ring-red-500" : ""
                    }`}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: capitalizeFirstCharacter(e.target.value),
                      })
                    }
                    placeholder="100% match up to $500"
                  />
                  <p
                    className={`mt-1 text-xs ${
                      isDescriptionTooLong ? "text-red-400" : "text-gray-400"
                    }`}
                  >
                    {descriptionLength}/{DESCRIPTION_MAX_LENGTH}
                  </p>
              </div>

              <div className="w-full">
                <Label className="text-white text-xs">
                  Type<span className="text-red-500">*</span>
                </Label>

                <Select
                  value={formData.type}
                  disabled={!!forcedType}
                  onValueChange={(v) => {
                    const newType = v as BonusType;
                    const updates: any = { type: newType };
                    const typeDefaultImage = getBonusDefaultImageForType(newType);

                    if (typeDefaultImage) {
                      updates.imageUrl = typeDefaultImage;
                    }
                    
                    // If switching to reload bonus and player status is NEW, change to EXISTING
                    if (newType === BonusType.RELOAD_BONUS && formData.playerStatus === PlayerStatus.NEW) {
                      updates.playerStatus = PlayerStatus.EXISTING;
                      updates.matchPercentage = 0;
                    }
                    
                    // If switching to no-deposit or free spins, set to NEW and minDeposit to 0
                    if (newType === BonusType.NO_DEPOSIT || newType === BonusType.FREE_SPINS) {
                      updates.minDeposit = 0;
                      updates.playerStatus = PlayerStatus.NEW;
                    }

                    // Welcome Bonus has no deposit to match — the payout is the
                    // flat Bonus Amount, so the hidden percentage submits as 0.
                    if (newType === BonusType.NO_DEPOSIT) {
                      updates.matchPercentage = 0;
                    }

                    // Profile completion bonus is a system reward config (not a claimable user bonus card).
                    if (newType === BonusType.PROFILE_COMPLETE) {
                      updates.playerStatus = PlayerStatus.ALL;
                      updates.minDeposit = 0;
                      updates.matchPercentage = 0;
                      updates.wageringMultiplier = 1;
                      updates.rewardCurrency = BonusRewardCurrency.WULF_COIN;
                      setProfileWageringEnabled(false);
                    }

                    if (
                      newType === BonusType.HOURLY_RAKEBACK ||
                      newType === BonusType.DAILY_RAKEBACK ||
                      newType === BonusType.WEEKLY_RAKEBACK ||
                      newType === BonusType.MONTHLY_RAKEBACK
                    ) {
                      updates.playerStatus = PlayerStatus.ALL;
                    }
                    
                    setFormData({ ...formData, ...updates });
                  }}
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>

                  <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                    <SelectItem value={BonusType.DEPOSIT_MATCH}>Deposit Match</SelectItem>
                    {/* <SelectItem value={BonusType.FREE_SPINS}>Free Spins</SelectItem> */}
                    {/* <SelectItem value={BonusType.RELOAD_BONUS}>Reload Bonus</SelectItem> */}
                    {/* Welcome Bonus is the single no-deposit signup offer: only
                        one may exist, so it drops off this list once created and
                        comes back as soon as that one is deleted. Stays listed
                        while editing the existing one so its Type never blanks. */}
                    {(!welcomeBonusExists ||
                      initialData?.type === BonusType.NO_DEPOSIT) && (
                      <SelectItem value={BonusType.NO_DEPOSIT}>Welcome Bonus</SelectItem>
                    )}
                    {/* Retired types stay selectable only while editing a bonus that
                        already uses them — without this the Type field renders blank
                        and saving would silently drop the type. */}
                    {formData.type === BonusType.RELOAD_BONUS && (
                      <SelectItem value={BonusType.RELOAD_BONUS}>Reload Bonus</SelectItem>
                    )}
                    {/* Only one Profile Complete Bonus may exist. Stays listed
                        while editing the existing one so its Type never blanks. */}
                    {(!profileCompleteExists ||
                      initialData?.type === BonusType.PROFILE_COMPLETE) && (
                      <SelectItem value={BonusType.PROFILE_COMPLETE}>
                        Profile Complete Bonus
                      </SelectItem>
                    )}
                    {/* <SelectItem value={BonusType.LOSSBACK}>
                      Cashback on Net Losses (Lossback)
                    </SelectItem> */}
                    {/* Cashback records are created and driven by the cashback
                        service; they are configured in VIP Tier Rewards, not here.
                        Kept selectable only while editing an existing one so the
                        Type field never renders blank. */}
                    {formData.type === BonusType.HOURLY_RAKEBACK && (
                      <SelectItem value={BonusType.HOURLY_RAKEBACK}>Hourly Cashback</SelectItem>
                    )}
                    {formData.type === BonusType.DAILY_RAKEBACK && (
                      <SelectItem value={BonusType.DAILY_RAKEBACK}>Daily Cashback</SelectItem>
                    )}
                    {formData.type === BonusType.WEEKLY_RAKEBACK && (
                      <SelectItem value={BonusType.WEEKLY_RAKEBACK}>Weekly Cashback</SelectItem>
                    )}
                    {formData.type === BonusType.MONTHLY_RAKEBACK && (
                      <SelectItem value={BonusType.MONTHLY_RAKEBACK}>Monthly Cashback</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                
                {(formData.type === BonusType.NO_DEPOSIT || formData.type === BonusType.FREE_SPINS) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formData.type === BonusType.NO_DEPOSIT 
                      ? "No deposit required - players receive bonus automatically" 
                      : "No deposit required - players receive free spins"}
                  </p>
                )}
                {formData.type === BonusType.PROFILE_COMPLETE && (
                  <p className="text-xs text-gray-400 mt-1">
                    Granted automatically once the player completes their profile. Its card is listed on the player bonus page and links there.
                  </p>
                )}
              </div>


            </div>

            {/* ================= RIGHT COLUMN ================= */}
            <div className="contents">
              {formData.type !== BonusType.PROFILE_COMPLETE && !isCashbackType && (
              <div className="w-full">
                <Label className="text-white text-xs">
                  Player Status<span className="text-red-500">*</span>
                </Label>
                {(formData.type === BonusType.NO_DEPOSIT || formData.type === BonusType.FREE_SPINS) && (
                  <p className="text-xs text-gray-400 mt-1">
                    No-deposit bonuses are for new players only
                  </p>
                )}

                {/* Reload has exactly one valid audience, so the dropdown would be a
                    single-option click. Show the fixed value instead. */}
                {formData.type === BonusType.RELOAD_BONUS ? (
                  <>
                    <div className="w-full h-10 mt-1 flex items-center rounded-lg bg-[#242B35] px-3 text-sm text-gray-300">
                      Existing
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Reload bonuses are for returning players only
                    </p>
                  </>
                ) : (
                <Select
                  value={formData.playerStatus}
                  onValueChange={(v) =>
                    setFormData({ ...formData, playerStatus: v as PlayerStatus })
                  }
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                    <SelectValue placeholder="Select player status" />
                  </SelectTrigger>

                  <SelectContent className="w-full">
                    <SelectItem value={PlayerStatus.NEW}>New</SelectItem>
                    {formData.type !== BonusType.NO_DEPOSIT &&
                      formData.type !== BonusType.FREE_SPINS && (
                      <SelectItem value={PlayerStatus.EXISTING}>Existing</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                )}
              </div>
              )}

              {/* VIP Tier restriction — not offered for Profile Complete: that
                  reward is granted by awardProfileCompletionReward(), which never
                  checks the restriction, and every player completing a profile is
                  on the lowest tier anyway. Showing it would imply a gate that
                  does not exist. */}
              {formData.type !== BonusType.PROFILE_COMPLETE && (
              <div className="md:col-span-2">
                <InfoLabel
                  text="VIP Tier Restriction"
                  info={
                    <>
                      <p>
                        A whitelist, not a minimum. Checking Bronze means{" "}
                        <em>only</em> Bronze players get this bonus — Silver and above
                        lose it.
                      </p>
                      <p>
                        Leave everything unchecked for "available to every tier" —
                        that is the normal setting.
                      </p>
                      <p>
                        Matching is by tier name and ignores level, so Bronze covers
                        Bronze 1, 2 and 3. Enforced both in the player's bonus list
                        and again at claim time.
                      </p>
                    </>
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  Leave all unchecked = available to every tier. Check tiers to restrict this bonus.
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {VIP_TIER_OPTIONS.map((tier) => {
                    const selected = (formData.vipTierRestriction ?? []).includes(tier);
                    return (
                      <label
                        key={tier}
                        className="flex items-center gap-2 rounded-md bg-[#242B35] px-3 py-2 text-sm text-white cursor-pointer"
                      >
                        <Checkbox
                          className={checkboxClass}
                          checked={selected}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => {
                              const current = prev.vipTierRestriction ?? [];
                              const next = checked
                                ? [...current, tier]
                                : current.filter((t) => t !== tier);
                              return { ...prev, vipTierRestriction: next };
                            });
                          }}
                        />
                        {tier}
                      </label>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Wulf Coin grant */}
              <div className="md:col-span-2 rounded-md border border-gray-700 bg-[#1b212b] p-3">
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <Checkbox
                    className={checkboxClass}
                    checked={Boolean(formData.grantWulfCoin)}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        grantWulfCoin: Boolean(checked),
                        wulfCoinAmount: checked ? prev.wulfCoinAmount : undefined,
                      }))
                    }
                  />
                  Also grant Wulf Coin on claim
                </label>
                {formData.grantWulfCoin && (
                  <div className="mt-3">
                    <Label className="text-white text-xs">
                      Wulf Coin Amount<span className="text-red-500">*</span>
                    </Label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      onWheel={(e) => e.currentTarget.blur()}
                      value={formData.wulfCoinAmount ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          wulfCoinAmount:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                      placeholder="e.g. 5000"
                      className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Flat Wulf Coin credited instantly when this bonus is claimed.
                    </p>
                  </div>
                )}
              </div>

              {!isCashbackType && (
              <div>
                <Label className="text-white text-xs">
                  Start Date<span className="text-red-500">*</span>
                </Label>
                <input
                  type="datetime-local"
                  className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm"
                  value={
                    formData.startDate
                      ? new Date(formData.startDate).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const newStartDate = e.target.value
                      ? (new Date(e.target.value) as any)
                      : undefined;
                    setFormData((prev) => {
                      let nextEndDate = prev.endDate;
                      if (newStartDate && prev.endDate && new Date(prev.endDate) < new Date(newStartDate)) {
                        nextEndDate = newStartDate;
                      }
                      return {
                        ...prev,
                        startDate: newStartDate,
                        endDate: nextEndDate,
                      };
                    });
                  }}
                />
              </div>
              )}

              {!isCashbackType && (
              <div>
                <Label className="text-white text-xs">
                  End Date<span className="text-red-500">*</span>
                </Label>
                <input
                  type="datetime-local"
                  className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm"
                  min={
                    formData.startDate
                      ? new Date(formData.startDate).toISOString().slice(0, 16)
                      : new Date().toISOString().slice(0, 16)
                  }
                  value={
                    formData.endDate
                      ? new Date(formData.endDate).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      endDate: e.target.value
                        ? (new Date(e.target.value) as any)
                        : undefined,
                    })
                  }
                />
              </div>
              )}

              <div>
                {/* Same stored field either way: a ceiling on a percentage for
                    deposit bonuses, but the flat payout for Profile Complete
                    and the Welcome (no-deposit) Bonus. */}
                <Label className="text-white text-xs">
                  {formData.type === BonusType.PROFILE_COMPLETE ||
                  formData.type === BonusType.NO_DEPOSIT
                    ? "Bonus Amount"
                    : "Max Bonus"}
                  <span className="text-red-500">*</span>
                </Label>
                <input
                  type="number"
                  className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onWheel={(e) => e.currentTarget.blur()}
                  value={formData.maxBonus ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxBonus: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder={
                    formData.type === BonusType.PROFILE_COMPLETE ? "20" : "500"
                  }
                />
                {formData.type === BonusType.PROFILE_COMPLETE && (
                  <p className="text-xs text-gray-400 mt-1">
                    Flat amount credited when the player completes their profile.
                  </p>
                )}
                {formData.type === BonusType.NO_DEPOSIT && (
                  <p className="text-xs text-gray-400 mt-1">
                    Flat amount credited automatically to new players — no
                    deposit, nothing to match.
                  </p>
                )}
              </div>

              {formData.type !== BonusType.HOURLY_RAKEBACK &&
               formData.type !== BonusType.DAILY_RAKEBACK &&
               formData.type !== BonusType.WEEKLY_RAKEBACK &&
               formData.type !== BonusType.MONTHLY_RAKEBACK &&
               formData.type !== BonusType.PROFILE_COMPLETE && (
                <div className="w-full">
                <Label className="text-white text-xs">
                  Wagering Type<span className="text-red-500">*</span>
                </Label>

                <Select
                  value={WageringType.BONUS}
                  onValueChange={() =>
                    setFormData({ ...formData, wageringType: WageringType.BONUS })
                  }
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                    <SelectValue placeholder="Select wagering type" />
                  </SelectTrigger>

                  <SelectContent className="w-full">
                    <SelectItem value={WageringType.BONUS}>Bonus</SelectItem>
                  </SelectContent>
                </Select>
                </div>
              )}
            </div>
            <div className="contents">
              {/* Welcome (no-deposit) has no deposit to match — percentage field
                  is meaningless there, the flat Bonus Amount is the payout. */}
              {formData.type !== BonusType.PROFILE_COMPLETE &&
               formData.type !== BonusType.NO_DEPOSIT && (
              <div>
                {(
                  formData.type === BonusType.HOURLY_RAKEBACK ||
                  formData.type === BonusType.DAILY_RAKEBACK ||
                  formData.type === BonusType.WEEKLY_RAKEBACK ||
                  formData.type === BonusType.MONTHLY_RAKEBACK
                ) ? (
                  <>
                    <Label className="text-white text-xs">Cashback Percentage (%)<span className="text-red-500">*</span></Label>
                    <p className="text-xs text-gray-400 mt-1">
                      Cashback percentage comes from VIP tier reward only.
                    </p>
                  </>
                ) : (
                  <>
                    <Label className="text-white text-xs">
                      {formData.type === BonusType.LOSSBACK ? 'Lossback Percentage (%)' : 'Match Percentage (%)'}<span className="text-red-500">*</span>
                    </Label>
                    {(
                      <input
                        type="number"
                        className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        onWheel={(e) => e.currentTarget.blur()}
                        value={formData.matchPercentage ?? ""}
                        disabled={formData.type === BonusType.RELOAD_BONUS}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            matchPercentage: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder={formData.type === BonusType.LOSSBACK ? '10' : '100'}
                      />
                    )}
                    {formData.type === BonusType.RELOAD_BONUS && (
                      <p className="text-xs text-gray-400 mt-1">
                        Reload bonus percentage is dynamic and comes from VIP Tier Rewards - Deposit Bonus rate.
                      </p>
                    )}
                    {formData.type === BonusType.DEPOSIT_MATCH && (
                      <p className="text-xs text-gray-400 mt-1">
                        Percentage of the deposit paid as bonus, capped by Max Bonus.
                      </p>
                    )}
                  </>
                )}
              </div>
              )}

              {/* Minimum Claim Amount - Only for Cashback bonuses */}
              {(
                formData.type === BonusType.HOURLY_RAKEBACK ||
                formData.type === BonusType.DAILY_RAKEBACK ||
                formData.type === BonusType.WEEKLY_RAKEBACK ||
                formData.type === BonusType.MONTHLY_RAKEBACK
              ) && (
                <div>
                  <Label className="text-white text-xs">Minimum Claim Amount<span className="text-red-500">*</span></Label>
                  <input
                    type="number"
                    className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={formData.minClaimAmount as any || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minClaimAmount: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Minimum amount users must accumulate before claiming
                  </p>
                </div>
              )}

              {formData.type === BonusType.PROFILE_COMPLETE && (
                <div className="w-full">
                  <Label className="text-white text-xs">
                    Bonus Amount In<span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.rewardCurrency ?? BonusRewardCurrency.WULF_COIN}
                    onValueChange={(v) => {
                      const nextCurrency = v as BonusRewardCurrency;
                      // Wulf Coin has no rollover and cannot be withdrawn, so a
                      // playthrough on it is meaningless — clear it rather than
                      // leave a stale multiplier the backend would ignore.
                      if (nextCurrency === BonusRewardCurrency.WULF_COIN) {
                        setProfileWageringEnabled(false);
                      }
                      setFormData((prev) => ({
                        ...prev,
                        rewardCurrency: nextCurrency,
                        wageringMultiplier:
                          nextCurrency === BonusRewardCurrency.WULF_COIN
                            ? 1
                            : prev.wageringMultiplier,
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value={BonusRewardCurrency.WULF_COIN}>Wulf Coin</SelectItem>
                      <SelectItem value={BonusRewardCurrency.WULF_CASH}>Wulf Cash</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.rewardCurrency === BonusRewardCurrency.WULF_COIN && (
                    <p className="text-xs text-gray-400 mt-1">
                      Wulf Coin is play money — no wagering applies and it cannot be
                      withdrawn.
                    </p>
                  )}
                </div>
              )}

              {/* Wagering is Wulf Cash only — see the currency note above. */}
              {formData.type === BonusType.PROFILE_COMPLETE &&
                formData.rewardCurrency !== BonusRewardCurrency.WULF_COIN && (
                <div className="md:col-span-2 rounded-md border border-gray-700 bg-[#1b212b] p-3">
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <Checkbox
                      className={checkboxClass}
                      checked={profileWageringEnabled}
                      onCheckedChange={(checked) => {
                        const enabled = Boolean(checked);
                        setProfileWageringEnabled(enabled);
                        setFormData((prev) => ({
                          ...prev,
                          wageringMultiplier: enabled
                            ? (Number(prev.wageringMultiplier ?? 0) > 1
                                ? prev.wageringMultiplier
                                : 20)
                            : 1,
                        }));
                      }}
                    />
                    Enable Wagering
                  </label>
                  {profileWageringEnabled && (
                    <div className="mt-3">
                      <Label className="text-white text-xs">
                        Wagering Multiplier<span className="text-red-500">*</span>
                      </Label>
                      <input
                        type="number"
                        min={1}
                        step="1"
                        onWheel={(e) => e.currentTarget.blur()}
                        value={formData.wageringMultiplier ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            wageringMultiplier:
                              e.target.value === "" ? undefined : Number(e.target.value),
                          }))
                        }
                        placeholder="e.g. 20"
                        className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Playthrough required before winnings from this bonus can be withdrawn (e.g. 20 = 20x). Leave disabled for no wagering.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {formData.type !== BonusType.LOSSBACK && 
               formData.type !== BonusType.NO_DEPOSIT && 
               formData.type !== BonusType.FREE_SPINS &&
               formData.type !== BonusType.PROFILE_COMPLETE &&
               formData.type !== BonusType.HOURLY_RAKEBACK &&
               formData.type !== BonusType.DAILY_RAKEBACK &&
               formData.type !== BonusType.WEEKLY_RAKEBACK &&
               formData.type !== BonusType.MONTHLY_RAKEBACK && (
                <div>
                  <Label className="text-white text-xs">
                    Min Deposit<span className="text-red-500">*</span>
                  </Label>
                  <input
                    type="number"
                    className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onWheel={(e) => e.currentTarget.blur()}
                    value={formData.minDeposit ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minDeposit: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="10"
                  />
                </div>
              )}

              {formData.type === BonusType.LOSSBACK && (
                <div>
                  <Label className="text-white text-xs">
                    Min Net Losses<span className="text-red-500">*</span>
                  </Label>
                  <input
                    type="number"
                    className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"                  onWheel={(e) => e.currentTarget.blur()}                    value={formData.minNetLosses || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minNetLosses: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="50"
                  />
                </div>
              )}

              {formData.type === BonusType.FREE_SPINS && (
                <div>
                  <Label className="text-white text-xs">
                    Number of Free Spins<span className="text-red-500">*</span>
                  </Label>
                  <input
                    type="number"
                    className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onWheel={(e) => e.currentTarget.blur()}
                    value={formData.freeSpins || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        freeSpins: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="20"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Total value calculated as: spins × spin value (stored in Max Bonus)
                  </p>
                </div>
              )}

              {formData.type === BonusType.FREE_SPINS && (
                <div className="w-full">
                  <Label className="text-white text-xs">
                    Software Provider<span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.aleaSoftwareId ? String(formData.aleaSoftwareId) : undefined}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        aleaSoftwareId: Number(value),
                        aleaGameId: undefined,
                      })
                    }
                  >
                    <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white mt-1">
                      <SelectValue placeholder={gamesLoading ? "Loading providers..." : "Select software provider"} />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      {freeSpinSoftwareOptions.map((option) => (
                        <SelectItem key={option.softwareId} value={String(option.softwareId)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-1">
                    Provider/software options are sourced from the current synced free-spin game catalog.
                  </p>
                </div>
              )}

              {formData.type === BonusType.FREE_SPINS && (
                <div className="w-full">
                  <Label className="text-white text-xs">
                    Game<span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.aleaGameId ? String(formData.aleaGameId) : undefined}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        aleaGameId: Number(value),
                      })
                    }
                    disabled={!formData.aleaSoftwareId}
                  >
                    <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white mt-1">
                      <SelectValue
                        placeholder={
                          !formData.aleaSoftwareId
                            ? "Select software provider first"
                            : gamesLoading
                            ? "Loading games..."
                            : "Select game"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      {freeSpinGameOptions.map((game) => (
                        <SelectItem key={game.id} value={String(game.providerGameId)}>
                          {game.name} ({game.providerGameId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedFreeSpinGame && (
                    <p className="text-xs text-gray-400 mt-1">
                      Selected game ID: {selectedFreeSpinGame.providerGameId}
                    </p>
                  )}
                </div>
              )}

              {formData.type === BonusType.FREE_SPINS && (
                <div>
                  <div className="flex items-center gap-2">
                    <Label className="text-white text-xs">
                      Bet Level<span className="text-red-500">*</span>
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-white"
                          aria-label="Bet level information"
                        >
                          <CircleHelp size={14} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64 bg-[#242B35] text-white border border-gray-700">
                        Bet level controls the provider-defined stake profile for each free spin.
                        Levels range from 1 to 5. The actual spin value depends on the mapped game
                        and provider configuration, not just the level number alone.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={formData.aleaBetLevel ? String(formData.aleaBetLevel) : undefined}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        aleaBetLevel: Number(value),
                      })
                    }
                  >
                    <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white mt-1">
                      <SelectValue placeholder="Select bet level" />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value="1">Level 1</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3</SelectItem>
                      <SelectItem value="4">Level 4</SelectItem>
                      <SelectItem value="5">Level 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.type === BonusType.FREE_SPINS && (
                <div>
                  <Label className="text-white text-xs">Campaign Reference ID</Label>
                  <input
                    className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm"
                    value={formData.aleaCasinoCampaignId ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        aleaCasinoCampaignId: e.target.value,
                      })
                    }
                    placeholder="Optional"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Optional provider-side campaign reference used to group similar free-spin grants for reporting and support.
                  </p>
                </div>
              )}

              {formData.type === BonusType.FREE_SPINS && (
                <div>
                  <Label className="text-white text-xs">Grant Expires In Days</Label>
                  <input
                    type="number"
                    className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onWheel={(e) => e.currentTarget.blur()}
                    value={formData.aleaGrantExpiresInDays ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        aleaGrantExpiresInDays:
                          e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="Uses bonus validity if left blank"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Optional override for how long the granted spins remain usable after claim. If empty, the bonus validity window is used.
                  </p>
                </div>
              )}

              {formData.type === BonusType.FREE_SPINS && (
                <div className="w-full">
                  <Label className="text-white text-xs">
                    Free Spin Winnings Credit Target<span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.freeSpinWinningsTarget}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        freeSpinWinningsTarget: v as FreeSpinWinningsTarget,
                        freeSpinWinningsWageringMultiplier:
                          v === FreeSpinWinningsTarget.BONUS_SC
                            ? formData.freeSpinWinningsWageringMultiplier
                            : undefined,
                      })
                    }
                  >
                    <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                      <SelectValue placeholder="Select credit target" />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value={FreeSpinWinningsTarget.REAL_SC}>Wulf Cash</SelectItem>
                      <SelectItem value={FreeSpinWinningsTarget.BONUS_SC}>Wulf Coin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.type === BonusType.FREE_SPINS &&
                formData.freeSpinWinningsTarget === FreeSpinWinningsTarget.BONUS_SC && (
                <div>
                  <Label className="text-white text-xs">
                    Extra Playthrough On Winnings<span className="text-red-500">*</span>
                  </Label>
                  <input
                    type="number"
                    className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onWheel={(e) => e.currentTarget.blur()}
                    value={formData.freeSpinWinningsWageringMultiplier ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        freeSpinWinningsWageringMultiplier:
                          e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="10"
                  />
                </div>
              )}

              {formData.type !== BonusType.PROFILE_COMPLETE && !isCashbackType && (
                <div>
                  <Label className="text-white text-xs">
                    Wagering Multiplier<span className="text-red-500">*</span>
                  </Label>
                  <input
                    type="number"
                    className="w-full h-10 mt-1 bg-[#242B35] rounded-lg px-3 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onWheel={(e) => e.currentTarget.blur()}
                    value={formData.wageringMultiplier ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wageringMultiplier: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="20"
                  />
                </div>
              )}

              {/* Shown for every type, Profile Complete included — its card
                  appears on the player bonus page, so it needs artwork. */}
              <div className="md:col-span-2">
                  <Label className="text-white text-xs">Bonus Image</Label>
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between bg-[#1F2630] p-3 rounded-md min-h-[100px]">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded bg-[#252B35] overflow-hidden flex items-center justify-center">
                          {selectedImageUrl ? (
                            <img
                              src={selectedImageUrl}
                              alt="Bonus preview"
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <span className="text-[10px] text-gray-400">No image</span>
                          )}
                        </div>
                        <div className="text-sm">
                          <p className="text-white font-medium">
                            {selectedImageUrl
                              ? isPresetImageSelected
                                ? "Preset Image"
                                : "Custom Upload"
                              : "No Image Selected"}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {selectedImageUrl
                              ? isPresetImageSelected
                                ? "Using selected preset image"
                                : "Using your uploaded image"
                              : "Select a preset or upload custom image"}
                          </p>
                        </div>
                      </div>

                      {selectedImageUrl && (
                        <Trash2
                          className="cursor-pointer text-gray-400 hover:text-red-400 transition-colors"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              imageUrl: getBonusDefaultImageForType(formData.type) || "",
                            })
                          }
                        />
                      )}
                    </div>

                    <div>
                      <Label className="text-white text-xs mb-2 block">
                        Select Preset Image
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {BONUS_IMAGE_PRESETS.map((presetUrl, index) => {
                          const isSelected = selectedImageUrl === presetUrl;
                          return (
                            <button
                              key={presetUrl}
                              type="button"
                              onClick={() =>
                                setFormData({ ...formData, imageUrl: presetUrl })
                              }
                              className={`relative h-20 md:h-24 rounded-lg overflow-hidden border bg-[#252B35] transition-colors ${
                                isSelected
                                  ? "border-purple-500 ring-1 ring-purple-500/40"
                                  : "border-gray-700 hover:border-gray-500"
                              }`}
                              aria-label={`Select bonus preset image ${index + 1}`}
                            >
                              <img
                                src={presetUrl}
                                alt={`Bonus preset ${index + 1}`}
                                className="w-full h-full object-contain p-1"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="gap-2 h-10 w-full"
                      onClick={() => {
                        uploaderRef.current?.open();
                      }}
                    >
                      <Upload size={14} /> Upload Custom Image
                    </Button>
                  </div>
              </div>

              {formData.type !== BonusType.PROFILE_COMPLETE && (
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 min-h-6">
                    <Checkbox
                      id="kycRequired"
                      checked={formData.kycRequired}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, kycRequired: checked as boolean })
                      }
                      className={`${checkboxClass} shrink-0`}
                    />
                    <Label
                      htmlFor="kycRequired"
                      className="text-white text-xs leading-5 whitespace-nowrap cursor-pointer"
                    >
                      KYC Required
                    </Label>
                  </div>

                  {/* Cashback bonuses are switched on/off from VIP Tier Rewards,
                      so the record itself must always stay active. */}
                  {!isCashbackType && (
                    <div className="flex items-center gap-2 min-h-6">
                      <Checkbox
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, isActive: checked as boolean })
                        }
                        className={`${checkboxClass} shrink-0`}
                      />
                      <Label
                        htmlFor="isActive"
                        className="text-white text-xs leading-5 whitespace-nowrap cursor-pointer"
                      >
                        Is Active
                      </Label>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ================= FOOTER (UNCHANGED) ================= */}
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            className="border-gray-600 text-white"
            onClick={() => {
              onClose();
            }}
          >
            Cancel
          </Button>

          <Button
            className="!bg-[lab(36_55.06_-52.92)] text-white hover:opacity-90 min-w-[100px]"
            disabled={isLoading}
            onClick={async () => {
              // Validate required fields
              if (
                formData.type !== BonusType.PROFILE_COMPLETE &&
                !formData.name?.trim()
              ) {
                toast.error("Name is required");
                return;
              }
              if (formData.type !== BonusType.PROFILE_COMPLETE && isNameTooLong) {
                toast.error(`Name cannot exceed ${NAME_MAX_LENGTH} characters`);
                return;
              }
              if (isDescriptionTooLong) {
                toast.error(`Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`);
                return;
              }
              if (!formData.type) {
                toast.error("Type is required");
                return;
              }
              if (
                !initialData &&
                formData.type === BonusType.PROFILE_COMPLETE &&
                profileCompleteExists
              ) {
                toast.error(
                  "A Profile Complete Bonus already exists. Edit the existing one instead — only one is allowed.",
                );
                return;
              }
              const isCashback = [
                BonusType.HOURLY_RAKEBACK,
                BonusType.DAILY_RAKEBACK,
                BonusType.WEEKLY_RAKEBACK,
                BonusType.MONTHLY_RAKEBACK,
              ].includes(formData.type);

              if (!isCashback) {
                if (!formData.startDate) {
                  toast.error("Start Date is required");
                  return;
                }
                if (!formData.endDate) {
                  toast.error("End Date is required");
                  return;
                }
                // Validate end date is after start date
                if (formData.endDate <= formData.startDate) {
                  toast.error("End Date must be after Start Date");
                  return;
                }
              }
              // Validate cashback vs match percentage
              if (isCashback) {
                if (formData.minClaimAmount === undefined || formData.minClaimAmount === null || formData.minClaimAmount <= 0) {
                  toast.error("Minimum Claim Amount is required and must be greater than 0");
                  return;
                }
              } else {
                // Match percentage validation (allow 0 for no-deposit bonuses)
                if (
                  formData.type !== BonusType.NO_DEPOSIT &&
                  formData.type !== BonusType.FREE_SPINS &&
                  formData.type !== BonusType.RELOAD_BONUS &&
                  formData.type !== BonusType.PROFILE_COMPLETE
                ) {
                  if (!formData.matchPercentage || formData.matchPercentage <= 0) {
                    toast.error(formData.type === BonusType.LOSSBACK ? "Lossback Percentage is required and must be greater than 0" : "Match Percentage is required and must be greater than 0");
                    return;
                  }
                }
              }
              if (!formData.maxBonus || formData.maxBonus <= 0) {
                toast.error(
                  formData.type === BonusType.PROFILE_COMPLETE ||
                  formData.type === BonusType.NO_DEPOSIT
                    ? "Bonus Amount is required and must be greater than 0"
                    : "Max Bonus is required and must be greater than 0",
                );
                return;
              }
              
              // Validate based on bonus type
              if (formData.type === BonusType.LOSSBACK) {
                if (!formData.minNetLosses || formData.minNetLosses <= 0) {
                  toast.error("Min Net Losses is required and must be greater than 0");
                  return;
                }
              } else if (formData.type === BonusType.FREE_SPINS) {
                // For free spins, require freeSpins > 0
                if (!formData.freeSpins || formData.freeSpins <= 0) {
                  toast.error("Number of Free Spins is required and must be greater than 0");
                  return;
                }
                if (!formData.aleaSoftwareId || formData.aleaSoftwareId <= 0) {
                  toast.error("Software provider is required for free spins");
                  return;
                }
                if (!formData.aleaGameId || formData.aleaGameId <= 0) {
                  toast.error("Game selection is required for free spins");
                  return;
                }
                if (!formData.aleaBetLevel || formData.aleaBetLevel < 1 || formData.aleaBetLevel > 5) {
                  toast.error("Bet level is required and must be between 1 and 5");
                  return;
                }
                if (
                  formData.freeSpinWinningsTarget === FreeSpinWinningsTarget.BONUS_SC &&
                  (!formData.freeSpinWinningsWageringMultiplier || formData.freeSpinWinningsWageringMultiplier <= 0)
                ) {
                  toast.error("Extra playthrough is required and must be greater than 0 when Wulf Coin is selected");
                  return;
                }
              } else if (
                !isCashback &&
                formData.type !== BonusType.NO_DEPOSIT &&
                formData.type !== BonusType.PROFILE_COMPLETE
              ) {
                // For deposit-based bonuses, require minDeposit > 0
                if (!formData.minDeposit || formData.minDeposit <= 0) {
                  toast.error("Min Deposit is required and must be greater than 0");
                  return;
                }
              }
              // No-deposit bonuses don't need minDeposit validation (it's 0)
              
              if (
                formData.type !== BonusType.PROFILE_COMPLETE &&
                !isCashback &&
                (!formData.wageringMultiplier || formData.wageringMultiplier <= 0)
              ) {
                toast.error("Wagering Multiplier is required and must be greater than 0");
                return;
              }
              if (
                formData.type === BonusType.PROFILE_COMPLETE &&
                profileWageringEnabled &&
                (!formData.wageringMultiplier || formData.wageringMultiplier <= 0)
              ) {
                toast.error("Wagering Multiplier is required and must be greater than 0 when wagering is enabled");
                return;
              }

              // Ensure all numeric fields are properly converted before submitting
              const isRake = [
                BonusType.HOURLY_RAKEBACK,
                BonusType.DAILY_RAKEBACK,
                BonusType.WEEKLY_RAKEBACK,
                BonusType.MONTHLY_RAKEBACK,
              ].includes(formData.type);

              // Auto-calculate validityDays from date range
              let calculatedValidityDays = 30; // default
              if (formData.startDate && formData.endDate) {
                const start = new Date(formData.startDate);
                const end = new Date(formData.endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                calculatedValidityDays = diffDays > 0 ? diffDays : 30;
              }

              const sanitizedData: CreateBonusDto = {
                ...formData,
                name:
                  formData.type === BonusType.PROFILE_COMPLETE
                    ? (formData.name?.trim() || "Profile Complete Bonus")
                    : formData.name,
                matchPercentage: Number(formData.matchPercentage ?? 0),
                cashbackPercentage: isCashback ? 0 : formData.cashbackPercentage ? Number(formData.cashbackPercentage) : undefined,
                minClaimAmount: formData.minClaimAmount ? Number(formData.minClaimAmount) : undefined,
                maxBonus: Number(formData.maxBonus ?? 0),
                rewardCurrency:
                  formData.type === BonusType.PROFILE_COMPLETE
                    ? (formData.rewardCurrency ?? BonusRewardCurrency.WULF_COIN)
                    : formData.rewardCurrency,
                minDeposit: isRake ? 0 : Number(formData.minDeposit ?? 0),
                minNetLosses: formData.minNetLosses ? Number(formData.minNetLosses) : undefined,
                wageringMultiplier:
                  formData.type === BonusType.PROFILE_COMPLETE
                    ? (profileWageringEnabled
                        ? Number(formData.wageringMultiplier ?? 1)
                        : 1)
                    : isCashback
                    ? 1
                    : Number(formData.wageringMultiplier ?? 0),
                aleaSoftwareId:
                  formData.type === BonusType.FREE_SPINS ? Number(formData.aleaSoftwareId ?? 0) : undefined,
                aleaGameId:
                  formData.type === BonusType.FREE_SPINS ? Number(formData.aleaGameId ?? 0) : undefined,
                aleaBetLevel:
                  formData.type === BonusType.FREE_SPINS ? Number(formData.aleaBetLevel ?? 0) : undefined,
                aleaCasinoCampaignId:
                  formData.type === BonusType.FREE_SPINS
                    ? (formData.aleaCasinoCampaignId?.trim() || undefined)
                    : undefined,
                aleaGrantExpiresInDays:
                  formData.type === BonusType.FREE_SPINS && formData.aleaGrantExpiresInDays
                    ? Number(formData.aleaGrantExpiresInDays)
                    : undefined,
                freeSpinWinningsTarget:
                  formData.type === BonusType.FREE_SPINS
                    ? (formData.freeSpinWinningsTarget ?? FreeSpinWinningsTarget.REAL_SC)
                    : FreeSpinWinningsTarget.REAL_SC,
                freeSpinWinningsWageringMultiplier:
                  formData.type === BonusType.FREE_SPINS &&
                  formData.freeSpinWinningsTarget === FreeSpinWinningsTarget.BONUS_SC
                    ? Number(formData.freeSpinWinningsWageringMultiplier ?? 0)
                    : 0,
                validityDays: calculatedValidityDays,
                gameWeighting:
                  formData.type === BonusType.PROFILE_COMPLETE
                    ? undefined
                    : {
                        ...formData.gameWeighting,
                        slots: Number(formData.gameWeighting?.slots || 100),
                        table_games: Number(formData.gameWeighting?.table_games || 10),
                      },
                // only include wageringType when not cashback
                wageringType:
                  isRake
                    ? undefined
                    : formData.type === BonusType.PROFILE_COMPLETE
                    ? WageringType.BONUS
                    : WageringType.BONUS,
                playerStatus:
                  formData.type === BonusType.PROFILE_COMPLETE
                    ? PlayerStatus.ALL
                    : isCashback
                    ? PlayerStatus.ALL
                    // The field is display-only for reload, so pin the value here
                    // rather than trusting whatever an older record carried.
                    : formData.type === BonusType.RELOAD_BONUS
                    ? PlayerStatus.EXISTING
                    : formData.playerStatus,
                startDate: isCashback ? undefined : formData.startDate,
                endDate: isCashback ? undefined : formData.endDate,
                kycRequired:
                  formData.type === BonusType.PROFILE_COMPLETE
                    ? false
                    : formData.kycRequired,
                // Cashback enablement lives in VIP Tier Rewards; the bonus row is
                // looked up by { type, isActive: true }, so keep it always active.
                isActive: isCashback ? true : formData.isActive,
              };

              try {
                setIsLoading(true);
                await onSubmit(sanitizedData);
              } catch (error) {
                console.error("Submission error:", error);
              } finally {
                setIsLoading(false);
              }
            }}
          >
            {isLoading ? (initialData ? "Updating..." : "Creating...") : (initialData ? "Update" : "Create")}
          </Button>
        </div>
      </div>

      {/* ImageUploader component */}
      <ImageUploader
        ref={uploaderRef}
        folder="bonuses"
        onUploadComplete={(url) => {
          setFormData({ ...formData, imageUrl: url });
        }}
      />
    </div>
  );
}
