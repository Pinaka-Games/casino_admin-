// Country-aware phone validation for admin registration forms.
//
// The register forms offer a fixed set of dialing codes and collect a
// digits-only national number. A plain /^\d{10,15}$/ check accepts wrong-length
// numbers for the selected country (e.g. a 15-digit US number), which reads as
// "validation not working". This maps each supported dialing code to the valid
// national-number length(s) so an obviously-wrong number is rejected.

// Allowed national-number digit lengths per dialing code (mobile-inclusive).
const NATIONAL_LENGTHS: Record<string, number[]> = {
  "+1": [10], // US / CA
  "+44": [10], // GB
  "+91": [10], // IN
  "+86": [11], // CN
  "+81": [10, 11], // JP
  "+82": [9, 10, 11], // KR
  "+49": [10, 11, 12], // DE
  "+33": [9], // FR
  "+61": [9], // AU
  "+971": [9], // AE
};

// Fallback range for any code not in the map.
const FALLBACK_MIN = 8;
const FALLBACK_MAX = 15;

/** Strip everything except digits. */
export const digitsOnly = (raw: string): string => (raw || "").replace(/\D/g, "");

/**
 * Max national-number digits allowed for a dialing code — use as the input
 * `maxLength` so the field can't accept more than the country permits
 * (e.g. India caps at 10, not 15).
 */
export const maxPhoneDigits = (countryCode: string): number => {
  const allowed = NATIONAL_LENGTHS[countryCode];
  return allowed ? Math.max(...allowed) : FALLBACK_MAX;
};

/**
 * Validate a national phone number against the selected dialing code.
 * `phone` is expected to be digits-only (as stored by the forms).
 * Returns an error message, or null when valid.
 */
export const validatePhone = (
  phone: string,
  countryCode: string,
): string | null => {
  const digits = digitsOnly(phone);
  if (!digits) return "Phone number is required";

  const allowed = NATIONAL_LENGTHS[countryCode];
  if (allowed) {
    if (!allowed.includes(digits.length)) {
      const label =
        allowed.length === 1
          ? `${allowed[0]} digits`
          : `${Math.min(...allowed)}–${Math.max(...allowed)} digits`;
      return `Enter a valid phone number (${label}) for ${countryCode}`;
    }
    return null;
  }

  if (digits.length < FALLBACK_MIN || digits.length > FALLBACK_MAX) {
    return `Phone number must be ${FALLBACK_MIN}–${FALLBACK_MAX} digits`;
  }
  return null;
};
