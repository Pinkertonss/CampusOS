"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  GraduationCap,
  Sparkles,
  Plus,
  RefreshCw,
  Sliders,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button, Badge, Skeleton, EmptyState, useToast } from "../components/ui";
import {
  getDailyPlan,
  getAcademicSummary,
  getTimetable,
  getDeadlines,
} from "../lib/api";
import {
  DailyPlanResponse,
  AcademicSummaryResponse,
  TimetableSlot,
  DeadlineTask,
} from "../types";

import ActionPlanList from "../components/dashboard/ActionPlanList";
import AttendanceGrid from "../components/dashboard/AttendanceGrid";
import GradesSection from "../components/dashboard/GradesSection";
import TimetableSection from "../components/dashboard/TimetableSection";
import UpcomingDeadlinesList from "../components/dashboard/UpcomingDeadlinesList";
import WhatIfPlannerDrawer from "../components/dashboard/WhatIfPlannerDrawer";
import DataEntryModal from "../components/dashboard/DataEntryModal";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [dailyPlan, setDailyPlan] = useState<DailyPlanResponse | null>(null);
  const [summary, setSummary] = useState<AcademicSummaryResponse | null>(null);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineTask[]>([]);

  // Modals & Drawers state
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfDefaultCourse, setWhatIfDefaultCourse] = useState<string | undefined>(undefined);
  const [whatIfDefaultTab, setWhatIfDefaultTab] = useState<"attendance" | "grades">("attendance");

  const [dataEntryOpen, setDataEntryOpen] = useState(false);
  const [dataEntryTab, setDataEntryTab] = useState<"course" | "attendance" | "assessment" | "csv">("course");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [planRes, sumRes, ttRes, dlRes] = await Promise.all([
        getDailyPlan(),
        getAcademicSummary(),
        getTimetable(),
        getDeadlines(),
      ]);

      setDailyPlan(planRes);
      setSummary(sumRes);
      setTimetable(ttRes);
      setDeadlines(dlRes);
      setError(null);
    } catch (err: unknown) {
      console.error("Dashboard data load error:", err);
      const msg = err instanceof Error ? err.message : "Failed to connect to backend services.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenWhatIfAttendance = (courseCode?: string) => {
    setWhatIfDefaultCourse(courseCode);
    setWhatIfDefaultTab("attendance");
    setWhatIfOpen(true);
  };

  const handleOpenWhatIfGrades = (courseCode?: string) => {
    setWhatIfDefaultCourse(courseCode);
    setWhatIfDefaultTab("grades");
    setWhatIfOpen(true);
  };

  const displayName =
    summary?.student_name || profile?.full_name || user?.user_metadata?.full_name || "Arjun Mehta";
  const rollNo = summary?.roll_no || profile?.roll_no || "102203099";
  const branch = summary?.branch || profile?.branch || "COE";
  const semester = summary?.semester || profile?.semester || 5;

  return (
    <div className="space-y-8">
      {/* ========================================================
          1. WELCOME HEADER & QUICK ACTIONS
      ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-color)] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Welcome back, {displayName}
            </h1>
            <Badge variant="primary" size="sm" dot>
              Active Session
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Thapar Institute · {branch} · Semester {semester} · Roll No: <span className="font-mono font-semibold">{rollNo}</span>
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDataEntryTab("csv");
              setDataEntryOpen(true);
            }}
            leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-[var(--action-primary)]" />}
          >
            Import CSV
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDataEntryTab("course");
              setDataEntryOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5 text-[var(--action-primary)]" />}
          >
            Add Data
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenWhatIfAttendance()}
            leftIcon={<Sliders className="w-3.5 h-3.5" />}
          >
            What-If Planner
          </Button>
        </div>
      </div>

      {/* Error notice if backend unreachable */}
      {error && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="underline font-semibold hover:text-amber-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton variant="card" height={160} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton variant="card" height={180} />
            <Skeleton variant="card" height={180} />
            <Skeleton variant="card" height={180} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton variant="card" height={220} />
            <Skeleton variant="card" height={220} />
          </div>
        </div>
      ) : (
        <>
          {/* ========================================================
              2. TOP: TODAY'S ACTION PLAN & DECISION INTELLIGENCE
          ======================================================== */}
          {dailyPlan && (
            <ActionPlanList
              initialActions={dailyPlan.actions}
              recommendedFocus={dailyPlan.recommended_focus}
              onOpenWhatIf={handleOpenWhatIfAttendance}
              onActionDismiss={() => {
                // Optional refresh or sync
              }}
            />
          )}

          {/* ========================================================
              3. ATTENDANCE SECTION
          ======================================================== */}
          {summary && summary.courses.length > 0 && (
            <AttendanceGrid
              courses={summary.courses}
              onAttendanceUpdated={loadData}
              onOpenWhatIf={(code) => handleOpenWhatIfAttendance(code)}
            />
          )}

          {/* ========================================================
              4. GRADES & WEIGHTED PROGRESS SECTION
          ======================================================== */}
          {summary && summary.courses.length > 0 && (
            <GradesSection
              courses={summary.courses}
              assessmentsSummary={summary.assessments_summary}
              onOpenGradeWhatIf={(code) => handleOpenWhatIfGrades(code)}
            />
          )}

          {/* ========================================================
              5. TIMETABLE & DEADLINES (TWO-COLUMN GRID)
          ======================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TimetableSection slots={timetable} />
            </div>

            <div>
              <UpcomingDeadlinesList
                deadlines={deadlines}
                onDeadlineToggled={loadData}
                onAddTask={() => {
                  setDataEntryTab("assessment");
                  setDataEntryOpen(true);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ========================================================
          6. WHAT-IF PLANNER DRAWER / MODAL
      ======================================================== */}
      {summary && (
        <WhatIfPlannerDrawer
          isOpen={whatIfOpen}
          onClose={() => setWhatIfOpen(false)}
          courses={summary.courses}
          defaultCourseCode={whatIfDefaultCourse}
          defaultTab={whatIfDefaultTab}
        />
      )}

      {/* ========================================================
          7. DATA ENTRY & CSV BULK IMPORT MODAL
      ======================================================== */}
      {summary && (
        <DataEntryModal
          isOpen={dataEntryOpen}
          onClose={() => setDataEntryOpen(false)}
          courses={summary.courses}
          defaultTab={dataEntryTab}
          onDataChanged={loadData}
        />
      )}
    </div>
  );
}
