"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Sliders,
  Target,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Skeleton,
} from "../../components/ui";
import {
  getAcademicSummary,
  postAttendanceWhatIf,
  postGradeWhatIf,
} from "../../lib/api";
import {
  AcademicSummaryResponse,
  AcademicSummaryCourse,
  AttendanceWhatIfPlannerResponse,
  GradeWhatIfPlannerResponse,
} from "../../types";
import WhatIfPlannerDrawer from "../../components/dashboard/WhatIfPlannerDrawer";

export default function AcademicPlannerPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AcademicSummaryResponse | null>(null);

  // Simulation Mode: "grades" | "attendance"
  const [simMode, setSimMode] = useState<"grades" | "attendance">("grades");
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>("UCS301");

  // Grade Simulation State
  const [targetGrade, setTargetGrade] = useState<number>(80.0);
  const [endSemHypoScore, setEndSemHypoScore] = useState<number>(85.0);
  const [gradeResult, setGradeResult] = useState<GradeWhatIfPlannerResponse | null>(null);
  const [simulatingGrade, setSimulatingGrade] = useState(false);

  // Attendance Simulation State
  const [attendNextN, setAttendNextN] = useState<number>(4);
  const [skipNextM, setSkipNextM] = useState<number>(0);
  const [attResult, setAttResult] = useState<AttendanceWhatIfPlannerResponse | null>(null);
  const [simulatingAtt, setSimulatingAtt] = useState(false);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"attendance" | "grades">("grades");
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAcademicSummary();
      setSummary(data);
      if (data.courses && data.courses.length > 0) {
        setSelectedCourseCode(data.courses[0].code);
      }
      setError(null);
    } catch (err: unknown) {
      console.error("Failed to load academic summary:", err);
      setError(err instanceof Error ? err.message : "Failed to load academic records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCourse =
    summary?.courses.find((c) => c.code === selectedCourseCode) ||
    summary?.courses[0];

  // Run Grade Simulation
  useEffect(() => {
    const course = activeCourse;
    if (!course) return;
    let isCurrent = true;

    async function runSim() {
      if (!course) return;
      setSimulatingGrade(true);
      try {
        const res = await postGradeWhatIf({
          course_code: course.code,
          target_total_percent: targetGrade,
          hypothetical_scores: {
            "End Semester": endSemHypoScore,
          },
        });
        if (isCurrent) setGradeResult(res);
      } catch (err) {
        console.error("Grade sim error:", err);
      } finally {
        if (isCurrent) setSimulatingGrade(false);
      }
    }

    runSim();
    return () => {
      isCurrent = false;
    };
  }, [activeCourse, targetGrade, endSemHypoScore]);

  // Run Attendance Simulation
  useEffect(() => {
    const course = activeCourse;
    if (!course) return;
    let isCurrent = true;

    async function runSim() {
      if (!course) return;
      setSimulatingAtt(true);
      try {
        const res = await postAttendanceWhatIf({
          course_code: course.code,
          attended: course.attended,
          total_held: course.total_held,
          attend_next_n: attendNextN,
          skip_next_m: skipNextM,
          target_percent: 75.0,
        });
        if (isCurrent) setAttResult(res);
      } catch (err) {
        console.error("Attendance sim error:", err);
      } finally {
        if (isCurrent) setSimulatingAtt(false);
      }
    }

    runSim();
    return () => {
      isCurrent = false;
    };
  }, [activeCourse, attendNextN, skipNextM]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Academic Dashboard &amp; What-If Planner
            </h1>
            <Badge variant="warning" size="md">
              75% TIET Rule
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulate missed lectures, target exam scores, and forecast attendance safety margins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Link href="/">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Overview
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-center justify-between gap-4 text-red-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold">Academic Service Error:</span>
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={loadData}>
            Retry Connection
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton variant="card" />
          <Skeleton variant="table" rows={5} columns={4} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Simulation Engine Card */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <Sparkles className="w-5 h-5 text-[var(--action-primary)]" />
                      <span>Interactive What-If Simulation Engine</span>
                    </CardTitle>
                    <CardDescription>
                      Deterministic academic forecasting backed by official TIET evaluation scheme
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setSimMode("grades")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        simMode === "grades"
                          ? "bg-white dark:bg-slate-900 text-[var(--action-primary)] shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Grade Simulation
                    </button>
                    <button
                      onClick={() => setSimMode("attendance")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        simMode === "attendance"
                          ? "bg-white dark:bg-slate-900 text-[var(--action-primary)] shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Attendance Simulation
                    </button>
                  </div>
                </div>
              </CardHeader>

              <div className="p-6 space-y-6">
                {/* Course Selection */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Select Target Course:
                  </span>
                  <select
                    value={selectedCourseCode}
                    onChange={(e) => setSelectedCourseCode(e.target.value)}
                    className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
                  >
                    {summary?.courses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name} ({c.percentage}%)
                      </option>
                    ))}
                  </select>
                </div>

                {/* GRADE SIMULATION MODE */}
                {simMode === "grades" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Target Grade Selector */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-[var(--action-primary)]" />
                          Target Overall Score:
                        </label>
                        <select
                          value={targetGrade}
                          onChange={(e) => setTargetGrade(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
                        >
                          <option value="90">90% — Grade A+ (Exceptional)</option>
                          <option value="85">85% — Grade A (Excellent)</option>
                          <option value="80">80% — Grade A (Standard)</option>
                          <option value="75">75% — Grade A- (Very Good)</option>
                          <option value="70">70% — Grade B (Good)</option>
                          <option value="60">60% — Grade C (Satisfactory)</option>
                        </select>
                      </div>

                      {/* End Semester Hypothetical Slider */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <Sliders className="w-4 h-4 text-[var(--action-primary)]" />
                            Simulated End-Sem Score:
                          </span>
                          <span className="font-mono text-[var(--action-primary)] font-bold">
                            {endSemHypoScore}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={endSemHypoScore}
                          onChange={(e) => setEndSemHypoScore(Number(e.target.value))}
                          className="w-full accent-[var(--action-primary)] cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>0%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    {/* Required Score Banner */}
                    {gradeResult && gradeResult.required_percent_on_remaining !== null && (
                      <div
                        className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                          gradeResult.is_achievable
                            ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                            : "bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 shrink-0" />
                          <span>
                            Target {targetGrade}%: Requires{" "}
                            <strong>{gradeResult.required_percent_on_remaining}%</strong> on the remaining {gradeResult.remaining_weight}% weight.
                          </span>
                        </div>
                        <Badge variant={gradeResult.is_achievable ? "success" : "danger"} size="sm">
                          {gradeResult.is_achievable ? "Achievable" : "Unattainable"}
                        </Badge>
                      </div>
                    )}

                    {/* Grade Outcome Card */}
                    {gradeResult && (
                      <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] space-y-4">
                        <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                          Forecasted Academic Outcome
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

                        <div className="p-3 rounded-xl bg-sky-900/30 border border-sky-800/60 text-xs text-sky-200">
                          {gradeResult.message}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ATTENDANCE SIMULATION MODE */}
                {simMode === "attendance" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Attend Next N Slider */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Attend Next Classes:
                          </span>
                          <span className="font-mono text-emerald-600 font-bold">
                            +{attendNextN} classes
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="15"
                          value={attendNextN}
                          onChange={(e) => setAttendNextN(Number(e.target.value))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>0</span>
                          <span>7</span>
                          <span>15</span>
                        </div>
                      </div>

                      {/* Skip Next M Slider */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Miss / Skip Next Classes:
                          </span>
                          <span className="font-mono text-amber-600 font-bold">
                            +{skipNextM} missed
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          value={skipNextM}
                          onChange={(e) => setSkipNextM(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>0</span>
                          <span>5</span>
                          <span>10</span>
                        </div>
                      </div>
                    </div>

                    {/* Attendance Result Card */}
                    {attResult && (
                      <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] space-y-4">
                        <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                          Live Attendance Projection
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                          <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] space-y-1">
                            <div className="text-[11px] text-[var(--text-secondary)] font-medium">Current Status</div>
                            <div className="text-2xl font-bold text-[var(--text-primary)] font-mono">
                              {attResult.current_percent}%
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">
                              {attResult.current_attended}/{attResult.current_total_held} held
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

                          <div className="flex items-center justify-center text-[var(--action-primary)]">
                            <ArrowRight className="w-6 h-6 hidden sm:block" />
                            <span className="sm:hidden text-xs text-[var(--action-primary)] font-semibold">
                              Becomes ↓
                            </span>
                          </div>

                          <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] space-y-1">
                            <div className="text-[11px] text-[var(--action-primary)] font-medium">Projected Outcome</div>
                            <div className="text-2xl font-bold text-[var(--action-primary)] font-mono">
                              {attResult.projected_percent}%
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">
                              {attResult.projected_attended}/{attResult.projected_total_held} total
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

                        <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]">
                          {attResult.message}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setDrawerTab(simMode);
                      setIsDrawerOpen(true);
                    }}
                    leftIcon={<Sliders className="w-4 h-4" />}
                  >
                    Open Advanced Drawer
                  </Button>
                </div>
              </div>
            </Card>

            {/* Courses Overview Table */}
            <Card
              header={
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[var(--action-primary)]" />
                  <span>Enrolled Courses &amp; Current Attendance Standing</span>
                </CardTitle>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700/60 uppercase">
                    <tr>
                      <th className="p-3">Course</th>
                      <th className="p-3">Attendance</th>
                      <th className="p-3">Safe Bunks</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary?.courses.map((c) => (
                      <tr
                        key={c.code}
                        onClick={() => setSelectedCourseCode(c.code)}
                        className={`cursor-pointer transition-colors ${
                          c.code === selectedCourseCode
                            ? "bg-[var(--surface-secondary)] font-medium"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {c.code}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                            {c.name}
                          </div>
                        </td>
                        <td className="p-3 font-mono">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {c.percentage}%
                          </span>
                          <span className="text-slate-400 ml-1.5">
                            ({c.attended}/{c.total_held})
                          </span>
                        </td>
                        <td className="p-3 font-mono">
                          {c.safe_bunks_remaining > 0 ? (
                            <span className="text-emerald-500 font-bold">
                              {c.safe_bunks_remaining} bunks left
                            </span>
                          ) : (
                            <span className="text-amber-500 font-medium">
                              Need {c.classes_needed_for_75 ?? 1} classes
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              c.status === "safe"
                                ? "success"
                                : c.status === "warning"
                                ? "warning"
                                : "danger"
                            }
                            size="sm"
                          >
                            {c.status.toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right Column: TIET Regulations & Academic Policies */}
          <div className="space-y-6">
            <Card
              header={
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>TIET Regulation 2.1</span>
                </CardTitle>
              }
            >
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <p>
                  Minimum attendance requirement is <strong>75% in each course</strong>.
                  Students falling below 75% are detained from taking end-semester examinations.
                </p>
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200">
                  Shortage up to 10% may be condoned by the Dean only on documented medical grounds submitted within 7 days.
                </div>
              </div>
            </Card>

            <Card
              header={
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-sky-500" />
                  <span>Evaluation &amp; Grading</span>
                </CardTitle>
              }
            >
              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Mid Semester Test (MST)</span>
                  <span className="font-semibold text-slate-900 dark:text-white">30%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Continuous Lab &amp; Sessional</span>
                  <span className="font-semibold text-slate-900 dark:text-white">20%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>End Semester Examination</span>
                  <span className="font-semibold text-slate-900 dark:text-white">50%</span>
                </div>
                <p className="pt-2 text-[11px] text-slate-500">
                  Final letter grades are assigned on a relative grading curve established by the Senate Academic Committee.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Drawer */}
      {summary && summary.courses && (
        <WhatIfPlannerDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          courses={summary.courses}
          defaultCourseCode={selectedCourseCode}
          defaultTab={drawerTab}
        />
      )}
    </div>
  );
}
