"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  BookOpen,
  History,
  Plus,
  AlertTriangle,
  CheckCircle,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  GraduationCap,
  ClipboardList,
  Calendar,
  FileText,
  Clock,
  Eye,
  EyeOff,
  Award,
  Key,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  EmptyState,
} from "../../components/ui";
import {
  fetchOfferings,
  createOffering,
  assignProfessorToOffering,
  fetchUserRoles,
  updateUserRole,
  fetchAcademicAuditLogs,
  fetchSubjects,
  createAdminAccount,
  fetchStudentDirectory,
  fetchOfferingRoster,
  enrollStudentInOffering,
  disenrollStudentFromOffering,
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
} from "../../lib/api";
import {
  SubjectOffering,
  UserRoleItem,
  AcademicAuditLog,
  Subject,
  StudentDirectoryItem,
  RosterResponse,
  RosterStudent,
  AttendanceSession,
  SessionAttendanceRecord,
  Assessment,
  StudentAssessmentMark,
  OfferingAssignment,
  AssignmentSubmission,
} from "../../types";

export default function AdminConsolePage() {
  const { isAdmin, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"roles" | "offerings" | "students" | "audit">("roles");
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Roles State
  const [roles, setRoles] = useState<UserRoleItem[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [adminNameInput, setAdminNameInput] = useState("");
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminUserIdInput, setAdminUserIdInput] = useState("");

  // 2. Offerings State
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [showCreateOfferingModal, setShowCreateOfferingModal] = useState(false);
  const [newSubCode, setNewSubCode] = useState("UCS405");
  const [newSubName, setNewSubName] = useState("Operating Systems");
  const [newTerm, setNewTerm] = useState("Even Semester 2026");
  const [newSection, setNewSection] = useState("Section A");
  const [newProfId, setNewProfId] = useState("prof-rajesh-kumar-id");

  // Teaching Assignment State
  const [showAssignProfModal, setShowAssignProfModal] = useState(false);
  const [assignOfferingId, setAssignOfferingId] = useState("");
  const [assignProfId, setAssignProfId] = useState("prof-sunita-sharma-id");

  // 3. Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AcademicAuditLog[]>([]);
  const [auditFilterOffering, setAuditFilterOffering] = useState("");
  const [loadingAudit, setLoadingAudit] = useState(false);

  // 4. Student Directory & Search State
  const [students, setStudents] = useState<StudentDirectoryItem[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [debouncedStudentQuery, setDebouncedStudentQuery] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const STUDENTS_PAGE_SIZE = 8;

  // 5. Admin Offering Operations State
  const [activeOpsOffering, setActiveOpsOffering] = useState<SubjectOffering | null>(null);
  const [opsActiveTab, setOpsActiveTab] = useState<"roster" | "sessions" | "assessments" | "assignments">("roster");
  const [opsLoading, setOpsLoading] = useState(false);

  // Operations: Roster
  const [opsRoster, setOpsRoster] = useState<RosterResponse | null>(null);
  const [showOpsEnrollModal, setShowOpsEnrollModal] = useState(false);
  const [opsDirectorySearch, setOpsDirectorySearch] = useState("");
  const [opsDirectoryResults, setOpsDirectoryResults] = useState<StudentDirectoryItem[]>([]);
  const [opsEnrollEffectiveDate, setOpsEnrollEffectiveDate] = useState("2026-02-15");
  const [isOpsSubmittingEnroll, setIsOpsSubmittingEnroll] = useState(false);

  // Operations: Sessions
  const [opsSessions, setOpsSessions] = useState<AttendanceSession[]>([]);
  const [opsSelectedSessionId, setOpsSelectedSessionId] = useState("");
  const [opsSessionRecords, setOpsSessionRecords] = useState<SessionAttendanceRecord[]>([]);
  const [showOpsNewSessionModal, setShowOpsNewSessionModal] = useState(false);
  const [opsNewSessionDate, setOpsNewSessionDate] = useState("2026-02-15");
  const [opsNewSessionSlot, setOpsNewSessionSlot] = useState("Lecture");
  const [isOpsSubmittingSession, setIsOpsSubmittingSession] = useState(false);

  // Operations: Assessments
  const [opsAssessments, setOpsAssessments] = useState<Assessment[]>([]);
  const [opsSelectedAssessmentId, setOpsSelectedAssessmentId] = useState("");
  const [opsAssessmentMarks, setOpsAssessmentMarks] = useState<StudentAssessmentMark[]>([]);
  const [showOpsNewAssessmentModal, setShowOpsNewAssessmentModal] = useState(false);
  const [opsNewAssessmentTitle, setOpsNewAssessmentTitle] = useState("");
  const [opsNewAssessmentType, setOpsNewAssessmentType] = useState("Quiz");
  const [opsNewAssessmentMaxMarks, setOpsNewAssessmentMaxMarks] = useState<number>(20);
  const [opsNewAssessmentWeight, setOpsNewAssessmentWeight] = useState<number>(10);
  const [opsNewAssessmentAnswerKey, setOpsNewAssessmentAnswerKey] = useState("");
  const [isOpsSubmittingAssessment, setIsOpsSubmittingAssessment] = useState(false);

  // Operations: Assignments
  const [opsAssignments, setOpsAssignments] = useState<OfferingAssignment[]>([]);
  const [opsSelectedAssignmentId, setOpsSelectedAssignmentId] = useState("");
  const [opsSubmissions, setOpsSubmissions] = useState<AssignmentSubmission[]>([]);
  const [showOpsNewAssignmentModal, setShowOpsNewAssignmentModal] = useState(false);
  const [opsNewAssignmentTitle, setOpsNewAssignmentTitle] = useState("");
  const [opsNewAssignmentInstructions, setOpsNewAssignmentInstructions] = useState("");
  const [opsNewAssignmentDueDate, setOpsNewAssignmentDueDate] = useState("2026-03-15T23:59:00");
  const [opsNewAssignmentModelAnswer, setOpsNewAssignmentModelAnswer] = useState("");
  const [isOpsSubmittingAssignment, setIsOpsSubmittingAssignment] = useState(false);
  const [opsGradingSubmission, setOpsGradingSubmission] = useState<AssignmentSubmission | null>(null);
  const [opsGradeScoreInput, setOpsGradeScoreInput] = useState<number>(0);
  const [opsGradeFeedbackInput, setOpsGradeFeedbackInput] = useState<string>("");

  // Quick Enroll from Student Directory
  const [quickEnrollStudent, setQuickEnrollStudent] = useState<StudentDirectoryItem | null>(null);
  const [quickEnrollOfferingId, setQuickEnrollOfferingId] = useState("");
  const [quickEnrollEffectiveDate, setQuickEnrollEffectiveDate] = useState("2026-02-15");
  const [isSubmittingQuickEnroll, setIsSubmittingQuickEnroll] = useState(false);

  // Debounce search input and reset page to 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStudentQuery(studentSearchQuery);
      setStudentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearchQuery]);

  const loadRoles = useCallback(async () => {
    try {
      setLoadingRoles(true);
      const data = await fetchUserRoles();
      setRoles(data);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load user roles." });
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const loadOfferingsAndSubjects = useCallback(async () => {
    try {
      setLoadingOfferings(true);
      const [offs, subs] = await Promise.all([fetchOfferings(), fetchSubjects()]);
      setOfferings(offs);
      setSubjects(subs);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load offerings." });
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoadingAudit(true);
      const data = await fetchAcademicAuditLogs(auditFilterOffering || undefined);
      setAuditLogs(data);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load audit logs." });
    } finally {
      setLoadingAudit(false);
    }
  }, [auditFilterOffering]);

  const loadStudents = useCallback(async (query: string = "") => {
    try {
      setLoadingStudents(true);
      const data = await fetchStudentDirectory(query);
      setStudents(data);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to search student directory." });
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "roles") loadRoles();
    if (activeTab === "offerings") loadOfferingsAndSubjects();
    if (activeTab === "students") loadStudents(debouncedStudentQuery);
    if (activeTab === "audit") loadAuditLogs();
  }, [isAdmin, activeTab, debouncedStudentQuery, loadRoles, loadOfferingsAndSubjects, loadStudents, loadAuditLogs]);

  const handleUpdateRole = async (userId: string, newRole: string, statusVal: string = "active") => {
    try {
      await updateUserRole(userId, newRole, statusVal);
      loadRoles();
      setFeedbackMessage({ type: "success", text: `Updated user ${userId} to ${newRole} (${statusVal}).` });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to update role." });
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createAdminAccount({
        email: adminEmailInput,
        full_name: adminNameInput,
        user_id: adminUserIdInput || undefined,
      });
      setShowCreateAdminModal(false);
      setAdminNameInput("");
      setAdminEmailInput("");
      setAdminUserIdInput("");
      loadRoles();
      setFeedbackMessage({
        type: "success",
        text: `Administrator ${res.full_name} (${res.email}) provisioned successfully.`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "Failed to create administrator account.",
      });
    }
  };

  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createOffering({
        subject_code: newSubCode,
        subject_name: newSubName,
        term: newTerm,
        section: newSection,
        professor_ids: newProfId ? [newProfId] : [],
      });
      setShowCreateOfferingModal(false);
      loadOfferingsAndSubjects();
      setFeedbackMessage({ type: "success", text: `Offering ${newSubCode} (${newSection}) created.` });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to create offering." });
    }
  };

  const handleAssignProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignOfferingId || !assignProfId) return;
    try {
      await assignProfessorToOffering(assignOfferingId, assignProfId);
      setShowAssignProfModal(false);
      loadOfferingsAndSubjects();
      setFeedbackMessage({ type: "success", text: `Professor assigned to offering ${assignOfferingId}.` });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to assign professor." });
    }
  };

  // Operations Loaders
  const loadOpsRoster = useCallback(async () => {
    if (!activeOpsOffering) return;
    try {
      setOpsLoading(true);
      const data = await fetchOfferingRoster(activeOpsOffering.id);
      setOpsRoster(data);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load offering roster." });
    } finally {
      setOpsLoading(false);
    }
  }, [activeOpsOffering]);

  const loadOpsSessions = useCallback(async () => {
    if (!activeOpsOffering) return;
    try {
      setOpsLoading(true);
      const data = await fetchAttendanceSessions(activeOpsOffering.id);
      setOpsSessions(data);
      if (data.length > 0 && !opsSelectedSessionId) {
        setOpsSelectedSessionId(data[0].id);
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load sessions." });
    } finally {
      setOpsLoading(false);
    }
  }, [activeOpsOffering, opsSelectedSessionId]);

  const loadOpsSessionRecords = useCallback(async () => {
    if (!activeOpsOffering || !opsSelectedSessionId) return;
    try {
      const data = await fetchSessionAttendanceRecords(activeOpsOffering.id, opsSelectedSessionId);
      setOpsSessionRecords(data);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load session records." });
    }
  }, [activeOpsOffering, opsSelectedSessionId]);

  const loadOpsAssessments = useCallback(async () => {
    if (!activeOpsOffering) return;
    try {
      setOpsLoading(true);
      const data = await fetchOfferingAssessments(activeOpsOffering.id);
      setOpsAssessments(data);
      if (data.length > 0 && !opsSelectedAssessmentId) {
        setOpsSelectedAssessmentId(data[0].id);
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load assessments." });
    } finally {
      setOpsLoading(false);
    }
  }, [activeOpsOffering, opsSelectedAssessmentId]);

  const loadOpsAssessmentMarks = useCallback(async () => {
    if (!activeOpsOffering || !opsSelectedAssessmentId) return;
    try {
      const data = await fetchAssessmentMarks(activeOpsOffering.id, opsSelectedAssessmentId);
      setOpsAssessmentMarks(data);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load marks." });
    }
  }, [activeOpsOffering, opsSelectedAssessmentId]);

  const loadOpsAssignments = useCallback(async () => {
    if (!activeOpsOffering) return;
    try {
      setOpsLoading(true);
      const data = await fetchOfferingAssignments(activeOpsOffering.id);
      setOpsAssignments(data);
      if (data.length > 0 && !opsSelectedAssignmentId) {
        setOpsSelectedAssignmentId(data[0].id);
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load assignments." });
    } finally {
      setOpsLoading(false);
    }
  }, [activeOpsOffering, opsSelectedAssignmentId]);

  const loadOpsSubmissions = useCallback(async () => {
    if (!activeOpsOffering || !opsSelectedAssignmentId) return;
    try {
      const data = await fetchAssignmentSubmissions(activeOpsOffering.id, opsSelectedAssignmentId);
      setOpsSubmissions(data);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load submissions." });
    }
  }, [activeOpsOffering, opsSelectedAssignmentId]);

  useEffect(() => {
    if (!activeOpsOffering) return;
    if (opsActiveTab === "roster") loadOpsRoster();
    if (opsActiveTab === "sessions") loadOpsSessions();
    if (opsActiveTab === "assessments") loadOpsAssessments();
    if (opsActiveTab === "assignments") loadOpsAssignments();
  }, [activeOpsOffering, opsActiveTab, loadOpsRoster, loadOpsSessions, loadOpsAssessments, loadOpsAssignments]);

  useEffect(() => {
    if (activeOpsOffering && opsSelectedSessionId) {
      loadOpsSessionRecords();
    }
  }, [activeOpsOffering, opsSelectedSessionId, loadOpsSessionRecords]);

  useEffect(() => {
    if (activeOpsOffering && opsSelectedAssessmentId) {
      loadOpsAssessmentMarks();
    }
  }, [activeOpsOffering, opsSelectedAssessmentId, loadOpsAssessmentMarks]);

  useEffect(() => {
    if (activeOpsOffering && opsSelectedAssignmentId) {
      loadOpsSubmissions();
    }
  }, [activeOpsOffering, opsSelectedAssignmentId, loadOpsSubmissions]);

  useEffect(() => {
    if (showOpsEnrollModal) {
      fetchStudentDirectory(opsDirectorySearch)
        .then(setOpsDirectoryResults)
        .catch(() => {});
    }
  }, [showOpsEnrollModal, opsDirectorySearch]);

  const handleOpenOfferingOperations = (off: SubjectOffering) => {
    setActiveOpsOffering(off);
    setOpsActiveTab("roster");
    setOpsSelectedSessionId("");
    setOpsSelectedAssessmentId("");
    setOpsSelectedAssignmentId("");
  };

  const handleOpsCreateSession = async () => {
    if (!activeOpsOffering || isOpsSubmittingSession) return;
    try {
      setIsOpsSubmittingSession(true);
      await createAttendanceSession(activeOpsOffering.id, opsNewSessionDate, opsNewSessionSlot);
      setShowOpsNewSessionModal(false);
      setFeedbackMessage({ type: "success", text: `Session created for ${opsNewSessionDate}` });
      loadOpsSessions();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to create session." });
    } finally {
      setIsOpsSubmittingSession(false);
    }
  };

  const handleOpsMarkStatus = async (studentId: string, newStatus: string, reason?: string) => {
    if (!activeOpsOffering || !opsSelectedSessionId) return;
    try {
      await markSessionAttendance(activeOpsOffering.id, opsSelectedSessionId, [
        { student_id: studentId, status: newStatus, correction_reason: reason },
      ]);
      loadOpsSessionRecords();
      setFeedbackMessage({ type: "success", text: `Attendance updated to ${newStatus}` });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to update attendance." });
    }
  };

  const handleOpsCreateAssessment = async () => {
    if (!activeOpsOffering || isOpsSubmittingAssessment) return;
    if (!opsNewAssessmentTitle.trim()) {
      setFeedbackMessage({ type: "error", text: "Assessment title is required." });
      return;
    }
    if (Number(opsNewAssessmentMaxMarks) <= 0) {
      setFeedbackMessage({ type: "error", text: "Maximum marks must be greater than zero." });
      return;
    }
    try {
      setIsOpsSubmittingAssessment(true);
      await createOfferingAssessment(activeOpsOffering.id, {
        title: opsNewAssessmentTitle.trim(),
        assessment_type: opsNewAssessmentType,
        max_marks: Number(opsNewAssessmentMaxMarks),
        weight_percent: Number(opsNewAssessmentWeight),
        answer_key_content: opsNewAssessmentAnswerKey || undefined,
        is_published: false,
      });
      setShowOpsNewAssessmentModal(false);
      setOpsNewAssessmentTitle("");
      setFeedbackMessage({ type: "success", text: "Draft assessment created successfully." });
      loadOpsAssessments();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to create assessment." });
    } finally {
      setIsOpsSubmittingAssessment(false);
    }
  };

  const handleOpsToggleAssessmentPublish = async (asm: Assessment) => {
    if (!activeOpsOffering) return;
    try {
      await updateOfferingAssessment(activeOpsOffering.id, asm.id, {
        is_published: !asm.is_published,
      });
      loadOpsAssessments();
      setFeedbackMessage({
        type: "success",
        text: `Assessment "${asm.title}" is now ${!asm.is_published ? "Published" : "Draft"}.`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message });
    }
  };

  const handleOpsToggleAnswerKeyRelease = async (asm: Assessment) => {
    if (!activeOpsOffering) return;
    try {
      await updateOfferingAssessment(activeOpsOffering.id, asm.id, {
        answer_key_released: !asm.answer_key_released,
      });
      loadOpsAssessments();
      setFeedbackMessage({
        type: "success",
        text: `Answer key is now ${!asm.answer_key_released ? "Released to students" : "Concealed"}.`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message });
    }
  };

  const handleOpsUpdateStudentMark = async (studentId: string, marksVal: number, feedbackVal?: string) => {
    if (!activeOpsOffering || !opsSelectedAssessmentId) return;
    try {
      await updateAssessmentMarks(activeOpsOffering.id, opsSelectedAssessmentId, [
        { student_id: studentId, obtained_marks: marksVal, feedback: feedbackVal, status: "graded" },
      ]);
      loadOpsAssessmentMarks();
      setFeedbackMessage({ type: "success", text: "Mark updated successfully." });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message });
    }
  };

  const handleOpsCreateAssignment = async () => {
    if (!activeOpsOffering || isOpsSubmittingAssignment) return;
    if (!opsNewAssignmentTitle.trim()) {
      setFeedbackMessage({ type: "error", text: "Assignment title is required." });
      return;
    }
    try {
      setIsOpsSubmittingAssignment(true);
      await createOfferingAssignment(activeOpsOffering.id, {
        title: opsNewAssignmentTitle.trim(),
        instructions: opsNewAssignmentInstructions.trim(),
        due_date: opsNewAssignmentDueDate,
        model_answer: opsNewAssignmentModelAnswer || undefined,
        is_published: true,
      });
      setShowOpsNewAssignmentModal(false);
      setOpsNewAssignmentTitle("");
      setOpsNewAssignmentInstructions("");
      setFeedbackMessage({ type: "success", text: "Assignment created and published." });
      loadOpsAssignments();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message });
    } finally {
      setIsOpsSubmittingAssignment(false);
    }
  };

  const handleOpsToggleModelAnswerRelease = async (asg: OfferingAssignment) => {
    if (!activeOpsOffering) return;
    try {
      await updateOfferingAssignment(activeOpsOffering.id, asg.id, {
        model_answer_released: !asg.model_answer_released,
      });
      loadOpsAssignments();
      setFeedbackMessage({
        type: "success",
        text: `Model answer is now ${!asg.model_answer_released ? "Released to students" : "Concealed"}.`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message });
    }
  };

  const handleOpsGradeSubmission = async () => {
    if (!activeOpsOffering || !opsSelectedAssignmentId || !opsGradingSubmission) return;
    try {
      await gradeAssignmentSubmission(
        activeOpsOffering.id,
        opsSelectedAssignmentId,
        opsGradingSubmission.id,
        opsGradeScoreInput,
        opsGradeFeedbackInput
      );
      setOpsGradingSubmission(null);
      loadOpsSubmissions();
      setFeedbackMessage({ type: "success", text: "Grade and feedback saved." });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to save grade." });
    }
  };

  const handleOpsEnrollStudent = async (student: StudentDirectoryItem) => {
    if (!activeOpsOffering || isOpsSubmittingEnroll) return;
    try {
      setIsOpsSubmittingEnroll(true);
      await enrollStudentInOffering(activeOpsOffering.id, {
        student_id: student.student_id,
        student_name: student.full_name,
        student_roll_no: student.roll_no,
        student_email: student.email,
        effective_date: opsEnrollEffectiveDate || undefined,
      });
      setShowOpsEnrollModal(false);
      loadOpsRoster();
      loadOfferingsAndSubjects();
      setFeedbackMessage({ type: "success", text: `Enrolled ${student.full_name} (${student.roll_no}) into offering.` });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to enroll student." });
    } finally {
      setIsOpsSubmittingEnroll(false);
    }
  };

  const handleOpsDisenrollStudent = async (studentId: string, name: string) => {
    if (!activeOpsOffering) return;
    const reason = window.prompt(`Reason for disenrolling ${name}:`, "Course transfer or withdrawal");
    if (!reason) return;
    try {
      await disenrollStudentFromOffering(activeOpsOffering.id, studentId, reason);
      loadOpsRoster();
      loadOfferingsAndSubjects();
      setFeedbackMessage({ type: "success", text: `Disenrolled ${name} (history preserved).` });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message });
    }
  };

  const handleOpenQuickEnroll = (student: StudentDirectoryItem) => {
    setQuickEnrollStudent(student);
    if (offerings.length > 0 && !quickEnrollOfferingId) {
      setQuickEnrollOfferingId(offerings[0].id);
    }
  };

  const handleConfirmQuickEnroll = async () => {
    if (!quickEnrollStudent || !quickEnrollOfferingId || isSubmittingQuickEnroll) return;
    try {
      setIsSubmittingQuickEnroll(true);
      await enrollStudentInOffering(quickEnrollOfferingId, {
        student_id: quickEnrollStudent.student_id,
        student_name: quickEnrollStudent.full_name,
        student_roll_no: quickEnrollStudent.roll_no,
        student_email: quickEnrollStudent.email,
        effective_date: quickEnrollEffectiveDate || undefined,
      });
      setQuickEnrollStudent(null);
      loadOfferingsAndSubjects();
      setFeedbackMessage({
        type: "success",
        text: `Successfully enrolled ${quickEnrollStudent.full_name} into offering.`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to enroll student." });
    } finally {
      setIsSubmittingQuickEnroll(false);
    }
  };

  if (!isLoading && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800 shadow-sm">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Administrator Access Required
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The Academic Administration Console is restricted to authorized institutional administrators and DOAA officers. You are currently signed in with student permissions.
          </p>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/">
            <Button variant="secondary">Return to Dashboard</Button>
          </Link>
          <Link href="/login">
            <Button>Switch Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Academic Administration Console
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Institutional governance, offering provisioning, faculty assignments, and audit trails.
          </p>
        </div>

        <Badge variant="default" className="font-mono text-xs self-start sm:self-auto">
          DOAA Superadmin Mode
        </Badge>
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            feedbackMessage.type === "success"
              ? "bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-900/60"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        {[
          { id: "roles", label: "User Roles & Permissions", icon: Users },
          { id: "offerings", label: "Subject Offerings & Teaching", icon: BookOpen },
          { id: "students", label: "Student Directory & Records", icon: Search },
          { id: "audit", label: "Academic Audit Trail", icon: History },
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

      {/* TAB 1: USER ROLES */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Role Management</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage roles and account states. Safe invariants prevent removal of the last administrator.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowCreateAdminModal(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Administrator
              </Button>
              <Button size="sm" variant="secondary" onClick={loadRoles}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">User Identifier</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Modify Permission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingRoles ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Loading user roles...
                    </td>
                  </tr>
                ) : (
                  roles.map((u) => (
                    <tr key={u.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-white">
                        {u.user_id}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={u.role === "admin" ? "primary" : u.role === "professor" ? "info" : "default"}
                        >
                          {u.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            u.status === "active" ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === "active" ? "bg-teal-500" : "bg-slate-400"
                            }`}
                          />
                          {u.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.user_id, e.target.value, u.status)}
                          className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                        >
                          <option value="student">Student</option>
                          <option value="professor">Professor</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SUBJECT OFFERINGS */}
      {activeTab === "offerings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Offerings & Faculty Assignments</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Provision new subject offerings across terms and assign primary instructors.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowAssignProfModal(true)}>
                <UserCheck className="w-4 h-4 mr-1" />
                Assign Faculty
              </Button>
              <Button size="sm" onClick={() => setShowCreateOfferingModal(true)}>
                <Plus className="w-4 h-4 mr-1" />
                New Offering
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offerings.map((off) => (
              <Card key={off.id} className="p-4 border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                    {off.subject_code}
                  </span>
                  <Badge variant="default">{off.section}</Badge>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{off.subject_name}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{off.term}</div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1">
                  <div className="text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">Faculty:</span> {off.professor_names.join(", ") || "Unassigned"}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">Enrolled:</span> {off.enrolled_count} students
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">Threshold:</span> {off.attendance_threshold}%
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs font-semibold"
                    onClick={() => handleOpenOfferingOperations(off)}
                  >
                    <ClipboardList className="w-3.5 h-3.5 mr-1 text-teal-600 dark:text-teal-400" />
                    Academic Operations
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT DIRECTORY & SEARCH */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Student Directory & Academic Records
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional directory search across name, roll number, branch, and email address.
              </p>
            </div>
            {/* Real-time search query count */}
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              {loadingStudents ? (
                <span>Searching records...</span>
              ) : (
                <span>
                  Showing <strong className="text-slate-900 dark:text-white">{students.length > 0 ? (studentPage - 1) * STUDENTS_PAGE_SIZE + 1 : 0}</strong> -{" "}
                  <strong className="text-slate-900 dark:text-white">{Math.min(studentPage * STUDENTS_PAGE_SIZE, students.length)}</strong> of{" "}
                  <strong className="text-slate-900 dark:text-white">{students.length}</strong> matching student(s)
                </span>
              )}
            </div>
          </div>

          {/* Search Input Bar with Clear Button */}
          <Card className="p-3 border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                placeholder="Search by student name, roll number, branch, or email (e.g. Arjun, 102203099, COE)..."
                className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setStudentSearchQuery("")}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </Card>

          {/* Table / Results */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {loadingStudents ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                Loading institutional records...
              </div>
            ) : students.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <EmptyState
                  icon={<Search className="w-8 h-8 text-slate-400" />}
                  title={debouncedStudentQuery ? `No students matching "${debouncedStudentQuery}"` : "No Student Records"}
                  description={
                    debouncedStudentQuery
                      ? "No student records matched your search query. Check for typos or search by roll number."
                      : "No student directory records are registered in the academic database."
                  }
                />
                {debouncedStudentQuery && (
                  <div className="mt-4">
                    <Button variant="secondary" size="sm" onClick={() => setStudentSearchQuery("")}>
                      Clear Search Filter
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Roll Number</th>
                        <th className="py-3 px-4">Branch &amp; Term</th>
                        <th className="py-3 px-4">Institutional Email</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {students
                        .slice((studentPage - 1) * STUDENTS_PAGE_SIZE, studentPage * STUDENTS_PAGE_SIZE)
                        .map((s) => (
                          <tr key={s.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                                {s.full_name ? s.full_name.charAt(0).toUpperCase() : "S"}
                              </span>
                              <span>{s.full_name}</span>
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                              {s.roll_no}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              <Badge variant="default" size="sm" className="font-semibold">
                                {s.branch}
                              </Badge>{" "}
                              <span className="text-slate-400 ml-1">Sem {s.semester}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                              {s.email}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenQuickEnroll(s)}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Enroll in Offering
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {students.length > STUDENTS_PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Page <strong className="text-slate-900 dark:text-white">{studentPage}</strong> of{" "}
                      <strong className="text-slate-900 dark:text-white">
                        {Math.ceil(students.length / STUDENTS_PAGE_SIZE)}
                      </strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={studentPage === 1}
                        onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                        className="flex items-center gap-1 text-xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={studentPage * STUDENTS_PAGE_SIZE >= students.length}
                        onClick={() => setStudentPage((p) => p + 1)}
                        className="flex items-center gap-1 text-xs"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Immutable Academic Audit Log</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Server-side verified transaction logs for enrollments, attendance, and mark updates.
              </p>
            </div>
            <select
              value={auditFilterOffering}
              onChange={(e) => setAuditFilterOffering(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="">All Offerings</option>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.subject_code} ({o.section})
                </option>
              ))}
            </select>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Offering</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Loading audit log...
                      </td>
                    </tr>
                  ) : !auditLogs.length ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 text-xs font-mono text-slate-500">
                          {log.timestamp.slice(0, 19).replace("T", " ")}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="default" className="font-mono text-[10px]">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-semibold text-slate-900 dark:text-white">{log.actor_role.toUpperCase()}</div>
                          <div className="text-slate-400 font-mono text-[11px] truncate max-w-xs">{log.actor_id}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                          {log.offering_id || "System"}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                          {log.reason || JSON.stringify(log.details)}
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

      {/* MODAL: Create Offering */}
      {showCreateOfferingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Provision Subject Offering</h3>
            <form onSubmit={handleCreateOffering} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Subject Code</label>
                <input
                  type="text"
                  required
                  value={newSubCode}
                  onChange={(e) => setNewSubCode(e.target.value.toUpperCase())}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Subject Name</label>
                <input
                  type="text"
                  required
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Term</label>
                  <input
                    type="text"
                    required
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Section</label>
                  <input
                    type="text"
                    required
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Assigned Faculty</label>
                <select
                  value={newProfId}
                  onChange={(e) => setNewProfId(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="prof-rajesh-kumar-id">Dr. Rajesh Kumar (prof_rajesh@thapar.edu)</option>
                  <option value="prof-sunita-sharma-id">Dr. Sunita Sharma (prof_sunita@thapar.edu)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateOfferingModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Provision Offering
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Assign Professor */}
      {showAssignProfModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign Faculty to Offering</h3>
            <form onSubmit={handleAssignProfessor} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Target Offering</label>
                <select
                  required
                  value={assignOfferingId}
                  onChange={(e) => setAssignOfferingId(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Select Offering...</option>
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.subject_code} — {o.section} ({o.term})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Faculty Member</label>
                <select
                  required
                  value={assignProfId}
                  onChange={(e) => setAssignProfId(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="prof-rajesh-kumar-id">Dr. Rajesh Kumar</option>
                  <option value="prof-sunita-sharma-id">Dr. Sunita Sharma</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowAssignProfModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Confirm Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: Create Administrator */}
      {showCreateAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Provision New Administrator</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Authorized superadmins can grant full academic administrative privileges to institutional personnel.
              </p>
            </div>
            <form onSubmit={handleCreateAdmin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. A. K. Verma"
                  value={adminNameInput}
                  onChange={(e) => setAdminNameInput(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Institutional Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. akverma@thapar.edu"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">User Identifier (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. admin-akverma"
                  value={adminUserIdInput}
                  onChange={(e) => setAdminUserIdInput(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateAdminModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Provision Admin
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Quick Enroll from Student Directory */}
      {quickEnrollStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Enroll Student in Offering</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Assign {quickEnrollStudent.full_name} ({quickEnrollStudent.roll_no}) to an institutional subject offering.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Target Offering</label>
                <select
                  value={quickEnrollOfferingId}
                  onChange={(e) => setQuickEnrollOfferingId(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {offerings.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.subject_code} - {off.subject_name} ({off.section})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Effective Enrollment Date</label>
                <input
                  type="date"
                  value={quickEnrollEffectiveDate}
                  onChange={(e) => setQuickEnrollEffectiveDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setQuickEnrollStudent(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={isSubmittingQuickEnroll} onClick={handleConfirmQuickEnroll}>
                {isSubmittingQuickEnroll ? "Enrolling..." : "Confirm Enrollment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Comprehensive Offering Academic Operations */}
      {activeOpsOffering && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-teal-600 dark:text-teal-400">
                    {activeOpsOffering.subject_code}
                  </span>
                  <Badge variant="default">{activeOpsOffering.section}</Badge>
                  <span className="text-xs text-slate-500">• {activeOpsOffering.term}</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeOpsOffering.subject_name}
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveOpsOffering(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4">
              {[
                { id: "roster", label: "Roster & Enrollment", icon: Users },
                { id: "sessions", label: "Attendance Sessions", icon: Calendar },
                { id: "assessments", label: "Assessments & Marks", icon: FileText },
                { id: "assignments", label: "Assignments & Submissions", icon: ClipboardList },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = opsActiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setOpsActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                      isActive
                        ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400"
                        : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Content Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* TAB A: ROSTER & ENROLLMENT */}
              {opsActiveTab === "roster" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="primary">
                        {opsRoster?.students.filter((s) => s.enrollment_status === "active").length || 0} Active
                      </Badge>
                      <Badge variant="default">
                        {opsRoster?.students.filter((s) => s.enrollment_status === "disenrolled").length || 0} Disenrolled
                      </Badge>
                    </div>
                    <Button size="sm" onClick={() => setShowOpsEnrollModal(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Enroll Student
                    </Button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Roll Number</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Enrolled On</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {opsLoading ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">Loading roster...</td>
                          </tr>
                        ) : !opsRoster?.students.length ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">No students enrolled yet.</td>
                          </tr>
                        ) : (
                          opsRoster.students.map((st) => (
                            <tr key={st.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{st.student_name}</td>
                              <td className="py-2.5 px-3 font-mono">{st.student_roll_no}</td>
                              <td className="py-2.5 px-3">
                                <Badge variant={st.enrollment_status === "active" ? "primary" : "default"} size="sm">
                                  {st.enrollment_status.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">{st.enrolled_at ? st.enrolled_at.slice(0, 10) : "-"}</td>
                              <td className="py-2.5 px-3 text-right">
                                {st.enrollment_status === "active" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-rose-600 hover:text-rose-700 h-7 text-xs"
                                    onClick={() => handleOpsDisenrollStudent(st.student_id, st.student_name)}
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
              )}

              {/* TAB B: ATTENDANCE SESSIONS */}
              {opsActiveTab === "sessions" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {opsSessions.length} Scheduled Sessions
                    </span>
                    <Button size="sm" onClick={() => setShowOpsNewSessionModal(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      New Session
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Session Selector List */}
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {!opsSessions.length ? (
                        <div className="py-6 text-center text-xs text-slate-500">No attendance sessions.</div>
                      ) : (
                        opsSessions.map((sess) => (
                          <div
                            key={sess.id}
                            onClick={() => setOpsSelectedSessionId(sess.id)}
                            className={`p-2.5 rounded-lg border cursor-pointer text-xs transition ${
                              opsSelectedSessionId === sess.id
                                ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                              <span>{sess.session_date}</span>
                              <Badge variant="default" size="sm">{sess.slot_type}</Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {sess.records_count} records recorded
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Attendance Marking Sheet */}
                    <div className="md:col-span-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Session Attendance Sheet
                      </h4>
                      {!opsSelectedSessionId ? (
                        <div className="py-8 text-center text-xs text-slate-400">Select a session to view or record attendance.</div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {opsRoster?.students
                            .filter((st) => st.enrollment_status === "active")
                            .map((st) => {
                              const rec = opsSessionRecords.find((r) => r.student_id === st.student_id);
                              const currentStatus = rec?.status || "unmarked";
                              return (
                                <div key={st.student_id} className="py-2 flex items-center justify-between text-xs">
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">{st.student_name}</div>
                                    <div className="text-[11px] text-slate-500 font-mono">{st.student_roll_no}</div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {["present", "absent", "late", "excused"].map((stOption) => (
                                      <button
                                        key={stOption}
                                        onClick={() => handleOpsMarkStatus(st.student_id, stOption)}
                                        className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                                          currentStatus === stOption
                                            ? stOption === "present"
                                              ? "bg-teal-600 text-white"
                                              : stOption === "absent"
                                              ? "bg-rose-600 text-white"
                                              : stOption === "late"
                                              ? "bg-amber-500 text-white"
                                              : "bg-blue-600 text-white"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                        }`}
                                      >
                                        {stOption.charAt(0).toUpperCase() + stOption.slice(1)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB C: ASSESSMENTS & MARKS */}
              {opsActiveTab === "assessments" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {opsAssessments.length} Configured Assessments
                    </span>
                    <Button size="sm" onClick={() => setShowOpsNewAssessmentModal(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      New Assessment
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Assessment Selector */}
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {!opsAssessments.length ? (
                        <div className="py-6 text-center text-xs text-slate-500">No assessments created.</div>
                      ) : (
                        opsAssessments.map((asm) => (
                          <div
                            key={asm.id}
                            onClick={() => setOpsSelectedAssessmentId(asm.id)}
                            className={`p-2.5 rounded-lg border cursor-pointer text-xs transition ${
                              opsSelectedAssessmentId === asm.id
                                ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="font-semibold text-slate-900 dark:text-white">{asm.title}</div>
                            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                              <span>Max: {asm.max_marks} • Wt: {asm.weight_percent}%</span>
                              <Badge variant={asm.is_published ? "primary" : "default"} size="sm">
                                {asm.is_published ? "Published" : "Draft"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpsToggleAssessmentPublish(asm);
                                }}
                                className="text-teal-600 hover:underline font-semibold"
                              >
                                {asm.is_published ? "Unpublish" : "Publish"}
                              </button>
                              <span>•</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpsToggleAnswerKeyRelease(asm);
                                }}
                                className="text-slate-500 hover:underline"
                              >
                                {asm.answer_key_released ? "Conceal Answers" : "Release Answers"}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Marks Entry Sheet */}
                    <div className="md:col-span-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Assessment Marks Record
                      </h4>
                      {!opsSelectedAssessmentId ? (
                        <div className="py-8 text-center text-xs text-slate-400">Select an assessment to enter marks.</div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {opsRoster?.students
                            .filter((st) => st.enrollment_status === "active")
                            .map((st) => {
                              const markRec = opsAssessmentMarks.find((m) => m.student_id === st.student_id);
                              return (
                                <div key={st.student_id} className="py-2 flex items-center justify-between text-xs">
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">{st.student_name}</div>
                                    <div className="text-[11px] text-slate-500 font-mono">{st.student_roll_no}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      step="0.5"
                                      defaultValue={markRec?.obtained_marks ?? ""}
                                      onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val)) {
                                          handleOpsUpdateStudentMark(st.student_id, val);
                                        }
                                      }}
                                      className="w-16 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                      placeholder="0"
                                    />
                                    <span className="text-[11px] text-slate-400">
                                      / {opsAssessments.find((a) => a.id === opsSelectedAssessmentId)?.max_marks || 20}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB D: ASSIGNMENTS & SUBMISSIONS */}
              {opsActiveTab === "assignments" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {opsAssignments.length} Assignments
                    </span>
                    <Button size="sm" onClick={() => setShowOpsNewAssignmentModal(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      New Assignment
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Assignment Selector */}
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {!opsAssignments.length ? (
                        <div className="py-6 text-center text-xs text-slate-500">No assignments created.</div>
                      ) : (
                        opsAssignments.map((asg) => (
                          <div
                            key={asg.id}
                            onClick={() => setOpsSelectedAssignmentId(asg.id)}
                            className={`p-2.5 rounded-lg border cursor-pointer text-xs transition ${
                              opsSelectedAssignmentId === asg.id
                                ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="font-semibold text-slate-900 dark:text-white">{asg.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Due: {asg.due_date ? asg.due_date.slice(0, 10) : "-"}
                            </div>
                            <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpsToggleModelAnswerRelease(asg);
                                }}
                                className="text-teal-600 hover:underline font-semibold"
                              >
                                {asg.model_answer_released ? "Conceal Model Answer" : "Release Model Answer"}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Submissions List */}
                    <div className="md:col-span-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Student Submissions &amp; Grading
                      </h4>
                      {!opsSelectedAssignmentId ? (
                        <div className="py-8 text-center text-xs text-slate-400">Select an assignment to review submissions.</div>
                      ) : !opsSubmissions.length ? (
                        <div className="py-8 text-center text-xs text-slate-400">No student submissions yet.</div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {opsSubmissions.map((sub) => (
                            <div key={sub.id} className="py-2.5 flex items-center justify-between text-xs">
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">{sub.student_name}</div>
                                <div className="text-[11px] text-slate-500">
                                  Submitted: {sub.submitted_at.slice(0, 10)} {sub.is_late && <span className="text-rose-500 font-bold">(Late)</span>}
                                </div>
                                {sub.feedback && (
                                  <div className="text-[11px] text-teal-600 mt-0.5 italic">Feedback: {sub.feedback}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {sub.score !== null && sub.score !== undefined ? (
                                  <span className="font-bold text-teal-600">{sub.score} pts</span>
                                ) : (
                                  <Badge variant="default" size="sm">Ungraded</Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setOpsGradingSubmission(sub);
                                    setOpsGradeScoreInput(sub.score ?? 10);
                                    setOpsGradeFeedbackInput(sub.feedback ?? "");
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
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setActiveOpsOffering(null)}>
                Close Operations Console
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL: Enroll Student into Offering */}
      {showOpsEnrollModal && activeOpsOffering && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Enroll Eligible Student</h3>
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or roll number..."
                  value={opsDirectorySearch}
                  onChange={(e) => setOpsDirectorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Effective Enrollment Date</label>
                <input
                  type="date"
                  value={opsEnrollEffectiveDate}
                  onChange={(e) => setOpsEnrollEffectiveDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {!opsDirectoryResults.length ? (
                <div className="py-4 text-center text-xs text-slate-500">No matching students found.</div>
              ) : (
                opsDirectoryResults.map((s) => {
                  const isAlreadyEnrolled = opsRoster?.students.some(
                    (st) => st.student_id === s.student_id && st.enrollment_status === "active"
                  );
                  return (
                    <div key={s.student_id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{s.full_name}</div>
                        <div className="text-xs text-slate-500">{s.roll_no} • {s.branch} Sem {s.semester}</div>
                      </div>
                      {isAlreadyEnrolled ? (
                        <Badge variant="primary" size="sm">Active Enrolled</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isOpsSubmittingEnroll}
                          onClick={() => handleOpsEnrollStudent(s)}
                        >
                          {isOpsSubmittingEnroll ? "Enrolling..." : "Enroll"}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowOpsEnrollModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL: Create New Session */}
      {showOpsNewSessionModal && activeOpsOffering && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Attendance Session</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Session Date</label>
                <input
                  type="date"
                  value={opsNewSessionDate}
                  onChange={(e) => setOpsNewSessionDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Slot Type</label>
                <select
                  value={opsNewSessionSlot}
                  onChange={(e) => setOpsNewSessionSlot(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="Lecture">Lecture</option>
                  <option value="Tutorial">Tutorial</option>
                  <option value="Lab">Lab Practical</option>
                  <option value="Extra">Extra Session</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowOpsNewSessionModal(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={isOpsSubmittingSession} onClick={handleOpsCreateSession}>
                {isOpsSubmittingSession ? "Creating..." : "Create Session"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL: Create New Assessment */}
      {showOpsNewAssessmentModal && activeOpsOffering && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Assessment</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quiz 2: Dynamic Programming"
                  value={opsNewAssessmentTitle}
                  onChange={(e) => setOpsNewAssessmentTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Type</label>
                  <select
                    value={opsNewAssessmentType}
                    onChange={(e) => setOpsNewAssessmentType(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Quiz">Quiz</option>
                    <option value="MST">MST Exam</option>
                    <option value="EST">EST Exam</option>
                    <option value="Lab">Lab Practical</option>
                    <option value="Project">Project</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Max Marks</label>
                  <input
                    type="number"
                    min="1"
                    value={opsNewAssessmentMaxMarks}
                    onChange={(e) => setOpsNewAssessmentMaxMarks(Number(e.target.value))}
                    className="w-full mt-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Weight (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={opsNewAssessmentWeight}
                    onChange={(e) => setOpsNewAssessmentWeight(Number(e.target.value))}
                    className="w-full mt-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Answer Key / Model Solution (Optional)</label>
                <textarea
                  rows={2}
                  value={opsNewAssessmentAnswerKey}
                  onChange={(e) => setOpsNewAssessmentAnswerKey(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  placeholder="Concealed until released to students."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowOpsNewAssessmentModal(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={isOpsSubmittingAssessment} onClick={handleOpsCreateAssessment}>
                {isOpsSubmittingAssessment ? "Creating..." : "Create Draft Assessment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL: Create New Assignment */}
      {showOpsNewAssignmentModal && activeOpsOffering && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Assignment</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assignment 3: Process Synchronization"
                  value={opsNewAssignmentTitle}
                  onChange={(e) => setOpsNewAssignmentTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Instructions &amp; Problem Statement</label>
                <textarea
                  rows={3}
                  required
                  value={opsNewAssignmentInstructions}
                  onChange={(e) => setOpsNewAssignmentInstructions(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  placeholder="Instructions for students..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Due Date &amp; Time (UTC)</label>
                <input
                  type="datetime-local"
                  required
                  value={opsNewAssignmentDueDate}
                  onChange={(e) => setOpsNewAssignmentDueDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Model Answer (Optional)</label>
                <textarea
                  rows={2}
                  value={opsNewAssignmentModelAnswer}
                  onChange={(e) => setOpsNewAssignmentModelAnswer(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  placeholder="Solution concealed until explicitly released."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowOpsNewAssignmentModal(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={isOpsSubmittingAssignment} onClick={handleOpsCreateAssignment}>
                {isOpsSubmittingAssignment ? "Creating..." : "Create &amp; Publish"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL: Grade Assignment Submission */}
      {opsGradingSubmission && activeOpsOffering && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Grade Submission</h3>
            <p className="text-xs text-slate-500">Student: {opsGradingSubmission.student_name}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Score</label>
                <input
                  type="number"
                  step="0.5"
                  value={opsGradeScoreInput}
                  onChange={(e) => setOpsGradeScoreInput(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Feedback</label>
                <textarea
                  rows={2}
                  value={opsGradeFeedbackInput}
                  onChange={(e) => setOpsGradeFeedbackInput(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  placeholder="Constructive feedback for student..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setOpsGradingSubmission(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleOpsGradeSubmission}>
                Save Grade
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
