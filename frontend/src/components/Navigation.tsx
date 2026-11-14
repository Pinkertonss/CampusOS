"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  Repeat,
  LayoutDashboard,
  Sparkles,
  BookOpen,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/academic", label: "Academic & What-If", icon: GraduationCap },
  { href: "/copilot", label: "Campus Copilot", icon: MessageSquareText },
  { href: "/vault", label: "Digital Vault", icon: ShieldCheck },
  { href: "/reuse", label: "Campus Reuse", icon: Repeat },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800 shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-700 via-red-600 to-amber-500 flex items-center justify-center font-bold text-lg shadow-md shadow-red-950">
            COS
          </div>
          <div>
            <div className="font-bold tracking-tight text-white flex items-center gap-1.5 text-base">
              CampusOS
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800/60 font-semibold uppercase tracking-wider">
                TIET
              </span>
            </div>
            <p className="text-xs text-slate-400">Thapar Institute Pilot</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-red-700 text-white shadow-sm shadow-red-900/50"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
              {item.label}
              {item.href === "/copilot" && (
                <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> RAG
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Student Profile Card (Single Campus Pilot) */}
      <div className="p-4 m-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 font-semibold text-xs border border-slate-600">
            GS
          </div>
          <div className="overflow-hidden">
            <p className="font-semibold text-slate-200 truncate">Gurasees Singh</p>
            <p className="text-[11px] text-slate-400">Roll: 102203099</p>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-slate-700/60 pt-2">
          <p className="truncate">B.E. Computer Engineering (COE)</p>
          <div className="flex items-center justify-between text-slate-300 font-medium">
            <span>5th Semester</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Active
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
