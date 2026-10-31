"use client";

import { AgentHeader } from "@/components/layout/agent-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AgentSidebar } from "./components/agent-sidebar";
import { PayoutStatusToaster } from "./components/PayoutStatusToaster";

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <PayoutStatusToaster />
      <AgentSidebar />
      <SidebarInset>
        <div className="min-h-dvh bg-[#0A0E1A]">
          <AgentHeader />
          <main className="flex-1 w-full min-w-0">
            {/* Tailwind v4's `container` carries no padding of its own, so on
                phones the page content sat flush against both screen edges.
                Each page owns its own gutter (see PAGE_SHELL in
                components/responsive.ts); SidebarInset is the width authority,
                which is why dropping `container` changes nothing on desktop. */}
            <div className="w-full max-w-full min-w-0">
              {children}
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
