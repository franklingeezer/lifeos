"use client";

import React from "react";
import { SWRConfig } from "swr";
import ServiceWorkerRegister from "@/components/shell/ServiceWorkerRegister";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Revalidate when you tab back in — cheap for a personal app and
        // keeps data fresh if you have LifeOS open on two devices.
        revalidateOnFocus: true,
        // Don't hammer Supabase if something re-renders in a tight loop.
        dedupingInterval: 2000,
        // Global error handler so an unhandled network hiccup doesn't just
        // vanish silently — surfaces in the console instead of a blank page.
        onError: (error, key) => {
          console.error(`SWR fetch failed for "${key}":`, error);
        },
      }}
    >
      <ServiceWorkerRegister />
      {children}
    </SWRConfig>
  );
}