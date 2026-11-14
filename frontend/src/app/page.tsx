"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  Repeat,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  getCourses,
  getAttendance,
  getTimetable,
  getDeadlines,
  getImpactMetrics,
  toggleDeadline,
} from "../lib/api";
import { Course, AttendanceRecord, TimetableSlot, DeadlineTask, ImpactMetrics } from "../types";

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineTask[]>([]);
  const [impact, setImpact] = useState<ImpactMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [c, a, t, d, imp] = await Promise.all([
          getCourses(),
          getAttendance(),
          getTimetable(),
          getDeadlines(),
          getImpactMetrics(),
        ]);
        setCourses(c);
        setAttendance(a);
        setTimetable(t);
        setDeadlines(d);
        setImpact(imp);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleToggleTask = async (taskId: string) => {
    try {
      const updated = await toggleDeadline(taskId);
      setDeadlines((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    } catch {
      // Optimistic fallback
      setDeadlines((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, status: task.status === "pending" ? "completed" : "pending" }
            : task
        )
      );
    }
  };

  // Check for any attendance risks (< 75%)
  const warningCourses = attendance.filter((a) => a.percentage < 75.0);
  const avgAttendance =
    attendance.length > 0
      ? (attendance.reduce((sum, a) => sum + a.percentage, 0) / attendance.length).toFixed(1)
      : "0";

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-950 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                Thapar Institute Pilot
              </span>
              <span className="text-xs text-slate-400">Odd Semester 2024-25</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Welcome back, Gurasees
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Roll No: 102203099 • 5th Semester • B.E. Computer Engineering (COE)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/copilot"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 text-sm font-medium transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Ask Copilot
            </Link>
            <Link
              href="/academic"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-md shadow-red-950 transition-all"
            >
              <GraduationCap className="w-4 h-4" />
              What-If Planner
            </Link>
          </div>
        </div>
      </div>

      {/* Attendance Alert if any course < 75% */}
      {warningCourses.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-4 flex items-start gap-4 text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-amber-300">
              Attendance Alert: {warningCourses.length} course(s) below Thapar&apos;s 75% rule
            </div>
            <p className="text-xs text-amber-200/80 mt-1">
              {warningCourses
                .map(
                  (c) =>
                    `${c.course_code} (${c.percentage}%, needs ${c.classes_needed_for_75} consecutive class(es))`
                )
                .join(" • ")}
            </p>
          </div>
          <Link
            href="/academic"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 shrink-0"
          >
            Open Planner
          </Link>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CGPA */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Cumulative CGPA</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">8.42</span>
            <span className="text-xs text-emerald-400 font-semibold">+0.15 proj</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">TIET 10-Point Scale • 5 Registered Courses</p>
        </div>

        {/* Attendance Avg */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Average Attendance</span>
            <GraduationCap className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{avgAttendance}%</span>
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                Number(avgAttendance) >= 75
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {Number(avgAttendance) >= 75 ? "Safe" : "Warning"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">75% Mandatory threshold for EST exams</p>
        </div>

        {/* Digital Vault */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Digital Vault</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">4</span>
            <span className="text-xs text-blue-400 font-semibold">Docs Encrypted</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Row Level Security • Private Buckets</p>
        </div>

        {/* Campus Reuse */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Campus Reuse Impact</span>
            <Repeat className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              ₹{impact ? impact.total_money_saved_inr.toLocaleString() : "6,400"}
            </span>
            <span className="text-xs text-purple-300 font-semibold">Saved</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {impact ? impact.total_waste_diverted_kg : "17.1"} kg waste diverted at TIET
          </p>
        </div>
      </div>

      {/* Main Content Grid: Timetable & Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Timetable */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Today&apos;s Schedule (Monday)</h2>
              <p className="text-xs text-slate-400">Classrooms and lab venues at Thapar campus</p>
            </div>
            <Link
              href="/academic"
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-medium"
            >
              Full Week <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {timetable
              .filter((t) => t.day_of_week === "Monday")
              .map((slot) => (
                <div
                  key={slot.id}
                  className="p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        slot.slot_type === "Lab"
                          ? "bg-purple-900/60 text-purple-300 border border-purple-700"
                          : "bg-red-950 text-red-300 border border-red-800"
                      }`}
                    >
                      {slot.slot_type === "Lab" ? "LAB" : "LEC"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        {slot.course_code}: {slot.course_name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-slate-300 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {slot.start_time} - {slot.end_time}
                        </span>
                        <span>•</span>
                        <span className="text-amber-400 font-medium">Venue: {slot.venue}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">
                    {slot.slot_type}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Deadlines & Actionable Tasks */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Deadlines & Actionable Tasks</h2>
              <p className="text-xs text-slate-400">Assignments, project submissions, and notice tasks</p>
            </div>
            <Link
              href="/academic"
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-medium"
            >
              Manage Tasks <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {deadlines.slice(0, 4).map((task) => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className={`p-3.5 rounded-lg border flex items-start gap-3 cursor-pointer transition-all ${
                  task.status === "completed"
                    ? "bg-slate-900/60 border-slate-800 opacity-60"
                    : "bg-slate-800/60 border-slate-700/60 hover:border-slate-600"
                }`}
              >
                <button
                  type="button"
                  className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      task.status === "completed" ? "text-emerald-400 fill-emerald-400/20" : ""
                    }`}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      task.status === "completed" ? "line-through text-slate-400" : "text-white"
                    }`}
                  >
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    {task.course_code && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {task.course_code}
                      </span>
                    )}
                    <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                    {task.source === "copilot_action" && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/50 text-[10px] font-semibold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI Confirmed
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                    task.priority === "high"
                      ? "bg-red-500/20 text-red-300"
                      : task.priority === "medium"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module Quick Access Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        <Link
          href="/academic"
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-600/50 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-red-950 text-red-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors">
            Academic & What-If
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Simulate safe bunks, 75% attendance recovery, and target CGPA scenarios.
          </p>
        </Link>

        <Link
          href="/copilot"
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-950 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">
            Campus Copilot
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            RAG verified answers with official citations. Turn notices into tasks.
          </p>
        </Link>

        <Link
          href="/vault"
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
            Digital Vault
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Private, encrypted storage for marks, certificates, and ID cards.
          </p>
        </Link>

        <Link
          href="/reuse"
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Repeat className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white group-hover:text-purple-400 transition-colors">
            Campus Reuse
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Exchange books, calculators, and lab gear with real-time impact tracking.
          </p>
        </Link>
      </div>
    </div>
  );
}
