"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import Navigation from "./Navigation";
import PersonalAssistant from "./PersonalAssistant";
import SupportModal from "./SupportModal";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // Determine active interface theme: Admin (Cool Slate) vs Student (Warm Stone)
  const isAdminInterface = pathname.startsWith("/admin") || pathname.startsWith("/professor");
  const activeTheme = isAdminInterface ? "admin" : "student";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme);
    document.body.setAttribute("data-theme", activeTheme);
  }, [activeTheme]);

  // Public/standalone routes that shouldn't show the dashboard shell/navigation
  const isStandaloneRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/auth/callback");

  if (isStandaloneRoute) {
    return (
      <div
        data-theme="student"
        className="min-h-screen w-full bg-[var(--page-bg)] text-[var(--text-primary)]"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      data-theme={activeTheme}
      className="min-h-screen flex flex-col md:flex-row bg-[var(--page-bg)] text-[var(--text-primary)] transition-colors"
    >
      <Navigation />
      <main className="flex-1 min-h-[calc(100vh-4rem)] md:min-h-screen overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      <PersonalAssistant />
      <SupportModal />
    </div>
  );
}
