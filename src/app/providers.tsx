"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LanguageProvider, type Language } from "@/contexts/LanguageContext";
import { ThemeProvider, type Theme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { createQueryClient, createTrpcClient } from "@/lib/trpcClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export default function Providers({
  children,
  initialLanguage,
  initialTheme,
}: {
  children: ReactNode;
  initialLanguage?: Language;
  initialTheme?: Theme;
}) {
  // Lazy state so each browser session (and each server render) gets its own clients.
  const [queryClient] = useState(createQueryClient);
  const [trpcClient] = useState(createTrpcClient);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <ThemeProvider defaultTheme="system" initialTheme={initialTheme}>
            <LanguageProvider initialLanguage={initialLanguage}>
              <TooltipProvider>
                <Toaster />
                {children}
              </TooltipProvider>
            </LanguageProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
