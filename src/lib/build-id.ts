import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The identity of the build currently on disk, read from `.next/BUILD_ID`.
 *
 * Server-only — it touches the filesystem, so it must never be imported into a
 * Client Component. The value reaches the browser as a prop instead, handed
 * down from the root layout.
 *
 * ── Why the file, and not an environment variable ────────────────────────────
 * The obvious approach is `env: { NEXT_PUBLIC_BUILD_ID }` in next.config, and
 * it does not work here. Verified against a real build: Turbopack does not
 * inline that into the client bundle — the name ends up in
 * `.next/required-server-files.json` and is supplied to the SERVER at runtime.
 * Which means two problems at once: the browser reads `undefined`, and the
 * server reads a value produced by next.config being evaluated at BOOT, so it
 * would differ from the build that produced the page and report a skew on every
 * single request.
 *
 * `.next/BUILD_ID` has neither problem. It is written once when the build runs
 * and is immutable for the life of the container, so it describes the build
 * rather than the boot.
 */

/**
 * Cached after the first successful read: the file cannot change while this
 * process is alive, because a new build means a new container.
 */
let cached: string | null = null;

export async function getBuildId(): Promise<string | null> {
  if (cached) return cached;

  try {
    const raw = await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8");
    const buildId = raw.trim();
    if (!buildId) return null;
    cached = buildId;
    return buildId;
  } catch {
    // Unreadable — a standalone output layout, a stricter filesystem, anything.
    // Null makes every consumer stand down rather than guess, which is the right
    // failure: a wrong answer here nags users to reload a page that is current.
    return null;
  }
}
