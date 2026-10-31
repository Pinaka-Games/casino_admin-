export type BannerActionType =
  | "NAVIGATE"
  | "OPEN_AUTH_MODAL"
  | "OPEN_SIGNUP_MODAL"
  | "OPEN_REFERRAL_SIGNUP"
  | "OPEN_DAILY_STREAK_MODAL"
  | "OPEN_BUNDLE_SALE_MODAL"
  | "OPEN_MESSAGE_MODAL"
  // Legacy values kept so existing banners keep resolving.
  | "OPEN_REFERRAL"
  | "DOWNLOAD_APP"
  | "CLAIM_BONUS";

/** How the player app renders a banner. */
export type BannerKind = "CONTENT" | "IMAGE";

export interface Banner {
  id: string;

  imageUrl: string;
  imageKey?: string;

  /** CONTENT = composed copy over art; IMAGE = artwork is the whole banner. */
  bannerType?: BannerKind;

  /* IMAGE-ONLY VARIANTS — per language, per device */
  imageDesktopEn?: string;
  imageDesktopEnKey?: string;
  imageMobileEn?: string;
  imageMobileEnKey?: string;
  imageDesktopEs?: string;
  imageDesktopEsKey?: string;
  imageMobileEs?: string;
  imageMobileEsKey?: string;

  /* ENGLISH CONTENT */
  titleEn: string;
  subtitleEn?: string;
  oneLineEn?: string;
  amountEn?: string;
  amountSuffixEn?: string;
  buttonTextEn?: string;

  /* SPANISH CONTENT */
  titleEs: string;
  subtitleEs?: string;
  oneLineEs?: string;
  amountEs?: string;
  amountSuffixEs?: string;
  buttonTextEs?: string;

  /* ACTION */
  actionType?: BannerActionType;
  actionPayload?: any;
  link?: string | null;

  /* STATUS */
  isActive: boolean;
  sortOrder?: number;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}