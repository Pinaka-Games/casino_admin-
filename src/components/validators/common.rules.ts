import { z } from "zod";

export const usernameRule = z
  .string()
  .min(3, "Username must be at least 3 characters");

/**
 * Mirrors the API's `StrongPassword()`
 * (`hestabit_Backend/apps/api/src/common/validators/password.validator.ts`).
 * Keep the two in step — anything this accepts and the server rejects surfaces
 * as an unexplained 400 after the form is already filled in.
 *
 * Was missing the lowercase and special-character checks, so `PASSWORD1` passed
 * here and failed server-side.
 */
export const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Z]/, "Password must contain one uppercase letter")
  .regex(/[a-z]/, "Password must contain one lowercase letter")
  .regex(/[0-9]/, "Password must contain one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain one special character");

/** Plain-language summary for inline form hints. */
export const PASSWORD_HINT =
  "At least 8 characters, with an uppercase and lowercase letter, a number and a special character.";

export const emailRule = z.string().email("Invalid email address");

export const phoneRule = z
  .string()
  .regex(/^\d{10}$/, "Phone must be 10 digits");

export const pinCodeRule = z
  .string()
  .regex(/^\d{4,6}$/, "Invalid pin code");

export const optionalString = z.string().optional();
