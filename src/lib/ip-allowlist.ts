/**
 * Client-side validation for the maintenance IP allowlist.
 *
 * A mirror of the API's `ip-allowlist.util.ts`, and deliberately only a mirror:
 * the backend sanitises what it stores, so this exists to tell an operator that
 * an entry will be thrown away BEFORE they save and wonder where it went. If
 * the two ever disagree, the backend is right.
 */

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isIpv6(value: string): boolean {
  let head = value;
  let embeddedGroups = 0;

  // A trailing dotted quad ("::ffff:203.0.113.4") is legal and stands in for
  // the last two groups.
  const lastColon = value.lastIndexOf(":");
  const tail = lastColon === -1 ? "" : value.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (!isIpv4(tail)) return false;
    head = value.slice(0, lastColon);
    embeddedGroups = 2;
  }

  const doubleColon = head.indexOf("::");
  if (doubleColon !== head.lastIndexOf("::")) return false;

  const isGroup = (group: string) => /^[0-9a-f]{1,4}$/i.test(group);

  if (doubleColon === -1) {
    const groups = head === "" ? [] : head.split(":");
    if (groups.length + embeddedGroups !== 8) return false;
    return groups.every(isGroup);
  }

  const left = head.slice(0, doubleColon);
  const right = head.slice(doubleColon + 2);
  const leftGroups = left === "" ? [] : left.split(":");
  const rightGroups = right === "" ? [] : right.split(":");
  // `::` has to stand for at least one group, so a compressed address can never
  // already carry all eight.
  if (leftGroups.length + rightGroups.length + embeddedGroups > 7) return false;

  return [...leftGroups, ...rightGroups].every(isGroup);
}

/** Whether one entry — an address, or an address with a `/prefix` — is storable. */
export function isValidIpEntry(entry: string): boolean {
  const [address, prefixPart, ...rest] = entry.trim().split("/");
  if (rest.length > 0 || !address) return false;

  const v6 = address.includes(":");
  if (!(v6 ? isIpv6(address) : isIpv4(address))) return false;

  if (prefixPart === undefined) return true;
  if (!/^\d{1,3}$/.test(prefixPart)) return false;
  return Number(prefixPart) <= (v6 ? 128 : 32);
}

/**
 * The entries in a free-text box, in the order they were typed.
 *
 * Commas, whitespace and newlines all separate, because an operator pasting a
 * list from a ticket should not have to reformat it first.
 */
export function splitIpEntries(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
