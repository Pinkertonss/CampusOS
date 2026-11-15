"use client";

import React from "react";
import {
  Sun,
  Moon,
  Laptop,
  LogOut,
  ShieldCheck,
  Hash,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Modal, Button, Badge } from "./ui";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Arjun Mehta";
  const rollNo = profile?.roll_no || "102203099";
  const branch = profile?.branch || "COE";
  const semester = profile?.semester || 5;
  const email = user?.email || "arjun.mehta@thapar.edu";

  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Profile & Preferences"
      description="Manage your appearance settings and view verified identity."
      size="md"
      footer={
        <div className="w-full flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">CampusOS v1.0 · TIET Pilot</span>
          <Button
            variant="danger"
            size="sm"
            onClick={handleSignOut}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* User Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
          <div className="w-12 h-12 rounded-xl bg-[var(--action-primary)] text-[var(--action-primary-text)] font-bold flex items-center justify-center text-lg shadow-xs shrink-0">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">
              {displayName}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] truncate">{email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="primary" size="sm">
                Semester {semester}
              </Badge>
              <Badge variant="default" size="sm">
                {branch}
              </Badge>
            </div>
          </div>
        </div>

        {/* Academic Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)]">
            <div className="text-[11px] text-[var(--text-secondary)] font-medium flex items-center gap-1.5 mb-1">
              <Hash className="w-3.5 h-3.5 text-[var(--action-primary)]" /> Roll Number
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {rollNo}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)]">
            <div className="text-[11px] text-[var(--text-secondary)] font-medium flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-[var(--action-primary)]" /> Campus Section
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              TIET Patiala
            </div>
          </div>
        </div>

        {/* Theme Preference */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
            Appearance & Theme
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                theme === "light"
                  ? "bg-[var(--nav-selected-bg)] border-[var(--nav-selected-border)] text-[var(--nav-selected-text)] font-semibold shadow-xs"
                  : "bg-[var(--surface-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
              }`}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                theme === "dark"
                  ? "bg-[var(--nav-selected-bg)] border-[var(--nav-selected-border)] text-[var(--nav-selected-text)] font-semibold shadow-xs"
                  : "bg-[var(--surface-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
              }`}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                theme === "system"
                  ? "bg-[var(--nav-selected-bg)] border-[var(--nav-selected-border)] text-[var(--nav-selected-text)] font-semibold shadow-xs"
                  : "bg-[var(--surface-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
              }`}
            >
              <Laptop className="w-4 h-4" />
              System
            </button>
          </div>
        </div>

        {/* Privacy Status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Personalization Consent
              </span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Data used strictly for your dashboard calculations
              </p>
            </div>
          </div>
          <Badge variant="success" size="sm" dot>
            Active
          </Badge>
        </div>
      </div>
    </Modal>
  );
}
