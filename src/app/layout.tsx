import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import ToastProvider from "./provider/ToastProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import SocketProviders from "./provider/SocketProviders";
import TopLoader from "@/components/common/TopLoader";
import ChunkErrorRecovery from "@/components/error/ChunkErrorRecovery";
import VersionWatcher from "@/components/version/VersionWatcher";
import { getBuildId } from "@/lib/build-id";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WulfCasino Admin",
  description: "WulfCasino admin dashboard ",
};

// Async so the build id can be read once, on the server, and handed to the
// client component that needs it. See lib/build-id.ts for why it is read from
// disk rather than from an environment variable.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildId = await getBuildId();

  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        {/* Production console silencer.
            `compiler.removeConsole` is set in next.config.ts, but Turbopack (the
            default builder since Next 16) does not apply it — verified against a
            clean build of the player app, where app logs survived into
            .next/static/chunks either way. Until that lands, no-op the noisy
            console methods before any app JS runs. `error` and `warn` are
            deliberately left intact so real failures still surface. Dev builds
            are untouched. */}
        {process.env.NODE_ENV === "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                'try{var c=console,n=function(){};' +
                '["log","debug","info","trace","table","dir","group","groupCollapsed","groupEnd","time","timeEnd","count"]' +
                ".forEach(function(k){if(c&&c[k])c[k]=n})}catch(e){}",
            }}
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Catches the deploy-skew failure that no error boundary can see: a
            hashed chunk from the previous build 404ing after the container was
            replaced. Fires on window `error` (capture) and `unhandledrejection`
            and reloads once. Renders nothing. See lib/chunk-error.ts. */}
        <ChunkErrorRecovery />
        {/* The other half of the same problem: ChunkErrorRecovery reacts once a
            chunk has already 404'd, this notices the deploy while the page is
            still working and offers a reload the user chooses to take. Renders
            nothing until the running build stops matching this one. */}
        <VersionWatcher buildId={buildId} />
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <AuthProvider>
          <ThemeProvider>
            <SocketProviders>{children}</SocketProviders>
          </ThemeProvider>
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}        
