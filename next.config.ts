import type { NextConfig } from "next";

/**
 * HSTS lifetime, in seconds. One day rather than the year Lighthouse asks for:
 * HSTS is cached by the browser and cannot be called back, so a wrong value
 * locks staff out of any host that later has to serve plain HTTP. Ramp it —
 * 1 day, then 30 days, then a year — confirming at each step that every host
 * answers on HTTPS. Mirrors the user app's reasoning.
 *
 * `includeSubDomains` and `preload` are deliberately absent; both are far
 * harder to reverse than the max-age.
 */
const HSTS_MAX_AGE = 60 * 60 * 24;

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: `max-age=${HSTS_MAX_AGE}`,
  },
  {
    // Clickjacking control. Unlike the user app there is no Telegram Mini App
    // to accommodate here, so nothing may frame the admin panel but itself.
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'",
  },
  {
    // Not plain `same-origin`: the Coinflow account-link flow opens a popup and
    // CoinflowLinkWaiter waits on it talking back through window.opener, which
    // strict isolation would sever.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];

/**
 * Which responses are HTML documents, for the cache rule below. See the user
 * app's next.config.ts for the full reasoning — in short: hashed assets under
 * `_next/static` keep their one-year immutable cache because their URL changes
 * with their content, while the document, whose URL never changes and which
 * names those hashes, must never be reused without asking the server. A cached
 * document is exactly how a browser ends up requesting the previous build's
 * chunks from a new deployment.
 *
 * Exclusions: `_next/` (the hashed assets), `api/` (route handlers set their
 * own Cache-Control and a config header would conflict), and anything with a
 * file extension (static files out of `public/`).
 */
const HTML_DOCUMENT_PATH = "/:path((?!_next/)(?!api/)(?!.*\\.[^/]*$).*)";

/**
 * `no-cache` stores the response but revalidates before reuse, so an unchanged
 * document still returns a bodyless 304. `no-store` would forbid storing it at
 * all and force a full re-download every time.
 */
const DOCUMENT_CACHE_HEADERS = [
  {
    key: "Cache-Control",
    value: "no-cache, must-revalidate",
  },
];

/**
 * Identity of this build, decided once when next.config is evaluated.
 *
 * `generateBuildId` persists it to `.next/BUILD_ID`. Everything downstream
 * reads that FILE via lib/build-id.ts — never this constant, which next.config
 * recomputes on every server boot and which therefore describes the boot rather
 * than the build. A difference between the id a page was handed and the id
 * /api/version answers means a deploy happened under an open tab.
 *
 * Not read from an environment variable or from git: a build arg nobody sets
 * degrades this to "always equal", and `git` is not guaranteed inside the build
 * stage. See the user app's next.config.ts for the longer note.
 */
const BUILD_STAMP = String(Date.now());

const nextConfig: NextConfig = {
  reactCompiler: true,

  generateBuildId: () => BUILD_STAMP,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      // `/` is listed separately because the matcher below requires a non-empty
      // path segment and cannot express the bare root.
      {
        source: "/",
        headers: DOCUMENT_CACHE_HEADERS,
      },
      {
        source: HTML_DOCUMENT_PATH,
        headers: DOCUMENT_CACHE_HEADERS,
      },
    ];
  },

  compiler: {
    // Strips console.* from the production bundle at build time, keeping `error`
    // and `warn` so real failures still surface in the field.
    //
    // NOTE: Turbopack (the default builder since Next 16) currently ignores
    // this — verified against clean builds. The head-script silencer in
    // src/app/layout.tsx is what actually takes effect today; this stays so the
    // proper build-time strip applies the moment Turbopack supports it (or if
    // the build ever runs through webpack).
    removeConsole: { exclude: ["error", "warn"] },
  },

  images: {
    unoptimized: true, // 👈 add this
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d3hwpq8f04gogi.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "wulf-app-bucket.s3.us-east-1.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "wulf-asset-bucket.s3.us-east-1.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dzyemtm911c4h.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.saclientarea.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.sa-gaming.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.evolution.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.pragmaticplay.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
