"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  Calendar,
  ClipboardList,
  FileText,
  Bell,
  Download,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  Key,
  Award,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileCheck,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
} from "../../components/ui";
import {
  fetchOfferings,
  fetchOfferingRoster,
  fetchAttendanceSessions,
  createAttendanceSession,
  fetchSessionAttendanceRecords,
  markSessionAttendance,
  fetchOfferingAssessments,
  createOfferingAssessment,
  updateOfferingAssessment,
  fetchAssessmentMarks,
  updateAssessmentMarks,
  fetchOfferingAssignments,
  createOfferingAssignment,
  updateOfferingAssignment,
  fetchAssignmentSubmissions,
  gradeAssignmentSubmission,
  fetchOfferingAnnouncements,
  createOfferingAnnouncement,
  enrollStudentInOffering,
  disenrollStudentFromOffering,
  fetchStudentDirectory,
} from "../../lib/api";
import {
  SubjectOffering,
  RosterResponse,
  RosterStudent,
  AttendanceSession,
  SessionAttendanceRecord,
  Assessment,
  StudentAssessmentMark,
  OfferingAssignment,
  AssignmentSubmission,
  OfferingAnnouncement,
  StudentDirectoryItem,
} from "../../types";

export default function ProfessorDashboardPage() {
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [activeTab, setActiveTab] = useState<"roster" | "attendance" | "assessments" | "assignments" | "announcements">("roster");

  // Offerings Error / Notification
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Roster State
  const [rosterData, setRosterData] = useState<RosterResponse | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [supportFilter, setSupportFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortBy, setSortBy] = useState<string>("roll_no");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // 2. Attendance State
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionRecords, setSessionRecords] = useState<SessionAttendanceRecord[]>([]);
  const [newSessionDate, setNewSessionDate] = useState<string>("2026-02-15");
  const [newSessionSlot, setNewSessionSlot] = useState<string>("Lecture");
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);

  // 3. Assessments & Marks State
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [assessmentMarks, setAssessmentMarks] = useState<StudentAssessmentMark[]>([]);
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false);
  const [newAssessmentTitle, setNewAssessmentTitle] = useState("");
  const [newAssessmentType, setNewAssessmentType] = useState("Quiz");
  const [newAssessmentMaxMarks, setNewAssessmentMaxMarks] = useState<number>(20);
  const [newAssessmentWeight, setNewAssessmentWeight] = useState<number>(10);
  const [newAssessmentAnswerKey, setNewAssessmentAnswerKey] = useState("");

  // 4. Assignments & Submissions State
  const [assignments, setAssignments] = useState<OfferingAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [showNewAssignmentModal, setShowNewAssignmentModal] = useState(false);
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("");
  const [newAssignmentInstructions, setNewAssignmentInstructions] = useState("");
  const [newAssignmentDueDate, setNewAssignmentDueDate] = useState("2026-03-15T23:59:00");
  const [newAssignmentModelAnswer, setNewAssignmentModelAnswer] = useState("");
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmission | null>(null);
  const [gradeScoreInput, setGradeScoreInput] = useState<number>(0);
  const [gradeFeedbackInput, setGradeFeedbackInput] = useState<string>("");

  // 5. Announcements State
  const [announcements, setAnnouncements] = useState<OfferingAnnouncement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState<string>("all");

  // 6. Enrollment Directory Search
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryResults, setDirectoryResults] = useState<StudentDirectoryItem[]>([]);

  // Load Assigned Offerings
  const loadOfferings = useCallback(async () => {
    try {
      setLoadingOfferings(true);
      const data = await fetchOfferings();
      setOfferings(data);
      if (data.length > 0 && !selectedOfferingId) {
        setSelectedOfferingId(data[0].id);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load assigned offerings." });
    } finally {
      setLoadingOfferings(false);
    }
  }, [selectedOfferingId]);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  // Load Roster
  const loadRoster = useCallback(async () => {
    if (!selectedOfferingId) return;
    try {
      setRosterLoading(true);
      const res = await fetchOfferingRoster(selectedOfferingId, {
        search: searchQuery,
        support_filter: supportFilter,
        status_filter: statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: currentPage,
        page_size: 50,
      });
      setRosterData(res);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load roster." });
    } finally {
      setRosterLoading(false);
    }
  }, [selectedOfferingId, searchQuery, supportFilter, statusFilter, sortBy, sortOrder, currentPage]);

  // Load Sessions
  const loadSessions = useCallback(async () => {
    if (!selectedOfferingId) return;
    try {
      const data = await fetchAttendanceSessions(selectedOfferingId);
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load attendance sessions." });
    }
  }, [selectedOfferingId, selectedSessionId]);

  // Load Session Records
  const loadSessionRecords = useCallback(async () => {
    if (!selectedOfferingId || !selectedSessionId) return;
    try {
      const recs = await fetchSessionAttendanceRecords(selectedOfferingId, selectedSessionId);
      setSessionRecords(recs);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load records." });
    }
  }, [selectedOfferingId, selectedSessionId]);

  // Load Assessments
  const loadAssessments = useCallback(async () => {
    if (!selectedOfferingId) return;
    try {
      const data = await fetchOfferingAssessments(selectedOfferingId);
      setAssessments(data);
      if (data.length > 0 && !selectedAssessmentId) {
        setSelectedAssessmentId(data[0].id);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load assessments." });
    }
  }, [selectedOfferingId, selectedAssessmentId]);

  // Load Assessment Marks
  const loadAssessmentMarks = useCallback(async () => {
    if (!selectedOfferingId || !selectedAssessmentId) return;
    try {
      const marks = await fetchAssessmentMarks(selectedOfferingId, selectedAssessmentId);
      setAssessmentMarks(marks);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load assessment marks." });
    }
  }, [selectedOfferingId, selectedAssessmentId]);

  // Load Assignments
  const loadAssignments = useCallback(async () => {
    if (!selectedOfferingId) return;
    try {
      const data = await fetchOfferingAssignments(selectedOfferingId);
      setAssignments(data);
      if (data.length > 0 && !selectedAssignmentId) {
        setSelectedAssignmentId(data[0].id);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load assignments." });
    }
  }, [selectedOfferingId, selectedAssignmentId]);

  // Load Submissions
  const loadSubmissions = useCallback(async () => {
    if (!selectedOfferingId || !selectedAssignmentId) return;
    try {
      const subs = await fetchAssignmentSubmissions(selectedOfferingId, selectedAssignmentId);
      setSubmissions(subs);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load submissions." });
    }
  }, [selectedOfferingId, selectedAssignmentId]);

  // Load Announcements
  const loadAnnouncements = useCallback(async () => {
    if (!selectedOfferingId) return;
    try {
      const data = await fetchOfferingAnnouncements(selectedOfferingId);
      setAnnouncements(data);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load announcements." });
    }
  }, [selectedOfferingId]);

  // Trigger loads based on activeTab
  useEffect(() => {
    if (activeTab === "roster") loadRoster();
    if (activeTab === "attendance") {
      loadSessions();
      loadSessionRecords();
    }
    if (activeTab === "assessments") {
      loadAssessments();
      loadAssessmentMarks();
    }
    if (activeTab === "assignments") {
      loadAssignments();
      loadSubmissions();
    }
    if (activeTab === "announcements") loadAnnouncements();
  }, [
    activeTab,
    selectedOfferingId,
    loadRoster,
    loadSessions,
    loadSessionRecords,
    loadAssessments,
    loadAssessmentMarks,
    loadAssignments,
    loadSubmissions,
    loadAnnouncements,
  ]);

  // Search directory when modal open
  useEffect(() => {
    if (showEnrollModal) {
      fetchStudentDirectory(directorySearch)
        .then(setDirectoryResults)
        .catch(() => {});
    }
  }, [showEnrollModal, directorySearch]);

  const currentOffering = offerings.find((o) => o.id === selectedOfferingId);

  // Handlers
  const handleCreateSession = async () => {
    if (!selectedOfferingId) return;
    try {
      await createAttendanceSession(selectedOfferingId, newSessionDate, newSessionSlot);
      setShowNewSessionModal(false);
      setActionMessage({ type: "success", text: `Session created for ${newSessionDate}` });
      loadSessions();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create session." });
    }
  };

  const handleMarkStatus = async (studentId: string, newStatus: string, reason?: string) => {
    if (!selectedOfferingId || !selectedSessionId) return;
    try {
      await markSessionAttendance(selectedOfferingId, selectedSessionId, [
        { student_id: studentId, status: newStatus, correction_reason: reason },
      ]);
      loadSessionRecords();
      setActionMessage({ type: "success", text: `Attendance updated to ${newStatus}` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update attendance." });
    }
  };

  const handleCreateAssessment = async () => {
    if (!selectedOfferingId) return;
    try {
      await createOfferingAssessment(selectedOfferingId, {
        title: newAssessmentTitle,
        assessment_type: newAssessmentType,
        max_marks: Number(newAssessmentMaxMarks),
        weight_percent: Number(newAssessmentWeight),
        answer_key_content: newAssessmentAnswerKey || undefined,
        is_published: false,
      });
      setShowNewAssessmentModal(false);
      setNewAssessmentTitle("");
      setActionMessage({ type: "success", text: "Draft assessment created successfully." });
      loadAssessments();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create assessment." });
    }
  };

  const handleToggleAssessmentPublish = async (asm: Assessment) => {
    try {
      await updateOfferingAssessment(selectedOfferingId, asm.id, {
        is_published: !asm.is_published,
      });
      loadAssessments();
      setActionMessage({
        type: "success",
        text: `Assessment "${asm.title}" is now ${!asm.is_published ? "Published" : "Draft"}.`,
      });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleToggleAnswerKeyRelease = async (asm: Assessment) => {
    try {
      await updateOfferingAssessment(selectedOfferingId, asm.id, {
        answer_key_released: !asm.answer_key_released,
      });
      loadAssessments();
      setActionMessage({
        type: "success",
        text: `Answer key is now ${!asm.answer_key_released ? "Released to students" : "Concealed"}.`,
      });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleUpdateStudentMark = async (studentId: string, marksVal: number, feedbackVal?: string) => {
    if (!selectedOfferingId || !selectedAssessmentId) return;
    try {
      await updateAssessmentMarks(selectedOfferingId, selectedAssessmentId, [
        { student_id: studentId, obtained_marks: marksVal, feedback: feedbackVal, status: "graded" },
      ]);
      loadAssessmentMarks();
      setActionMessage({ type: "success", text: "Mark updated successfully." });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedOfferingId) return;
    try {
      await createOfferingAssignment(selectedOfferingId, {
        title: newAssignmentTitle,
        instructions: newAssignmentInstructions,
        due_date: newAssignmentDueDate,
        model_answer: newAssignmentModelAnswer || undefined,
        is_published: true,
      });
      setShowNewAssignmentModal(false);
      setNewAssignmentTitle("");
      setNewAssignmentInstructions("");
      setActionMessage({ type: "success", text: "Assignment created and published." });
      loadAssignments();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleToggleModelAnswerRelease = async (asg: OfferingAssignment) => {
    try {
      await updateOfferingAssignment(selectedOfferingId, asg.id, {
        model_answer_released: !asg.model_answer_released,
      });
      loadAssignments();
      setActionMessage({
        type: "success",
        text: `Model answer is now ${!asg.model_answer_released ? "Released to students" : "Concealed"}.`,
      });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleGradeSubmission = async () => {
    if (!selectedOfferingId || !selectedAssignmentId || !gradingSubmission) return;
    try {
      await gradeAssignmentSubmission(
        selectedOfferingId,
        selectedAssignmentId,
        gradingSubmission.id,
        gradeScoreInput,
        gradeFeedbackInput
      );
      setGradingSubmission(null);
      loadSubmissions();
      setActionMessage({ type: "success", text: "Submission graded successfully." });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId || !announcementTitle.trim()) return;
    try {
      await createOfferingAnnouncement(selectedOfferingId, {
        title: announcementTitle,
        content: announcementContent,
        target_group: announcementTarget,
      });
      setAnnouncementTitle("");
      setAnnouncementContent("");
      loadAnnouncements();
      setActionMessage({ type: "success", text: "Announcement posted successfully." });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleEnrollStudent = async (student: StudentDirectoryItem) => {
    if (!selectedOfferingId) return;
    try {
      await enrollStudentInOffering(selectedOfferingId, {
        student_id: student.student_id,
        student_name: student.full_name,
        student_roll_no: student.roll_no,
        student_email: student.email,
      });
      setShowEnrollModal(false);
      loadRoster();
      setActionMessage({ type: "success", text: `Enrolled ${student.full_name} (${student.roll_no})` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleDisenrollStudent = async (studentId: string, name: string) => {
    const reason = window.prompt(`Reason for disenrolling ${name}:`, "Course transfer or withdrawal");
    if (!reason) return;
    try {
      await disenrollStudentFromOffering(selectedOfferingId, studentId, reason);
      loadRoster();
      setActionMessage({ type: "success", text: `Disenrolled ${name} (history preserved).` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleExportCsv = () => {
    if (!selectedOfferingId) return;
    window.open(`http://localhost:8000/api/academic/offerings/${encodeURIComponent(selectedOfferingId)}/roster/export-csv`, "_blank");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Offering Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Faculty Academic Operations
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Offering-scoped student rosters, attendance tracking, marks, and interventions.
          </p>
        </div>

        {/* Offering Switcher */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Offering:
          </label>
          {loadingOfferings ? (
            <div className="h-9 w-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
          ) : (
            <select
              value={selectedOfferingId}
              onChange={(e) => {
                setSelectedOfferingId(e.target.value);
                setSelectedSessionId("");
                setSelectedAssessmentId("");
                setSelectedAssignmentId("");
              }}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-teal-500"
            >
              {offerings.map((off) => (
                <option key={off.id} value={off.id}>
                  {off.subject_code} — {off.section} ({off.term})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Banner / Feedback Message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            actionMessage.type === "success"
              ? "bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-900/60"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Offering Overview Card */}
      {currentOffering && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Enrolled Students</span>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {currentOffering.enrolled_count}
            </div>
            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">Active Section Roster</span>
          </Card>
          <Card className="p-4 border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Attendance Policy</span>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {currentOffering.attendance_threshold}%
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Minimum Statutory Requirement</span>
          </Card>
          <Card className="p-4 border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Assigned Faculty</span>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white truncate">
              {currentOffering.professor_names.join(", ") || "Assigned"}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Instructor of Record</span>
          </Card>
          <Card className="p-4 border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Grade Policy</span>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              TIET Standard 10-Point
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Relative Scale Ready</span>
          </Card>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        {[
          { id: "roster", label: "Student Roster & Support", icon: Users },
          { id: "attendance", label: "Attendance Sessions", icon: Calendar },
          { id: "assessments", label: "Assessments & Marks", icon: Award },
          { id: "assignments", label: "Assignments & Submissions", icon: FileText },
          { id: "announcements", label: "Announcements", icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ROSTER & SUPPORT IDENTIFICATION */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, roll no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Support Filter */}
              <select
                value={supportFilter}
                onChange={(e) => setSupportFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Support Statuses</option>
                <option value="attendance_support">⚠️ Attendance Support (&lt; 75%)</option>
                <option value="academic_support">🎯 Academic Support Required</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300"
              >
                <option value="active">Active Only</option>
                <option value="disenrolled">Disenrolled Only</option>
                <option value="all">All Enrollments</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowEnrollModal(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Enroll Student
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportCsv}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Roster Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Attendance</th>
                    <th className="py-3 px-4">Performance</th>
                    <th className="py-3 px-4">Grade</th>
                    <th className="py-3 px-4">Support Indicators</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rosterLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Loading roster...
                      </td>
                    </tr>
                  ) : !rosterData?.students.length ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No students found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    rosterData.students.map((st) => (
                      <tr key={st.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">{st.student_name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {st.student_roll_no} • {st.student_email}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold ${
                                st.attendance_percentage == null
                                  ? "text-slate-500"
                                  : st.attendance_percentage >= 75
                                  ? "text-teal-600 dark:text-teal-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {st.attendance_percentage != null ? `${st.attendance_percentage}%` : "N/A"}
                            </span>
                            <span className="text-xs text-slate-400">
                              ({st.attended_sessions}/{st.counted_sessions})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-900 dark:text-white font-medium">
                            {st.weighted_score !== null ? `${st.weighted_score}%` : "Pending"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {st.total_obtained_marks} / {st.total_possible_marks} pts
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="default" className="font-bold">
                            {st.calculated_grade || "—"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {st.needs_attendance_support && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                Low Attendance
                              </span>
                            )}
                            {st.needs_academic_support && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                Academic Support
                              </span>
                            )}
                            {!st.needs_attendance_support && !st.needs_academic_support && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                                On Track
                              </span>
                            )}
                          </div>
                          {st.support_reasons.length > 0 && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {st.support_reasons[0]}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {st.enrollment_status === "active" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700"
                              onClick={() => handleDisenrollStudent(st.student_id, st.student_name)}
                            >
                              Disenroll
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Disenrolled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE SESSIONS & MARKING */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Attendance Sessions</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create lecture, lab, and tutorial sessions and mark student presence.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowNewSessionModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Session
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Session List */}
            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scheduled Sessions</span>
              {!sessions.length ? (
                <div className="p-4 text-center text-sm text-slate-500">No sessions recorded yet.</div>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedSessionId === s.id
                        ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-sm">
                      <span>{s.session_date}</span>
                      <Badge variant="default">{s.slot_type}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{s.records_count} students recorded</div>
                  </button>
                ))
              )}
            </div>

            {/* Attendance Marking Table */}
            <div className="md:col-span-2 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Mark Attendance — {sessions.find((s) => s.id === selectedSessionId)?.session_date || "Select Session"}
                </span>
                <span className="text-xs text-slate-500">Updates sync in real-time</span>
              </div>

              {!sessionRecords.length ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Select a session or enroll students to begin marking attendance.
                </div>
              ) : (
                <div className="space-y-2">
                  {sessionRecords.map((r) => (
                    <div
                      key={r.student_id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{r.student_name}</div>
                        <div className="text-xs text-slate-500">{r.student_roll_no}</div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {["present", "absent", "late", "excused"].map((st) => (
                          <button
                            key={st}
                            onClick={() => handleMarkStatus(r.student_id, st)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wider transition-all ${
                              r.status === st
                                ? st === "present"
                                  ? "bg-teal-600 text-white shadow-sm"
                                  : st === "absent"
                                  ? "bg-rose-600 text-white shadow-sm"
                                  : st === "late"
                                  ? "bg-amber-500 text-white shadow-sm"
                                  : "bg-indigo-600 text-white shadow-sm"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ASSESSMENTS & MARKS */}
      {activeTab === "assessments" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assessments & Marks</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure Quizzes, MST, EST with controlled publication and answer key releases.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowNewAssessmentModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Assessment
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Assessment Cards */}
            <div className="space-y-3">
              {assessments.map((asm) => (
                <div
                  key={asm.id}
                  onClick={() => setSelectedAssessmentId(asm.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedAssessmentId === asm.id
                      ? "border-teal-500 bg-teal-50/40 dark:bg-teal-950/30"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{asm.title}</span>
                    <Badge variant={asm.is_published ? "primary" : "default"}>
                      {asm.is_published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Max Marks: {asm.max_marks} • Weight: {asm.weight_percent}%
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAssessmentPublish(asm);
                      }}
                      className="text-xs flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-600"
                    >
                      {asm.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {asm.is_published ? "Unpublish" : "Publish"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAnswerKeyRelease(asm);
                      }}
                      className="text-xs flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-600 ml-auto"
                    >
                      <Key className="w-3.5 h-3.5" />
                      {asm.answer_key_released ? "Conceal Key" : "Release Key"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Marks Editor */}
            <div className="md:col-span-2 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
              <span className="font-bold text-sm text-slate-900 dark:text-white block mb-3">
                Student Marks Entry — {assessments.find((a) => a.id === selectedAssessmentId)?.title || "Select Assessment"}
              </span>

              {!assessmentMarks.length ? (
                <div className="text-center py-8 text-sm text-slate-500">No marks recorded yet for this assessment.</div>
              ) : (
                <div className="space-y-2">
                  {assessmentMarks.map((m) => (
                    <div
                      key={m.student_id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                    >
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{m.student_name}</div>
                        <div className="text-xs text-slate-500">{m.student_roll_no}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          defaultValue={m.obtained_marks ?? ""}
                          placeholder="Marks"
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) handleUpdateStudentMark(m.student_id, val);
                          }}
                          className="w-20 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white font-semibold text-right"
                        />
                        <span className="text-xs text-slate-400 font-medium">pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ASSIGNMENTS & SUBMISSIONS */}
      {activeTab === "assignments" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assignments & Submissions</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create assignments, configure submission rules, and grade student submissions.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowNewAssignmentModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Assignment
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Assignments List */}
            <div className="space-y-3">
              {assignments.map((asg) => (
                <div
                  key={asg.id}
                  onClick={() => setSelectedAssignmentId(asg.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedAssignmentId === asg.id
                      ? "border-teal-500 bg-teal-50/40 dark:bg-teal-950/30"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{asg.title}</span>
                    <Badge variant={asg.is_published ? "primary" : "default"}>
                      {asg.is_published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Due: {asg.due_date.slice(0, 10)}</div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleModelAnswerRelease(asg);
                      }}
                      className="text-xs flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-600"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      {asg.model_answer_released ? "Conceal Answer" : "Release Model Answer"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Submissions List */}
            <div className="md:col-span-2 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
              <span className="font-bold text-sm text-slate-900 dark:text-white block mb-3">
                Student Submissions — {assignments.find((a) => a.id === selectedAssignmentId)?.title || "Select Assignment"}
              </span>

              {!submissions.length ? (
                <div className="text-center py-8 text-sm text-slate-500">No submissions uploaded yet.</div>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                    >
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          {sub.student_name}
                          {sub.is_late && <span className="ml-2 text-rose-500 text-xs font-bold">[LATE]</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {sub.student_roll_no} • v{sub.version} • {sub.submitted_at.slice(0, 16)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {sub.score !== null ? `${sub.score} pts` : "Ungraded"}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setGradingSubmission(sub);
                            setGradeScoreInput(sub.score || 0);
                            setGradeFeedbackInput(sub.feedback || "");
                          }}
                        >
                          Grade
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ANNOUNCEMENTS */}
      {activeTab === "announcements" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Offering Announcements</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Post notices targeted to the entire cohort or specific academic intervention groups.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4 border-slate-200 dark:border-slate-800">
              <form onSubmit={handleCreateAnnouncement} className="space-y-3">
                <span className="font-bold text-sm text-slate-900 dark:text-white block">Post Notice</span>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Title</label>
                  <input
                    type="text"
                    required
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="e.g. Lab 2 Submission Deadline Extended"
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Content</label>
                  <textarea
                    rows={3}
                    required
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="Provide details..."
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Target Group</label>
                  <select
                    value={announcementTarget}
                    onChange={(e) => setAnnouncementTarget(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="all">All Enrolled Students</option>
                    <option value="low_attendance">Low Attendance Intervention Group</option>
                    <option value="academic_support">Academic Support Group</option>
                  </select>
                </div>
                <Button type="submit" size="sm" className="w-full">
                  Post Announcement
                </Button>
              </form>
            </Card>

            <div className="md:col-span-2 space-y-3">
              {!announcements.length ? (
                <div className="p-8 text-center text-sm text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl">
                  No announcements published yet.
                </div>
              ) : (
                announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{ann.title}</span>
                      <Badge variant="default">{ann.target_group}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{ann.content}</p>
                    <span className="text-[11px] text-slate-400 mt-2 block">{ann.created_at.slice(0, 16)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Session */}
      {showNewSessionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Attendance Session</h3>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Date</label>
              <input
                type="date"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Slot Type</label>
              <select
                value={newSessionSlot}
                onChange={(e) => setNewSessionSlot(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Lecture">Lecture</option>
                <option value="Lab">Lab</option>
                <option value="Tutorial">Tutorial</option>
                <option value="Extra">Extra Session</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNewSessionModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateSession}>
                Create Session
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Assessment */}
      {showNewAssessmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">New Assessment</h3>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Title</label>
              <input
                type="text"
                placeholder="e.g. Quiz 3: Dynamic Programming"
                value={newAssessmentTitle}
                onChange={(e) => setNewAssessmentTitle(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Type</label>
                <select
                  value={newAssessmentType}
                  onChange={(e) => setNewAssessmentType(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="Quiz">Quiz</option>
                  <option value="MST">MST</option>
                  <option value="EST">EST</option>
                  <option value="Lab Exam">Lab Exam</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Max Marks</label>
                <input
                  type="number"
                  value={newAssessmentMaxMarks}
                  onChange={(e) => setNewAssessmentMaxMarks(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-right"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Weight (%)</label>
                <input
                  type="number"
                  value={newAssessmentWeight}
                  onChange={(e) => setNewAssessmentWeight(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-right"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Answer Key Solutions</label>
              <textarea
                rows={3}
                placeholder="Model answers / solutions key (kept confidential until released)"
                value={newAssessmentAnswerKey}
                onChange={(e) => setNewAssessmentAnswerKey(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNewAssessmentModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateAssessment}>
                Create Draft Assessment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Assignment */}
      {showNewAssignmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">New Assignment</h3>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Title</label>
              <input
                type="text"
                placeholder="e.g. Lab Assignment 3: Dijkstra Algorithm"
                value={newAssignmentTitle}
                onChange={(e) => setNewAssignmentTitle(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Instructions</label>
              <textarea
                rows={3}
                value={newAssignmentInstructions}
                onChange={(e) => setNewAssignmentInstructions(e.target.value)}
                placeholder="Provide instructions..."
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Model Answer</label>
              <textarea
                rows={2}
                value={newAssignmentModelAnswer}
                onChange={(e) => setNewAssignmentModelAnswer(e.target.value)}
                placeholder="Optional reference solutions (hidden until released)"
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNewAssignmentModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateAssignment}>
                Publish Assignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Grading Drawer */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Grade Submission — {gradingSubmission.student_name}
            </h3>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Score</label>
              <input
                type="number"
                step="0.5"
                value={gradeScoreInput}
                onChange={(e) => setGradeScoreInput(Number(e.target.value))}
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Feedback</label>
              <textarea
                rows={3}
                value={gradeFeedbackInput}
                onChange={(e) => setGradeFeedbackInput(e.target.value)}
                placeholder="Provide student feedback..."
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setGradingSubmission(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleGradeSubmission}>
                Save Grade
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Enroll Student Directory */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Enroll Eligible Student</h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name or roll number..."
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {!directoryResults.length ? (
                <div className="py-4 text-center text-xs text-slate-500">No matching students found.</div>
              ) : (
                directoryResults.map((s) => (
                  <div key={s.student_id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{s.full_name}</div>
                      <div className="text-xs text-slate-500">{s.roll_no} • {s.branch} Sem {s.semester}</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => handleEnrollStudent(s)}>
                      Enroll
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowEnrollModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
