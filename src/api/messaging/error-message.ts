/**
 * Pull the API's own error text out of an axios failure.
 *
 * Handlers only ever need the string, and typing the catch as `any` to reach
 * `err.response.data.message` re-states the same unsafe access at every call
 * site. Narrowed once, here.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: unknown } } })
    ?.response;
  const message = response?.data?.message;

  if (typeof message === "string" && message.trim()) return message;
  // NestJS validation errors arrive as an array of strings.
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];

  return fallback;
}
