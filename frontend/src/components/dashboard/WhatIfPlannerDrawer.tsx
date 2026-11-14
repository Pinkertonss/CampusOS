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
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Select Course:
            </span>
            <select
              value={selectedCourseCode}
              onChange={(e) => setSelectedCourseCode(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.percentage}%)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center p-1 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === "attendance"
                  ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Attendance Simulation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("grades")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === "grades"
                  ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              {/* Attend Next N Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
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
                  <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
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
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border border-teal-800/40 shadow-md space-y-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Live Attendance Projection
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  {/* BEFORE */}
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="text-[11px] text-slate-400 font-medium">Current Status</div>
                    <div className="text-2xl font-bold text-slate-100 font-mono">
                      {attResult.current_percent}%
                    </div>
                    <div className="text-xs text-slate-400">
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
                  <div className="flex items-center justify-center text-teal-400">
                    <ArrowRight className="w-6 h-6 hidden sm:block" />
                    <span className="sm:hidden text-xs text-teal-400 font-semibold">
                      Becomes ↓
                    </span>
                  </div>

                  {/* AFTER (PROJECTED) */}
                  <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-700/60 space-y-1">
                    <div className="text-[11px] text-teal-300 font-medium">Projected Outcome</div>
                    <div className="text-2xl font-bold text-teal-300 font-mono">
                      {attResult.projected_percent}%
                    </div>
                    <div className="text-xs text-teal-200/80">
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
                <div className="p-3 rounded-xl bg-teal-900/30 border border-teal-800/60 text-xs text-teal-200">
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
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-teal-500" />
                  Target Final Score / Grade:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={targetTotalGrade}
                    onChange={(e) => setTargetTotalGrade(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  >
                    <option value="90">90% — Grade A+</option>
                    <option value="80">80% — Grade A</option>
                    <option value="75">75% — Grade A-</option>
                    <option value="70">70% — Grade B</option>
                    <option value="60">60% — Grade C</option>
                  </select>
                </div>
              </div>

              {/* Assessment Hypothetical Inputs Table */}
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden bg-white dark:bg-slate-800/60">
                <div className="grid grid-cols-3 gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <span>Assessment</span>
                  <span>Weight %</span>
                  <span>Hypothetical Score</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                  <div className="grid grid-cols-3 gap-2 px-3.5 py-2.5 items-center">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      MST-1 &amp; MST-2 (Completed)
                    </span>
                    <span className="text-slate-400">40% weight</span>
                    <span className="font-mono text-emerald-500 font-bold">31.5% scored</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 px-3.5 py-3 items-center">
                    <span className="font-medium text-teal-600 dark:text-teal-400">
                      End Semester Exam (Pending)
                    </span>
                    <span className="text-slate-400">60% weight</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={endSemHypoScore}
                        onChange={(e) => setEndSemHypoScore(Number(e.target.value))}
                        className="w-24 sm:w-32 accent-teal-500"
                      />
                      <span className="font-mono font-bold text-xs text-teal-500">
                        {endSemHypoScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Result Card */}
            {gradeResult && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-sky-800/40 shadow-md space-y-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Live Grade Projection
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="text-[11px] text-slate-400 font-medium">Completed Score</div>
                    <div className="text-2xl font-bold text-slate-100 font-mono">
                      {gradeResult.current_weighted_score}%
                    </div>
                    <div className="text-xs text-slate-400">
                      across {gradeResult.completed_weight}% completed weight
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-sky-400">
                    <ArrowRight className="w-6 h-6 hidden sm:block" />
                    <span className="sm:hidden text-xs text-sky-400 font-semibold">
                      Projects to ↓
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-700/60 space-y-1">
                    <div className="text-[11px] text-sky-300 font-medium">Projected Final Grade</div>
                    <div className="text-2xl font-bold text-sky-300 font-mono">
                      {gradeResult.projected_total_score}%
                    </div>
                    <Badge variant="primary" size="sm">
                      Grade {gradeResult.projected_letter_grade}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-sky-900/30 border border-sky-800/60 text-xs text-sky-200">
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
