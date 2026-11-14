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
      <body className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-teal-500/20 selection:text-teal-700 dark:selection:text-teal-300">
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
