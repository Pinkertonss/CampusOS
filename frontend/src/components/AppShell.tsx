"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navigation from "./Navigation";
import PersonalAssistant from "./PersonalAssistant";
import SupportModal from "./SupportModal";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // Public/standalone routes that shouldn't show the dashboard shell/navigation
  const isStandaloneRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/auth/callback");

  if (isStandaloneRoute) {
    return <div className="min-h-screen w-full bg-slate-950 text-slate-100">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navigation />
      <main className="flex-1 min-h-[calc(100vh-4rem)] md:min-h-screen overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      <PersonalAssistant />
      <SupportModal />
    </div>
  );
}
