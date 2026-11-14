"use client";

import React from "react";
import {
  User as UserIcon,
  Moon,
  Sun,
  Laptop,
  LogOut,
  ShieldCheck,
  GraduationCap,
  Hash,
  BookOpen,
  Layers,
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

  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Demo Student";
  const email = user?.email || "arjun.mehta@thapar.edu";
  const rollNo = profile?.roll_no || "102203099";
  const branch = profile?.branch || "COE";
  const semester = profile?.semester || 5;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <span>Student Profile & Preferences</span>
        </div>
      }
      size="md"
      footer={
        <div className="w-full flex items-center justify-between">
          <span className="text-xs text-slate-500">CampusOS v1.0 · TIET Pilot</span>
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
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-sky-500 text-white font-bold flex items-center justify-center text-lg shadow-md shrink-0">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
              {displayName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
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
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mb-1">
              <Hash className="w-3.5 h-3.5 text-teal-500" /> Roll Number
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {rollNo}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-teal-500" /> Campus Section
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              TIET Patiala
            </div>
          </div>
        </div>

        {/* Theme Preference */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Appearance & Theme
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition ${
                theme === "light"
                  ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-700 dark:text-teal-300 font-semibold shadow-sm"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition ${
                theme === "dark"
                  ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-700 dark:text-teal-300 font-semibold shadow-sm"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition ${
                theme === "system"
                  ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-700 dark:text-teal-300 font-semibold shadow-sm"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <Laptop className="w-4 h-4" />
              System
            </button>
          </div>
        </div>

        {/* Privacy Status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <div className="text-xs">
              <span className="font-semibold text-teal-900 dark:text-teal-200">
                Personalization Consent
              </span>
              <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80">
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
