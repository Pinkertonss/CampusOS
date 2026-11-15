"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Calculator,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sliders,
  Award,
  Target,
} from "lucide-react";
import { Modal, Button, Badge } from "../ui";
import {
  AcademicSummaryCourse,
  AttendanceWhatIfPlannerResponse,
  GradeWhatIfPlannerResponse,
} from "../../types";
import { postAttendanceWhatIf, postGradeWhatIf } from "../../lib/api";

interface WhatIfPlannerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  courses: AcademicSummaryCourse[];
  defaultCourseCode?: string;
  defaultTab?: "attendance" | "grades";
}

export default function WhatIfPlannerDrawer({
  isOpen,
  onClose,
  courses,
  defaultCourseCode,
  defaultTab = "attendance",
}: WhatIfPlannerDrawerProps) {
  const [activeTab, setActiveTab] = useState<"attendance" | "grades">(defaultTab);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(
    defaultCourseCode || (courses[0]?.code ?? "UCS301")
  );

  // Attendance Simulation State
  const [attendNextN, setAttendNextN] = useState<number>(3);
  const [skipNextM, setSkipNextM] = useState<number>(0);
  const [attResult, setAttResult] = useState<AttendanceWhatIfPlannerResponse | null>(null);
  const [loadingAtt, setLoadingAtt] = useState(false);

  // Grade Simulation State
  const [targetTotalGrade, setTargetTotalGrade] = useState<number>(80.0);
  const [endSemHypoScore, setEndSemHypoScore] = useState<number>(85.0);
  const [gradeResult, setGradeResult] = useState<GradeWhatIfPlannerResponse | null>(null);
  const [loadingGrade, setLoadingGrade] = useState(false);

  useEffect(() => {
    if (defaultCourseCode) {
      setSelectedCourseCode(defaultCourseCode);
    }
  }, [defaultCourseCode]);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Find selected course data
  const currentCourse = courses.find((c) => c.code === selectedCourseCode) || courses[0];

  // Re-calculate Attendance What-If
  useEffect(() => {
    if (!currentCourse) return;

    let isMounted = true;
    async function runAttendanceSimulation() {
      setLoadingAtt(true);
      try {
        const res = await postAttendanceWhatIf({
          course_code: currentCourse.code,
          attended: currentCourse.attended,
          total_held: currentCourse.total_held,
          attend_next_n: attendNextN,
          skip_next_m: skipNextM,
          target_percent: 75.0,
        });
        if (isMounted) setAttResult(res);
      } catch (e) {
        console.error("Attendance simulation error:", e);
      } finally {
        if (isMounted) setLoadingAtt(false);
      }
    }

    runAttendanceSimulation();
    return () => {
      isMounted = false;
    };
  }, [currentCourse, attendNextN, skipNextM]);

  // Re-calculate Grade What-If
  useEffect(() => {
    if (!currentCourse) return;

    let isMounted = true;
    async function runGradeSimulation() {
      setLoadingGrade(true);
      try {
        const res = await postGradeWhatIf({
          course_code: currentCourse.code,
          target_total_percent: targetTotalGrade,
          hypothetical_scores: {
            "End Semester": endSemHypoScore,
          },
        });
        if (isMounted) setGradeResult(res);
      } catch (e) {
        console.error("Grade simulation error:", e);
      } finally {
        if (isMounted) setLoadingGrade(false);
      }
    }

    runGradeSimulation();
    return () => {
      isMounted = false;
    };
  }, [currentCourse, targetTotalGrade, endSemHypoScore]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] text-[var(--action-primary)] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-[var(--text-primary)]">
              What-If Academic Planner
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Simulate attendance and final grades with live projections
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Course Selector & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Select Course:
            </span>
            <select
              value={selectedCourseCode}
              onChange={(e) => setSelectedCourseCode(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
            >
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.percentage}%)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center p-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-color)] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === "attendance"
                  ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Attendance Simulation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("grades")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === "grades"
                  ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Grade Simulation
            </button>
          </div>
        </div>

        {/* TAB 1: ATTENDANCE WHAT-IF */}
        {activeTab === "attendance" && (
          <div className="space-y-5">
            {/* Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
              {/* Attend Next N Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Attend next classes (N):
                  </label>
                  <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    +{attendNextN}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={attendNextN}
                  onChange={(e) => setAttendNextN(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0 classes</span>
                  <span>10 classes</span>
                  <span>20 classes</span>
                </div>
              </div>

              {/* Skip Next M Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Skip upcoming classes (M):
                  </label>
                  <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                    +{skipNextM}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={skipNextM}
                  onChange={(e) => setSkipNextM(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0 classes</span>
                  <span>5 classes</span>
                  <span>10 classes</span>
                </div>
              </div>
            </div>

            {/* Before vs After Comparison Card */}
            {attResult && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-color)] shadow-xs space-y-4">
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Live Attendance Projection
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  {/* BEFORE */}
                  <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] space-y-1">
                    <div className="text-[11px] text-[var(--text-secondary)] font-medium">Current Status</div>
                    <div className="text-2xl font-bold text-[var(--text-primary)] font-mono">
                      {attResult.current_percent}%
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {attResult.current_attended}/{attResult.current_total_held} classes held
                    </div>
                    <Badge
                      variant={
                        attResult.current_status === "safe"
                          ? "success"
                          : attResult.current_status === "warning"
                          ? "warning"
                          : "danger"
                      }
                      size="sm"
                    >
                      {attResult.current_status.toUpperCase()}
                    </Badge>
                  </div>

                  {/* ARROW */}
                  <div className="flex items-center justify-center text-[var(--action-primary)]">
                    <ArrowRight className="w-6 h-6 hidden sm:block" />
                    <span className="sm:hidden text-xs text-[var(--action-primary)] font-semibold">
                      Becomes ↓
                    </span>
                  </div>

                  {/* AFTER (PROJECTED) */}
                  <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] space-y-1">
                    <div className="text-[11px] text-[var(--action-primary)] font-medium">Projected Outcome</div>
                    <div className="text-2xl font-bold text-[var(--action-primary)] font-mono">
                      {attResult.projected_percent}%
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {attResult.projected_attended}/{attResult.projected_total_held} classes
                    </div>
                    <Badge
                      variant={
                        attResult.projected_status === "safe"
                          ? "success"
                          : attResult.projected_status === "warning"
                          ? "warning"
                          : "danger"
                      }
                      size="sm"
                    >
                      {attResult.projected_status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Plain-English Advice */}
                <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]">
                  {attResult.message}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GRADE WHAT-IF */}
        {activeTab === "grades" && (
          <div className="space-y-5">
            {/* Target and Hypothetical Input Table */}
            <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-[var(--action-primary)]" />
                  Target Final Score / Grade:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={targetTotalGrade}
                    onChange={(e) => setTargetTotalGrade(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <option value="90">90% — Grade A+</option>
                    <option value="80">80% — Grade A</option>
                    <option value="75">75% — Grade A-</option>
                    <option value="70">70% — Grade B</option>
                    <option value="60">60% — Grade C</option>
                  </select>
                </div>
              </div>

              {/* Required Score on Remaining Weight Banner */}
              {gradeResult && gradeResult.required_percent_on_remaining !== null && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                    gradeResult.is_achievable
                      ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                      : "bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 shrink-0" />
                    <span>
                      Target {targetTotalGrade}%: Requires{" "}
                      <strong>{gradeResult.required_percent_on_remaining}%</strong> average across remaining assessments ({gradeResult.remaining_weight}% weight).
                    </span>
                  </div>
                  <Badge variant={gradeResult.is_achievable ? "success" : "danger"} size="sm">
                    {gradeResult.is_achievable ? "Achievable" : "Unattainable"}
                  </Badge>
                </div>
              )}

              {/* Assessment Hypothetical Inputs Table */}
              <div className="border border-[var(--border-color)]/80 rounded-xl overflow-hidden bg-white dark:bg-slate-800/60">
                <div className="grid grid-cols-3 gap-2 px-3.5 py-2.5 bg-[var(--surface-secondary)] text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <span>Assessment</span>
                  <span>Weight %</span>
                  <span>Score / Projection</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                  <div className="grid grid-cols-3 gap-2 px-3.5 py-2.5 items-center">
                    <span className="font-medium text-[var(--text-primary)]">
                      Completed Assessments (MST/Sessional)
                    </span>
                    <span className="text-slate-400">
                      {gradeResult ? `${gradeResult.completed_weight}% weight` : "50% weight"}
                    </span>
                    <span className="font-mono text-emerald-500 font-bold">
                      {gradeResult ? `${gradeResult.current_weighted_score}% scored` : "Loading..."}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 px-3.5 py-3 items-center">
                    <span className="font-medium text-[var(--action-primary)]">
                      End Semester Examination (Pending)
                    </span>
                    <span className="text-slate-400">
                      {gradeResult ? `${gradeResult.remaining_weight}% weight` : "50% weight"}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={endSemHypoScore}
                        onChange={(e) => setEndSemHypoScore(Number(e.target.value))}
                        className="w-24 sm:w-32 accent-[var(--action-primary)] cursor-pointer"
                      />
                      <span className="font-mono font-bold text-xs text-[var(--action-primary)] w-10">
                        {endSemHypoScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Result Card */}
            {gradeResult && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-color)] shadow-xs space-y-4">
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Live Grade Projection
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] space-y-1">
                    <div className="text-[11px] text-[var(--text-secondary)] font-medium">Completed Score</div>
                    <div className="text-2xl font-bold text-[var(--text-primary)] font-mono">
                      {gradeResult.current_weighted_score}%
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      across {gradeResult.completed_weight}% completed weight
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-[var(--action-primary)]">
                    <ArrowRight className="w-6 h-6 hidden sm:block" />
                    <span className="sm:hidden text-xs text-[var(--action-primary)] font-semibold">
                      Projects to ↓
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] space-y-1">
                    <div className="text-[11px] text-[var(--text-primary)] font-medium">Projected Final Grade</div>
                    <div className="text-2xl font-bold text-[var(--text-primary)] font-mono">
                      {gradeResult.projected_total_score}%
                    </div>
                    <Badge variant="primary" size="sm">
                      Grade {gradeResult.projected_letter_grade}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]">
                  {gradeResult.message}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
