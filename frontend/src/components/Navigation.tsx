"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  ShieldCheck,
  Repeat,
  GraduationCap,
  Sun,
  Moon,
  ChevronRight,
  Compass,
  Users,
  SearchCheck,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSupport } from "../context/SupportContext";
import ProfileModal from "./ProfileModal";
import { Badge } from "./ui";
import { getReuseNotifications } from "../lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export default function Navigation() {
  const pathname = usePathname();
  const { user, profile, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { openSupport } = useSupport();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [reuseUnreadCount, setReuseUnreadCount] = useState(0);

  // Navigation order: Dashboard, Lost & Found, Academic Hub, then Role/Feature modules
  const navItems: NavItem[] = React.useMemo(() => {
    const items: NavItem[] = [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/lost-and-found", label: "Lost & Found", icon: SearchCheck, badge: "Campus" },
      { href: "/academic", label: "Academic Hub", icon: GraduationCap },
    ];

    if (isAdmin) {
      items.push(
        { href: "/professor", label: "Faculty Portal", icon: Users, badge: "Prof" },
        { href: "/admin", label: "Admin Console", icon: ShieldCheck, badge: "DOAA" }
      );
    }

    items.push(
      { href: "/opportunities", label: "Opportunities", icon: Compass, badge: "Match" },
      { href: "/guide", label: "Campus Guide", icon: Sparkles, badge: "AI" },
      { href: "/vault", label: "Digital Vault", icon: ShieldCheck },
      { href: "/reuse", label: "Campus Reuse", icon: Repeat }
    );

    return items;
  }, [isAdmin]);

  React.useEffect(() => {
    getReuseNotifications()
      .then((data) => setReuseUnreadCount(data.unread_count || 0))
      .catch(() => {});
  }, [pathname]);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Arjun Mehta";
  const rollNo = profile?.roll_no || "102203099";
  const branch = profile?.branch || "COE";
  const semester = profile?.semester || 5;

  return (
    <>
      {/* ========================================================
          1. DESKTOP SIDEBAR (md and up)
      ======================================================== */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 shrink-0 h-screen sticky top-0 z-30 transition-colors">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-sky-500 text-white font-bold flex items-center justify-center shadow-md shadow-teal-950/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-slate-900 dark:text-white text-base">
                CampusOS
                <Badge variant="primary" size="sm" className="font-mono text-[10px] px-1 py-0">
                  TIET
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Thapar Single-Campus Pilot
              </p>
            </div>
          </Link>

          {/* Quick theme toggle in header */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : item.href === "/guide"
                ? pathname.startsWith("/guide") || pathname.startsWith("/copilot")
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold shadow-sm border border-teal-200/60 dark:border-teal-800/60"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive
                        ? "text-teal-600 dark:text-teal-400"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.href === "/reuse" && reuseUnreadCount > 0 ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-600 text-white shadow-sm">
                    {reuseUnreadCount}
                  </span>
                ) : item.badge ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Help & Support Button */}
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => openSupport()}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/60 text-teal-800 dark:text-teal-300 font-semibold text-xs hover:bg-teal-100/80 dark:hover:bg-teal-900/60 transition group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <LifeBuoy className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:rotate-45 transition-transform" />
              <span>Help & Support</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-200/80 dark:bg-teal-800 text-teal-900 dark:text-teal-100 font-bold">
              24/7
            </span>
          </button>
        </div>

        {/* Student Profile Menu / Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-teal-600 to-sky-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                  {displayName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Sem {semester} · {branch} · {rollNo}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition shrink-0" />
          </button>
        </div>
      </aside>

      {/* ========================================================
          2. MOBILE TOP BAR (< md)
      ======================================================== */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-sky-500 text-white font-bold flex items-center justify-center shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="font-bold tracking-tight text-slate-900 dark:text-white text-base">
            CampusOS
          </span>
          <Badge variant="primary" size="sm" className="text-[9px] px-1 py-0">
            TIET
          </Badge>
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openSupport()}
            aria-label="Open Help & Support"
            className="p-2 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 transition"
          >
            <LifeBuoy className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            aria-label="Open profile"
            className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-sky-500 text-white font-bold text-xs flex items-center justify-center shadow-sm"
          >
            {displayName.slice(0, 2).toUpperCase()}
          </button>
        </div>
      </header>

      {/* ========================================================
          3. MOBILE BOTTOM TAB BAR (< md)
      ======================================================== */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 px-3 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between gap-1 overflow-x-auto py-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : item.href === "/guide"
                ? pathname.startsWith("/guide") || pathname.startsWith("/copilot")
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-xs transition-all ${
                  isActive
                    ? "text-teal-600 dark:text-teal-400 font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? "scale-110" : ""
                    }`}
                  />
                  {item.href === "/reuse" && reuseUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 px-1 text-[9px] font-bold rounded-full bg-teal-600 text-white leading-tight">
                      {reuseUnreadCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-600 dark:text-teal-400" />
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}
