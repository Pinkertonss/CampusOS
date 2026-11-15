"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  LifeBuoy,
  HelpCircle,
  Bug,
  MessageSquarePlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Send,
  Loader2,
  Shield,
  FileText,
} from "lucide-react";
import { useSupport } from "../context/SupportContext";
import { useAuth } from "../context/AuthContext";
import {
  getSupportTickets,
  createSupportTicket,
  updateSupportTicket,
  uploadSupportScreenshot,
} from "../lib/api";
import { SupportTicket } from "../types";
import { Badge, Button } from "./ui";

const FAQS = [
  {
    q: "How is my attendance risk calculated?",
    a: "AttendanceEngine computes Safe (>75%), Warning (70-75%), and Critical (<70%) based on your verified lecture attendances. You can use the What-if Simulator on the Academic Hub to test upcoming classes.",
  },
  {
    q: "Why can't I edit my official CGPA in the Experience profile?",
    a: "To ensure academic integrity for faculty and recruiters, your verified institutional CGPA and official grades are governed by the registrar trust boundary and cannot be overwritten manually.",
  },
  {
    q: "How does private claim proof work in Lost & Found?",
    a: "When you claim a lost item, your distinguishing proof (e.g. serial numbers, sticker placements, lockscreen wallpaper description) is stored privately and visible only to the reporter and campus moderators.",
  },
  {
    q: "What is the difference between Campus Guide and Personal Assistant?",
    a: "Campus Guide provides source-grounded answers strictly referenced from official TIET circulars, handbooks, and verified course databases. The Gemini Personal Assistant is a general study and writing companion.",
  },
  {
    q: "Is my Digital Vault data private?",
    a: "Yes. All uploaded marksheets, certificates, and ID proofs are encrypted in private storage buckets isolated strictly by Row Level Security (RLS) policies.",
  },
];

