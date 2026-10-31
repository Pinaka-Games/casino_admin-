import { NextResponse } from "next/server";

import { getBuildId } from "@/lib/build-id";

/**
 * Which build is actually serving right now.
 *
 * The client compares this against the id it was handed when its page was
 * rendered; a difference means a deploy happened while the tab was open, which
 * is the state that ends in a 404 on the next chunk the router asks for. See
 * components/version/VersionWatcher.tsx.
 */

// Never prerender or cache: a build id answered from a cache is a build id from
// a previous build, which is precisely the thing being detected.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const buildId = await getBuildId();

  return NextResponse.json(
    { buildId },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  );
}
