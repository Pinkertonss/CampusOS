import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import { SupportProvider } from "../context/SupportContext";
import { ToastProvider } from "../components/ui";
import AppShell from "../components/AppShell";

export const metadata: Metadata = {
  title: "CampusOS - Thapar Institute of Engineering & Technology",
  description:
    "One personalized platform that fixes fragmented campus information for TIET students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <body className="min-h-full bg-[var(--page-bg)] text-[var(--text-primary)] antialiased selection:bg-[var(--accent-badge-bg)] selection:text-[var(--text-primary)]">
        <ThemeProvider>
          <AuthProvider>
            <SupportProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </SupportProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