export default function SupportModal() {
  const { isOpen, closeSupport, activeTab, setActiveTab } = useSupport();
  const { user, isAdmin } = useAuth();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ticket form state
  const [category, setCategory] = useState("technical");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // Admin response state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [adminResponseText, setAdminResponseText] = useState("");
  const [adminStatus, setAdminStatus] = useState<"open" | "in_progress" | "resolved" | "closed">("resolved");
  const [adminUpdating, setAdminUpdating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTickets();
      setSubmitSuccess(false);
      setErrorMsg(null);
    }
  }, [isOpen, activeTab]);

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const data = await getSupportTickets();
      setTickets(data);
    } catch {
      // Ignore or empty
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setScreenshotFile(f);
      const url = URL.createObjectURL(f);
      setScreenshotPreview(url);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setErrorMsg("Please fill in both the subject and description.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      let uploadedScreenshotUrl: string | undefined = undefined;

      // 1. Upload screenshot if selected
      if (screenshotFile) {
        const uploadRes = await uploadSupportScreenshot(screenshotFile);
        uploadedScreenshotUrl = uploadRes.screenshot_url;
      }

      // 2. Create support ticket
      await createSupportTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        screenshot_url: uploadedScreenshotUrl,
      });

      setSubmitSuccess(true);
      setSubject("");
      setDescription("");
      setScreenshotFile(null);
      setScreenshotPreview(null);

      // Reload tickets and switch to tickets tab after a short pause
      setTimeout(() => {
        loadTickets();
        setActiveTab("tickets");
        setSubmitSuccess(false);
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit support request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminUpdate = async (ticketId: string) => {
    if (!adminResponseText.trim()) {
      setErrorMsg("Response notes cannot be empty.");
      return;
    }

    setAdminUpdating(true);
    setErrorMsg(null);

    try {
      await updateSupportTicket(ticketId, {
        status: adminStatus,
        admin_response: adminResponseText.trim(),
      });
      setSelectedTicketId(null);
      setAdminResponseText("");
      await loadTickets();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update ticket.");
    } finally {
      setAdminUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[var(--surface-card)] border border-[var(--border-color)] rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--surface-secondary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--action-primary)] text-[var(--action-primary-text)] flex items-center justify-center shadow-xs">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                Help & Student Support
                {isAdmin && (
                  <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                    Admin Mode
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Quick answers, assistance requests, and tracking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSupport}
            aria-label="Close support dialog"
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[var(--border-color)] px-6 bg-[var(--surface-card)] text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("help")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === "help"
                ? "border-[var(--action-primary)] text-[var(--text-primary)] font-bold"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Quick Help & FAQs
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("bug");
              setCategory("technical");
            }}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === "bug"
                ? "border-[var(--action-primary)] text-[var(--text-primary)] font-bold"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Bug className="w-4 h-4" />
            Report a Bug
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("request");
              setCategory("academic");
            }}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === "request"
                ? "border-[var(--action-primary)] text-[var(--text-primary)] font-bold"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <MessageSquarePlus className="w-4 h-4" />
            Request Assistance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === "tickets"
                ? "border-[var(--action-primary)] text-[var(--text-primary)] font-bold"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Clock className="w-4 h-4" />
            {isAdmin ? "All Tickets" : "My Tickets"}
            {tickets.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                {tickets.length}
              </span>
            )}
          </button>
        </div>

        {/* Content area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-[var(--page-bg)]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: QUICK HELP & FAQS */}
          {activeTab === "help" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-[var(--action-primary)] shrink-0 mt-0.5" />
                <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  <span className="font-semibold text-[var(--text-primary)]">Need immediate answers?</span>{" "}
                  You can ask our source-grounded <span className="font-semibold text-[var(--text-primary)]">Campus Guide</span> for official circular citations or open the floating <span className="font-semibold text-[var(--text-primary)]">Personal Assistant</span> for study concept breakdowns.
                </div>
              </div>

              <div className="space-y-3">
                {FAQS.map((faq, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] shadow-xs"
                  >
                    <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[var(--surface-secondary)] text-[var(--text-secondary)] text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {faq.q}
                    </h3>
                    <p className="mt-2 text-xs text-[var(--text-secondary)] pl-7 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2 & 3: REPORT A BUG / REQUEST ASSISTANCE */}
          {(activeTab === "bug" || activeTab === "request") && (
            <form onSubmit={handleSubmitTicket} className="space-y-4">
              {submitSuccess ? (
                <div className="p-6 text-center space-y-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Ticket Submitted Successfully!
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Your request has been filed. Moving you to My Tickets...
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                      >
                        <option value="technical">Technical / Platform Issue</option>
                        <option value="academic">Academic & Attendance Question</option>
                        <option value="lost_found">Lost & Found Assistance</option>
                        <option value="opportunities">Opportunities & Applications</option>
                        <option value="general">General Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                        Urgency / Priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                      >
                        <option value="low">Low (General question)</option>
                        <option value="medium">Medium (Needs assistance soon)</option>
                        <option value="high">High (Affecting coursework)</option>
                        <option value="urgent">Urgent (System blockage)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      placeholder="Brief summary of your question or issue"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      Detailed Description
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Provide specific details, steps to reproduce, or context..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      Screenshot (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-semibold hover:bg-[var(--surface-secondary)] transition">
                        <Upload className="w-4 h-4 text-[var(--action-primary)]" />
                        Choose Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          className="hidden"
                        />
                      </label>
                      {screenshotFile && (
                        <span className="text-xs text-[var(--text-secondary)] truncate max-w-xs">
                          {screenshotFile.name}
                        </span>
                      )}
                    </div>

                    {screenshotPreview && (
                      <div className="mt-3 relative w-32 h-24 rounded-lg overflow-hidden border border-[var(--border-color)]">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotFile(null);
                            setScreenshotPreview(null);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-white hover:bg-slate-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={closeSupport}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={submitting}
                      loadingText="Submitting..."
                      leftIcon={<Send className="w-4 h-4" />}
                    >
                      Submit Ticket
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* TAB 4: MY TICKETS / ALL TICKETS (ADMIN) */}
          {activeTab === "tickets" && (
            <div className="space-y-4">
              {loadingTickets ? (
                <div className="py-12 flex flex-col items-center justify-center text-[var(--text-muted)] text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-[var(--action-primary)]" />
                  Loading tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center text-[var(--text-secondary)] text-xs">
                  No support tickets found. Use &apos;Report a Bug&apos; or &apos;Request Assistance&apos; to submit one.
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-[var(--text-primary)]">
                              {t.subject}
                            </h4>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                t.status === "resolved"
                                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                  : t.status === "in_progress"
                                  ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                  : "bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-badge-border)]"
                              }`}
                            >
                              {t.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            ID: {t.id.slice(0, 8)} · Category: {t.category} · Priority: {t.priority} · {new Date(t.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTicketId(selectedTicketId === t.id ? null : t.id);
                              setAdminResponseText(t.admin_response || "");
                              setAdminStatus(t.status as any);
                            }}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--nav-selected-bg)] cursor-pointer"
                          >
                            {selectedTicketId === t.id ? "Close Form" : "Respond / Update"}
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {t.description}
                      </p>

                      {t.screenshot_url && (
                        <div className="pt-1">
                          <a
                            href={t.screenshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] text-[var(--action-primary)] font-semibold hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Attached Screenshot
                          </a>
                        </div>
                      )}

                      {/* Admin Response block */}
                      {t.admin_response && (
                        <div className="mt-3 p-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs">
                          <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-[var(--action-primary)]" />
                            Official Support Response ({t.responded_at ? new Date(t.responded_at).toLocaleDateString() : "Reviewed"})
                          </div>
                          <p className="mt-1 text-[var(--text-secondary)]">
                            {t.admin_response}
                          </p>
                        </div>
                      )}

                      {/* Admin edit panel */}
                      {isAdmin && selectedTicketId === t.id && (
                        <div className="mt-3 p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] space-y-3">
                          <h5 className="text-xs font-bold text-[var(--text-primary)]">
                            Administrator Resolution Controls
                          </h5>
                          <div className="flex gap-2">
                            <select
                              value={adminStatus}
                              onChange={(e) => setAdminStatus(e.target.value as any)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--text-primary)]"
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                          <textarea
                            rows={3}
                            placeholder="Write an official response or resolution notes to student..."
                            value={adminResponseText}
                            onChange={(e) => setAdminResponseText(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedTicketId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={adminUpdating}
                              onClick={() => handleAdminUpdate(t.id)}
                            >
                              {adminUpdating ? "Saving..." : "Save Response"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
