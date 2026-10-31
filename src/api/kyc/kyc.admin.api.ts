// api/kyc/kyc.admin.api.ts
import api from "../config/axios.config";

export type KycStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type AdminKycRow = {
  id: string;
  userId: string;
  applicantId?: string | null;
  levelName?: string | null;
  status: KycStatus;
  isAdminApproved?: boolean;
  adminApprovedAt?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastEvent?: any;

  // --- Sumsub review / rejection detail ---
  reviewHold?: "PROVIDER" | "AML" | "ADMIN" | "IDENTITY" | null;
  reviewAnswer?: string | null; // GREEN | RED
  reviewRejectType?: string | null; // RETRY | FINAL
  rejectLabels?: string[] | null;
  moderationComment?: string | null; // applicant-facing
  clientComment?: string | null; // internal (admin-only)

  // --- Account-holder vs document-holder reconciliation ---
  // Sumsub only proves the document is genuine and the selfie matches it; it is
  // never told who the account claims to be. These carry OUR comparison.
  identityVerdict?:
    | "MATCH"
    | "DOB_MISMATCH"
    | "GENDER_MISMATCH"
    | "NAME_MISMATCH"
    | "UNVERIFIABLE"
    | null;
  identityMismatchReasons?: string[] | null;
  claimedName?: string | null;
  claimedDob?: string | null;
  claimedGender?: string | null;
  profileEditRequestedAt?: string | null;
  profileEditReason?: string | null;

  // --- Extracted identity (from Sumsub /one) ---
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  dob?: string | null;
  gender?: string | null;
  nationality?: string | null;
  countryOfBirth?: string | null;
  placeOfBirth?: string | null;

  // --- Primary identity document ---
  docType?: string | null;
  docNumber?: string | null;
  docCountry?: string | null;
  docIssuedDate?: string | null;
  docValidUntil?: string | null;

  // --- Address ---
  addressFormatted?: string | null;
  addressCountry?: string | null;

  // --- Sumsub refs / extras ---
  inspectionId?: string | null;
  personalData?: any;
  personalDataAt?: string | null;

  user?: {
    id: string;
    entity?: string | null; // email/phone
    avatar?: string | null;
    // Set while the player is locked out for missing the KYC deadline.
    kycLockedAt?: string | null;
  } | null;
};

export type AdminKycListResponse = {
  page: number;
  limit: number;
  total: number;
  rows: AdminKycRow[];
};

export type KycListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
};

// GET KYC LIST
export const listKycProfiles = async (params: KycListParams) => {
  const res = await api.get<AdminKycListResponse>("/kyc/profiles", {
    params,
  });
  return res.data;
};

// GET SINGLE KYC DETAILS
export const getKycDetails = async (kycId: string) => {
  const res = await api.get<AdminKycRow>(`/kyc/profiles/${kycId}`);
  return res.data;
};

// GET a single user's KYC profile (null if they never started KYC)
export const getKycByUserId = async (userId: string) => {
  const res = await api.get<AdminKycRow | null>(`/kyc/users/${userId}`);
  return res.data;
};

// ADMIN: manually mark a user's KYC as APPROVED (flagged isAdminApproved)
export const approveUserKyc = async (userId: string) => {
  const res = await api.patch<AdminKycRow>(`/kyc/users/${userId}/approve`);
  return res.data;
};

// ADMIN: undo a manual approval
export const revokeUserKyc = async (userId: string) => {
  const res = await api.patch<AdminKycRow>(`/kyc/users/${userId}/revoke`);
  return res.data;
};

// ADMIN: lift a KYC-deadline account lock without approving KYC. The player
// gets a fresh grace period before they can be locked again.
export const unlockUserKyc = async (userId: string) => {
  const res = await api.patch<{ userId: string; kycLockedAt: null }>(
    `/kyc/users/${userId}/unlock`,
  );
  return res.data;
};

// ADMIN: pull the latest status/data from Sumsub (recovery for a missed webhook)
export const syncUserKyc = async (userId: string) => {
  const res = await api.patch<AdminKycRow>(`/kyc/users/${userId}/sync`);
  return res.data;
};
// ADMIN: the document is right and the profile is wrong — copy the extracted
// name/date of birth onto the player's profile. Works on a held profile too;
// the automatic write-back only runs when the identity gate passes.
export const applyDocumentIdentity = async (userId: string) => {
  const res = await api.patch<AdminKycRow>(
    `/kyc/users/${userId}/apply-document-identity`,
  );
  return res.data;
};

// ADMIN: ask the player to correct their own details. Lifts their name/DOB lock
// until they save and notifies them why. Does NOT un-verify them.
export const requestProfileUpdate = async (userId: string, reason?: string) => {
  const res = await api.patch<AdminKycRow>(
    `/kyc/users/${userId}/request-profile-update`,
    { reason },
  );
  return res.data;
};
