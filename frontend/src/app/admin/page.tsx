"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  createOffering,
  assignProfessorToOffering,
  fetchUserRoles,
  updateUserRole,
  fetchAcademicAuditLogs,
  fetchSubjects,
} from "../../lib/api";
import {
  SubjectOffering,
  UserRoleItem,
  AcademicAuditLog,
  Subject,
} from "../../types";

export default function AdminConsolePage() {
  const [activeTab, setActiveTab] = useState<"roles" | "offerings" | "audit">("roles");
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Roles State
  const [roles, setRoles] = useState<UserRoleItem[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

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

  useEffect(() => {
    if (activeTab === "roles") loadRoles();
    if (activeTab === "offerings") loadOfferingsAndSubjects();
    if (activeTab === "audit") loadAuditLogs();
  }, [activeTab, loadRoles, loadOfferingsAndSubjects, loadAuditLogs]);

  const handleUpdateRole = async (userId: string, newRole: string, statusVal: string = "active") => {
    try {
      await updateUserRole(userId, newRole, statusVal);
      loadRoles();
      setFeedbackMessage({ type: "success", text: `Updated user ${userId} to ${newRole} (${statusVal}).` });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to update role." });
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
            <Button size="sm" variant="secondary" onClick={loadRoles}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
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
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
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
    </div>
  );
}
