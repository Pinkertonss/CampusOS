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
      <aside className="hidden md:flex flex-col w-64 bg-[var(--surface-card)] border-r border-[var(--border-color)] shrink-0 h-screen sticky top-0 z-30 transition-colors">
        {/* Brand Header */}
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[var(--action-primary)] text-[var(--action-primary-text)] font-bold flex items-center justify-center shadow-xs transition-opacity group-hover:opacity-90">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-[var(--text-primary)] text-base">
                CampusOS
                <Badge variant="primary" size="sm" className="font-mono text-[10px] px-1 py-0">
                  TIET
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Thapar Single-Campus Pilot
              </p>
            </div>
          </Link>

          {/* Quick theme toggle in header */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[var(--text-primary)]" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
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
                    ? "bg-[var(--nav-selected-bg)] text-[var(--nav-selected-text)] font-semibold shadow-xs border border-[var(--nav-selected-border)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive
                        ? "text-[var(--nav-selected-text)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.href === "/reuse" && reuseUnreadCount > 0 ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs">
                    {reuseUnreadCount}
                  </span>
                ) : item.badge ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-badge-border)]">
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
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-semibold text-xs hover:bg-[var(--nav-selected-bg)] hover:border-[var(--nav-selected-border)] transition group shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <LifeBuoy className="w-4 h-4 text-[var(--action-primary)] group-hover:rotate-45 transition-transform" />
              <span>Help & Support</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-badge-border)] font-bold">
              24/7
            </span>
          </button>
        </div>

        {/* Student Profile Menu / Footer */}
        <div className="p-3 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--surface-secondary)] transition text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[var(--action-primary)] text-[var(--action-primary-text)] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--action-primary)] transition">
                  {displayName}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  Sem {semester} · {branch} · {rollNo}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-0.5 transition shrink-0" />
          </button>
        </div>
      </aside>

      {/* ========================================================
          2. MOBILE TOP BAR (< md)
      ======================================================== */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[var(--surface-card)] border-b border-[var(--border-color)]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--action-primary)] text-[var(--action-primary-text)] font-bold flex items-center justify-center shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="font-bold tracking-tight text-[var(--text-primary)] text-base">
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
            className="p-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition cursor-pointer"
          >
            <LifeBuoy className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] transition cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[var(--text-primary)]" />}
          </button>

          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            aria-label="Open profile"
            className="w-8 h-8 rounded-lg bg-[var(--action-primary)] text-[var(--action-primary-text)] font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer"
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface-card)] border-t border-[var(--border-color)] px-3 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
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
                    ? "text-[var(--action-primary)] font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? "scale-110" : ""
                    }`}
                  />
                  {item.href === "/reuse" && reuseUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 px-1 text-[9px] font-bold rounded-full bg-[var(--action-primary)] text-[var(--action-primary-text)] leading-tight">
                      {reuseUnreadCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--action-primary)]" />
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
