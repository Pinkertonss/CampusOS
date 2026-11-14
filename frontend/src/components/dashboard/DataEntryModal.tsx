"use client";

import React, { useState } from "react";
import {
  Plus,
  BookOpen,
  Calendar,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  Check,
} from "lucide-react";
import { Modal, Button, Badge, useToast } from "../ui";
import { addCourse, updateAttendance, createDeadline, uploadCSV } from "../../lib/api";
import { AcademicSummaryCourse } from "../../types";

interface DataEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: AcademicSummaryCourse[];
  onDataChanged: () => void;
  defaultTab?: "course" | "attendance" | "assessment" | "csv";
}

export default function DataEntryModal({
  isOpen,
  onClose,
  courses,
  onDataChanged,
  defaultTab = "course",
}: DataEntryModalProps) {
  const [activeTab, setActiveTab] = useState<"course" | "attendance" | "assessment" | "csv">(
    defaultTab
  );
  const { toast } = useToast();

  // Form states
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [credits, setCredits] = useState(4.0);
  const [targetGrade, setTargetGrade] = useState("A");

  // Attendance Form state
  const [attCourseCode, setAttCourseCode] = useState(courses[0]?.code || "UCS301");
  const [attAttended, setAttAttended] = useState(15);
  const [attTotal, setAttTotal] = useState(20);

  // Assessment Form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCourseCode, setTaskCourseCode] = useState(courses[0]?.code || "UCS301");
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");

  // CSV Import state
  const [csvType, setCsvType] = useState<"attendance" | "courses">("attendance");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Download Sample Template
  const handleDownloadTemplate = () => {
    let csvContent = "";
    let filename = "";

    if (csvType === "attendance") {
      csvContent =
        "course_code,course_name,attended,total\n" +
        "UCS301,Data Structures & Algorithms,36,40\n" +
        "UCS310,Database Management Systems,25,32\n" +
        "UCS405,Operating Systems,18,25\n" +
        "UMA010,Mathematics - III,17,28\n" +
        "UED101,Engineering Design Project - I,19,20\n";
      filename = "thapar_attendance_template.csv";
    } else {
      csvContent =
        "course_code,course_name,credits,target_grade\n" +
        "UCS301,Data Structures & Algorithms,4.5,A\n" +
        "UCS310,Database Management Systems,4.0,A-\n" +
        "UCS405,Operating Systems,4.0,B\n" +
        "UMA010,Mathematics - III,3.5,B+\n";
      filename = "thapar_courses_template.csv";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.info("Template downloaded", { description: filename });
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseName.trim()) {
      toast.warning("Please fill in course code and name");
      return;
    }

    setSubmitting(true);
    try {
      await addCourse({
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim(),
        credits: Number(credits),
        target_grade: targetGrade,
      });
      toast.success("Course added", {
        description: `${courseCode.toUpperCase()} (${courseName}) registered.`,
      });
      setCourseCode("");
      setCourseName("");
      onDataChanged();
      onClose();
    } catch {
      toast.error("Failed to add course");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attAttended > attTotal) {
      toast.warning("Attended classes cannot exceed total classes held");
      return;
    }

    setSubmitting(true);
    try {
      await updateAttendance(attCourseCode, attAttended, attTotal);
      toast.success("Attendance updated", {
        description: `${attCourseCode}: ${attAttended}/${attTotal} classes (${Math.round(
          (attAttended / attTotal) * 100
        )}%)`,
      });
      onDataChanged();
      onClose();
    } catch {
      toast.error("Failed to update attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast.warning("Please enter a title");
      return;
    }

    setSubmitting(true);
    try {
      await createDeadline({
        title: taskTitle.trim(),
        course_code: taskCourseCode,
        due_date: taskDueDate,
        priority: taskPriority,
      });
      toast.success("Deadline added", { description: taskTitle });
      setTaskTitle("");
      onDataChanged();
      onClose();
    } catch {
      toast.error("Failed to add deadline");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCSVUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.warning("Please choose a CSV file first");
      return;
    }

    setSubmitting(true);
    try {
      const res = await uploadCSV(selectedFile, csvType);
      toast.success("CSV Imported Successfully", {
        description: res.message || `Imported ${res.records_imported} record(s).`,
      });
      setSelectedFile(null);
      onDataChanged();
      onClose();
    } catch (err: unknown) {
      toast.error("CSV Import Failed", {
        description: err instanceof Error ? err.message : "Invalid CSV structure",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              Data Entry &amp; Import
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Manual entry and bulk CSV import (no ERP credentials required)
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("course")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === "course"
                ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Add Course
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === "attendance"
                ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Log Attendance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assessment")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === "assessment"
                ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Add Deadline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("csv")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === "csv"
                ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Bulk CSV Import
          </button>
        </div>

        {/* TAB 1: ADD COURSE */}
        {activeTab === "course" && (
          <form onSubmit={handleAddCourse} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Course Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UCS503"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono uppercase text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Credits
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="8"
                  required
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Course Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Design & Analysis of Algorithms"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Grade
              </label>
              <select
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="A+">A+ (10.0)</option>
                <option value="A">A (10.0)</option>
                <option value="A-">A- (9.0)</option>
                <option value="B">B (8.0)</option>
                <option value="B-">B- (7.0)</option>
                <option value="C">C (6.0)</option>
              </select>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={submitting}
              className="bg-teal-600 hover:bg-teal-500"
            >
              Add Course to Dashboard
            </Button>
          </form>
        )}

        {/* TAB 2: LOG ATTENDANCE */}
        {activeTab === "attendance" && (
          <form onSubmit={handleLogAttendance} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Course
              </label>
              <select
                value={attCourseCode}
                onChange={(e) => {
                  setAttCourseCode(e.target.value);
                  const found = courses.find((c) => c.code === e.target.value);
                  if (found) {
                    setAttAttended(found.attended);
                    setAttTotal(found.total_held);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              >
                {courses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name} (Current: {c.percentage}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Attended Classes
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={attAttended}
                  onChange={(e) => setAttAttended(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Total Classes Held
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={attTotal}
                  onChange={(e) => setAttTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
              Computed Attendance:{" "}
              <strong className="text-teal-600 dark:text-teal-400 font-mono">
                {attTotal > 0 ? Math.round((attAttended / attTotal) * 100) : 100}%
              </strong>{" "}
              {attTotal > 0 && Math.round((attAttended / attTotal) * 100) >= 75 ? (
                <span className="text-emerald-500">(Meets 75% TIET rule)</span>
              ) : (
                <span className="text-amber-500">(Below 75% threshold)</span>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={submitting}
              className="bg-teal-600 hover:bg-teal-500"
            >
              Update Attendance Record
            </Button>
          </form>
        )}

        {/* TAB 3: ADD ASSESSMENT / TASK */}
        {activeTab === "assessment" && (
          <form onSubmit={handleAddTask} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Title / Assessment Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. UCS503 Assignment 4 or Lab Exam"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Course
                </label>
                <select
                  value={taskCourseCode}
                  onChange={(e) => setTaskCourseCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                >
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as "low" | "medium" | "high")}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="high">High (Due within 7 days)</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={submitting}
              className="bg-teal-600 hover:bg-teal-500"
            >
              Add Deadline
            </Button>
          </form>
        )}

        {/* TAB 4: BULK CSV IMPORT */}
        {activeTab === "csv" && (
          <form onSubmit={handleCSVUpload} className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="csvType"
                    checked={csvType === "attendance"}
                    onChange={() => setCsvType("attendance")}
                    className="accent-teal-500"
                  />
                  <span>Attendance Records</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="csvType"
                    checked={csvType === "courses"}
                    onChange={() => setCsvType("courses")}
                    className="accent-teal-500"
                  />
                  <span>Courses Catalog</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Template CSV
              </button>
            </div>

            {/* Drop / Select File Box */}
            <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-teal-500 mx-auto" />
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {selectedFile ? (
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                ) : (
                  <span>Choose a CSV exported from WebKiosk or use our template</span>
                )}
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
                className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 dark:file:bg-teal-950/60 dark:file:text-teal-300 cursor-pointer"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={submitting}
              leftIcon={<Upload className="w-4 h-4" />}
              className="bg-teal-600 hover:bg-teal-500"
            >
              Import CSV Records
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
