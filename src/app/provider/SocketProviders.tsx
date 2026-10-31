"use client";

import SocketListener from "@/components/socket/SocketListener";


export default function SocketProviders({ children }: { children: React.ReactNode }) {
  return <SocketListener>{children}</SocketListener>;
}
