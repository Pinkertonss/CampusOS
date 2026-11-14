"use client";

import { useEffect, useState } from "react";
import {
  GraduationCap,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Upload,
  Plus,
  RefreshCw,
  Calculator,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import {
  getCourses,
  getAttendance,
  getTimetable,
  getDeadlines,
  simulateAttendance,
  simulateGrades,
  updateAttendance,
  addCourse,
  createDeadline,
  toggleDeadline,
  uploadCSV,
} from "../../lib/api";
import {
  Course,
  AttendanceRecord,
  TimetableSlot,
  DeadlineTask,
  WhatIfAttendanceResponse,
  WhatIfGradeResponse,
} from "../../types";

const GRADE_POINTS: Record<string, number> = {
  "A+": 10.0,
  "A": 10.0,
  "A-": 9.0,
  "B": 8.0,
  "B-": 7.0,
  "C": 6.0,
  "C-": 5.0,
  "D": 4.0,
  "E": 2.0,
  "F": 0.0,
};

export default function AcademicPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Active tab in What-if Planner
  const [activePlannerTab, setActivePlannerTab] = useState<"attendance" | "grades">("attendance");
  const [activeDay, setActiveDay] = useState("Monday");

  // Attendance What-If State
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>("UCS405");
  const [upcomingTotal, setUpcomingTotal] = useState<number>(6);
  const [upcomingAttend, setUpcomingAttend] = useState<number>(6);
  const [simAttendanceResult, setSimAttendanceResult] = useState<WhatIfAttendanceResponse | null>(null);

  // Grade What-If State
  const [targetCGPA, setTargetCGPA] = useState<number>(8.5);
  const [courseTargets, setCourseTargets] = useState<Record<string, string>>({});
  const [gradeSimResult, setGradeSimResult] = useState<WhatIfGradeResponse | null>(null);

  // Modals
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvType, setCsvType] = useState<"attendance" | "courses">("attendance");
  const [csvStatus, setCsvStatus] = useState<string>("");

  // Form states
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCredits, setNewCourseCredits] = useState("4.0");
  const [newCourseGrade, setNewCourseGrade] = useState("A");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCourse, setNewTaskCourse] = useState("UCS301");
  const [newTaskDueDate, setNewTaskDueDate] = useState("2024-11-25T23:59");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");

  const loadData = async () => {
    try {
      const [c, a, t, d] = await Promise.all([
        getCourses(),
        getAttendance(),
        getTimetable(),
        getDeadlines(),
      ]);
      setCourses(c);
      setAttendance(a);
      setTimetable(t);
      setDeadlines(d);

      // Initialize grade targets
      const initialTargets: Record<string, string> = {};
      c.forEach((crs) => {
        initialTargets[crs.course_code] = crs.target_grade || crs.grade || "A";
      });
      setCourseTargets(initialTargets);

      if (a.length > 0 && !selectedCourseCode) {
        setSelectedCourseCode(a[0].course_code);
      }
    } catch (e) {
      console.error("Failed to load academic data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Run Attendance Simulation
  useEffect(() => {
    const currentRec = attendance.find((a) => a.course_code === selectedCourseCode);
    if (!currentRec) return;

    simulateAttendance({
      course_code: selectedCourseCode,
      attended_classes: currentRec.attended_classes,
      total_classes: currentRec.total_classes,
      upcoming_classes_to_attend: upcomingAttend,
      total_upcoming_classes: upcomingTotal,
    })
      .then(setSimAttendanceResult)
      .catch((err) => console.error("Attendance sim error:", err));
  }, [selectedCourseCode, upcomingAttend, upcomingTotal, attendance]);

  // Run Grade Simulation
  useEffect(() => {
    if (courses.length === 0) return;

    const scenarios = courses.map((crs) => ({
      course_code: crs.course_code,
      credits: crs.credits,
      target_grade: courseTargets[crs.course_code] || "A",
    }));

    simulateGrades({
      current_cgpa: 8.35,
      completed_credits: 76.0,
      target_cgpa: targetCGPA,
      current_semester_courses: scenarios,
    })
      .then(setGradeSimResult)
      .catch((err) => console.error("Grade sim error:", err));
  }, [courses, courseTargets, targetCGPA]);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode || !newCourseName) return;
    try {
      await addCourse({
        course_code: newCourseCode,
        course_name: newCourseName,
        credits: parseFloat(newCourseCredits),
        target_grade: newCourseGrade,
      });
      setShowAddCourseModal(false);
      setNewCourseCode("");
      setNewCourseName("");
      loadData();
    } catch (err) {
      alert("Error adding course: " + err);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    try {
      await createDeadline({
        title: newTaskTitle,
        course_code: newTaskCourse,
        due_date: newTaskDueDate,
        priority: newTaskPriority,
      });
      setShowAddTaskModal(false);
      setNewTaskTitle("");
      loadData();
    } catch (err) {
      alert("Error adding task: " + err);
    }
  };

  const handleCSVSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setCsvStatus("Uploading and parsing CSV...");
    try {
      const res = await uploadCSV(csvFile, csvType);
      setCsvStatus(`Success! Imported ${res.records_imported} records.`);
      setTimeout(() => {
        setShowCSVModal(false);
        setCsvStatus("");
        setCsvFile(null);
        loadData();
      }, 1200);
    } catch (err) {
      setCsvStatus("Error: " + err);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      const updated = await toggleDeadline(taskId);
      setDeadlines((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch {
      setDeadlines((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: t.status === "pending" ? "completed" : "pending" } : t
        )
      );
    }
  };

  const selectedAtt = attendance.find((a) => a.course_code === selectedCourseCode);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950 text-red-300 border border-red-800">
              Academic Hub
            </span>
            <span className="text-xs text-slate-400">TIET Patiala Regulations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Academic Dashboard & What-If Planner
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track grades, monitor Thapar&apos;s 75% attendance policy, and simulate future scenarios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCSVModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button
            onClick={() => setShowAddCourseModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md shadow-red-950 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Course
          </button>
        </div>
      </div>

      {/* Attendance Monitor Cards (Thapar 75% Rule) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Course Attendance Monitor</h2>
            <span className="text-xs text-slate-400">(Section 6.2 Attendance Ordinance)</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Safe (&ge; 75%)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Medical Warning (65%-74.9%)
            </span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400"></span> Debarred (&lt; 65%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attendance.map((rec) => {
            const isSafe = rec.percentage >= 75.0;
            const isWarning = rec.percentage >= 65.0 && rec.percentage < 75.0;
            return (
              <div
                key={rec.id}
                className={`p-5 rounded-xl border transition-all ${
                  isSafe
                    ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                    : isWarning
                    ? "bg-amber-950/20 border-amber-800/40 hover:border-amber-700"
                    : "bg-red-950/20 border-red-800/40 hover:border-red-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {rec.course_code}
                    </span>
                    <h3 className="text-sm font-semibold text-white mt-1.5 line-clamp-1">
                      {rec.course_name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-2xl font-bold ${
                        isSafe ? "text-emerald-400" : isWarning ? "text-amber-400" : "text-red-400"
                      }`}
                    >
                      {rec.percentage}%
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Attended:{" "}
                    <strong className="text-white">
                      {rec.attended_classes} / {rec.total_classes}
                    </strong>
                  </span>
                  {isSafe ? (
                    <span className="text-emerald-400 font-medium">
                      {rec.safe_bunks} safe bunk{rec.safe_bunks !== 1 ? "s" : ""} left
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Need {rec.classes_needed_for_75} class{rec.classes_needed_for_75 !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>

                {/* Quick button to simulate this course */}
                <button
                  onClick={() => {
                    setSelectedCourseCode(rec.course_code);
                    setActivePlannerTab("attendance");
                    window.scrollTo({ top: 550, behavior: "smooth" });
                  }}
                  className="w-full mt-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <Sliders className="w-3 h-3 text-red-400" /> Simulate Scenarios
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* WHAT-IF PLANNER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-950 text-red-400 flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white">Interactive What-If Planner</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simulate dynamic outcomes before bunking a class or sitting for semester exams.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setActivePlannerTab("attendance")}
              className={`px-4 py-2 rounded-lg transition-all ${
                activePlannerTab === "attendance"
                  ? "bg-red-600 text-white shadow-md font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Attendance Simulator
            </button>
            <button
              onClick={() => setActivePlannerTab("grades")}
              className={`px-4 py-2 rounded-lg transition-all ${
                activePlannerTab === "grades"
                  ? "bg-red-600 text-white shadow-md font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Grade &amp; CGPA Simulator
            </button>
          </div>
        </div>

        {/* TAB 1: ATTENDANCE SIMULATOR */}
        {activePlannerTab === "attendance" && (
          <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Course to Simulate
                </label>
                <select
                  value={selectedCourseCode}
                  onChange={(e) => setSelectedCourseCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-red-600"
                >
                  {attendance.map((a) => (
                    <option key={a.course_code} value={a.course_code}>
                      {a.course_code} - {a.course_name} (Current: {a.percentage}%)
                    </option>
                  ))}
                </select>
              </div>

              {selectedAtt && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Current Record: </span>
                    <span className="text-white font-semibold">
                      {selectedAtt.attended_classes} attended / {selectedAtt.total_classes} total
                    </span>
                  </div>
                  <span
                    className={`font-bold px-2 py-0.5 rounded ${
                      selectedAtt.percentage >= 75
                        ? "bg-emerald-950 text-emerald-300"
                        : "bg-amber-950 text-amber-300"
                    }`}
                  >
                    {selectedAtt.percentage}%
                  </span>
                </div>
              )}

              {/* Slider 1: Total Upcoming Classes */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Upcoming Lectures Scheduled:</span>
                  <span className="font-mono text-red-400 text-sm font-bold">{upcomingTotal}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={upcomingTotal}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setUpcomingTotal(val);
                    if (upcomingAttend > val) setUpcomingAttend(val);
                  }}
                  className="w-full accent-red-600 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* Slider 2: Classes I Plan to Attend */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Classes You Will Attend:</span>
                  <span className="font-mono text-emerald-400 text-sm font-bold">
                    {upcomingAttend} / {upcomingTotal}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={upcomingTotal}
                  value={upcomingAttend}
                  onChange={(e) => setUpcomingAttend(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>Bunk all ({upcomingTotal} missed)</span>
                  <span>Attend all 100%</span>
                </div>
              </div>
            </div>

            {/* Simulation Results Display */}
            <div className="lg:col-span-6 bg-slate-950 rounded-xl p-6 border border-slate-800 flex flex-col justify-between">
              {simAttendanceResult ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                      Simulation Projection
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                        simAttendanceResult.status_assessment === "safe"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : simAttendanceResult.status_assessment === "warning"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {simAttendanceResult.status_assessment}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Current Attendance</span>
                      <div className="text-2xl font-bold text-slate-300 mt-1">
                        {simAttendanceResult.current_percentage}%
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Projected Attendance</span>
                      <div
                        className={`text-2xl font-bold mt-1 ${
                          simAttendanceResult.simulated_percentage >= 75
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {simAttendanceResult.simulated_percentage}%
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-red-400" /> Official TIET Advisory:
                    </div>
                    <p className="text-slate-300 leading-relaxed">{simAttendanceResult.advice}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Calculating simulation...
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GRADE & CGPA SIMULATOR */}
        {activePlannerTab === "grades" && (
          <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Target Letter Grades</h3>
                  <p className="text-xs text-slate-400">Set desired grades for your current courses</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Target CGPA:</span>
                  <input
                    type="number"
                    step="0.05"
                    min="4.5"
                    max="10.0"
                    value={targetCGPA}
                    onChange={(e) => setTargetCGPA(parseFloat(e.target.value) || 8.0)}
                    className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-bold text-center"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                {courses.map((crs) => (
                  <div
                    key={crs.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{crs.course_code}</span>
                        <span className="text-slate-400 font-normal truncate max-w-xs">
                          {crs.course_name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{crs.credits} Credits</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Target:</span>
                      <select
                        value={courseTargets[crs.course_code] || "A"}
                        onChange={(e) =>
                          setCourseTargets((prev) => ({
                            ...prev,
                            [crs.course_code]: e.target.value,
                          }))
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-amber-300"
                      >
                        {Object.keys(GRADE_POINTS).map((g) => (
                          <option key={g} value={g}>
                            {g} ({GRADE_POINTS[g]} pts)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projected CGPA Box */}
            <div className="lg:col-span-5 bg-slate-950 rounded-xl p-6 border border-slate-800 flex flex-col justify-between">
              {gradeSimResult ? (
                <div className="space-y-4">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                    Grade Projection Engine
                  </span>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Projected SGPA</span>
                      <div className="text-2xl font-bold text-amber-400 mt-1">
                        {gradeSimResult.predicted_sgpa}
                      </div>
                      <span className="text-[10px] text-slate-400">For 5th Semester</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Projected CGPA</span>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">
                        {gradeSimResult.predicted_cgpa}
                      </div>
                      <span className="text-[10px] text-slate-400">Cumulative</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Target CGPA Goal:</span>
                      <span className="text-white font-bold">{gradeSimResult.target_cgpa}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Required SGPA:</span>
                      <span
                        className={`font-bold ${
                          gradeSimResult.is_feasible ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {gradeSimResult.required_sgpa_for_target}
                      </span>
                    </div>
                    <p className="text-slate-300 pt-2 border-t border-slate-800 leading-relaxed">
                      {gradeSimResult.summary}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">Loading simulator...</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TIMETABLE SCHEDULE & DEADLINES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Weekly Timetable */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Weekly Timetable</h2>
              <p className="text-xs text-slate-400">Thapar Institute lecture and lab halls</p>
            </div>
            {/* Day selector */}
            <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {["Monday", "Tuesday", "Wednesday"].map((day) => (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    activeDay === day ? "bg-red-600 text-white font-medium" : "text-slate-400"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {timetable
              .filter((slot) => slot.day_of_week === activeDay)
              .map((slot) => (
                <div
                  key={slot.id}
                  className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        slot.slot_type === "Lab"
                          ? "bg-purple-950 text-purple-300 border border-purple-800"
                          : "bg-red-950 text-red-300 border border-red-800"
                      }`}
                    >
                      {slot.slot_type === "Lab" ? "LAB" : "LEC"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {slot.course_code}: {slot.course_name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                        <span>
                          {slot.start_time} - {slot.end_time}
                        </span>
                        <span>•</span>
                        <span className="text-amber-400">{slot.venue}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {slot.slot_type}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Deadlines & Academic Tasks */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Deadlines &amp; Tasks</h2>
              <p className="text-xs text-slate-400">Assignments and Copilot confirmed notices</p>
            </div>
            <button
              onClick={() => setShowAddTaskModal(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {deadlines.map((t) => (
              <div
                key={t.id}
                onClick={() => handleToggleTask(t.id)}
                className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-all ${
                  t.status === "completed"
                    ? "bg-slate-950/60 border-slate-900 opacity-60"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                }`}
              >
                <button
                  type="button"
                  className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      t.status === "completed" ? "text-emerald-400 fill-emerald-400/20" : ""
                    }`}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-semibold ${
                      t.status === "completed" ? "line-through text-slate-400" : "text-white"
                    }`}
                  >
                    {t.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    {t.course_code && (
                      <span className="font-mono text-slate-300">{t.course_code}</span>
                    )}
                    <span>Due: {new Date(t.due_date).toLocaleDateString()}</span>
                    {t.source === "copilot_action" && (
                      <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> AI Notice
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    t.priority === "high"
                      ? "bg-red-500/20 text-red-300"
                      : t.priority === "medium"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {t.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: ADD COURSE */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Registered Course</h3>
            <form onSubmit={handleAddCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Code (e.g. UCS405)
                </label>
                <input
                  type="text"
                  required
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  placeholder="UCS405"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Course Name</label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Operating Systems"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Credits</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newCourseCredits}
                    onChange={(e) => setNewCourseCredits(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Grade</label>
                  <select
                    value={newCourseGrade}
                    onChange={(e) => setNewCourseGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  >
                    {Object.keys(GRADE_POINTS).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white shadow"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD TASK */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Academic Task</h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Submit Assignment 2"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Course Code</label>
                  <input
                    type="text"
                    value={newTaskCourse}
                    onChange={(e) => setNewTaskCourse(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  required
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white shadow"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CSV IMPORT */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Import Academic CSV</h3>
            <p className="text-xs text-slate-400 mb-4">
              Upload your attendance or course roster CSV exported from portal or spreadsheets.
            </p>
            <form onSubmit={handleCSVSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Import Type</label>
                <select
                  value={csvType}
                  onChange={(e) => setCsvType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                >
                  <option value="attendance">Attendance Records (code, name, attended, total)</option>
                  <option value="courses">Courses List (code, name, credits, grade)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  required
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              {csvStatus && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
                  {csvStatus}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCSVModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white shadow"
                >
                  Upload &amp; Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
