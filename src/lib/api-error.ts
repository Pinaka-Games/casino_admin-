/**
 * Pulls a human-readable message out of an unknown thrown value.
 *
 * Axios errors carry the server message at `response.data.message`; everything
 * else falls back to `message`, then the caller's default. Lets call sites use
 * `catch (err: unknown)` instead of `catch (err: any)`.
 */
/**
 * Cross-pool conflict payload thrown by the backend when an email/phone already
 * belongs to the OTHER account pool (a staff account when creating a player, or
 * a player when creating staff). `overridable` is true only for callers allowed
 * to force-create past the warning (admins) — an agent creating a sub-agent gets
 * `overridable: false` (a hard stop).
 */
export interface CrossPoolConflict {
  code: "CROSS_POOL_CONFLICT";
  message: string;
  overridable: boolean;
  conflictWith?: "staff" | "user";
  accountKind?: "agent" | "subagent" | "employee" | "user";
  field?: "email" | "phone";
}

/**
 * Returns the structured cross-pool conflict if `error` is that specific 409,
 * else null. Lets a form decide between a "create anyway?" dialog and a plain
 * error toast.
 */
export function getCrossPoolConflict(error: unknown): CrossPoolConflict | null {
  const data = (
    error as { response?: { data?: Partial<CrossPoolConflict> } } | null
  )?.response?.data;

  if (!data || data.code !== "CROSS_POOL_CONFLICT") return null;

  return {
    code: "CROSS_POOL_CONFLICT",
    message:
      typeof data.message === "string" && data.message.trim()
        ? data.message
        : "This account already exists in another area of the platform.",
    overridable: !!data.overridable,
    conflictWith: data.conflictWith,
    accountKind: data.accountKind,
    field: data.field,
  };
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const serverMessage = (
    error as { response?: { data?: { message?: unknown } } } | null
  )?.response?.data?.message;

  if (typeof serverMessage === "string" && serverMessage.trim()) {
    return serverMessage;
  }

  // Nest's ValidationPipe returns an array of messages — show the first.
  if (Array.isArray(serverMessage) && typeof serverMessage[0] === "string") {
    return serverMessage[0];
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
