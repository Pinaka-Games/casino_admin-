"use client";

import { useEffect, useRef } from "react";

export const GLOBAL_REFRESH_EVENT = "global:refresh";

export function useGlobalRefresh(onRefresh: () => void | Promise<void>) {
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const handleRefresh = () => {
      void onRefreshRef.current();
    };

    window.addEventListener(GLOBAL_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(GLOBAL_REFRESH_EVENT, handleRefresh);
    };
  }, []);
}
