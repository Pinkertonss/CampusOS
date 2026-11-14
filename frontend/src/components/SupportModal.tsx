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
      setScreenshotPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setErrorMsg("Please provide both a subject and detailed description.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      let screenshotUrl: string | undefined = undefined;
      if (screenshotFile) {
        const uploadRes = await uploadSupportScreenshot(screenshotFile);
        screenshotUrl = uploadRes.screenshot_url;
      }

      await createSupportTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        screenshot_url: screenshotUrl,
      });

      setSubmitSuccess(true);
      setSubject("");
      setDescription("");
      setScreenshotFile(null);
      setScreenshotPreview(null);
      await loadTickets();
      setTimeout(() => {
        setActiveTab("tickets");
        setSubmitSuccess(false);
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create support ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminUpdate = async (ticketId: string) => {
    if (!adminResponseText.trim() && adminStatus === "resolved") {
      setErrorMsg("Please provide a brief resolution note.");
      return;
    }
    setAdminUpdating(true);
    setErrorMsg(null);
    try {
      await updateSupportTicket(ticketId, {
        status: adminStatus,
        admin_response: adminResponseText.trim() || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Help & Student Support
                {isAdmin && (
                  <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                    Admin Mode
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quick answers, assistance requests, and tracking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSupport}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50 dark:bg-slate-900/40 text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("help")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === "help"
                ? "border-teal-500 text-teal-600 dark:text-teal-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
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
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === "bug"
                ? "border-teal-500 text-teal-600 dark:text-teal-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
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
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === "request"
                ? "border-teal-500 text-teal-600 dark:text-teal-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <MessageSquarePlus className="w-4 h-4" />
            Request Assistance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === "tickets"
                ? "border-teal-500 text-teal-600 dark:text-teal-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            {isAdmin ? "All Tickets" : "My Tickets"}
            {tickets.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {tickets.length}
              </span>
            )}
          </button>
        </div>

        {/* Content area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: QUICK HELP & FAQS */}
          {activeTab === "help" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-900 dark:text-white">Need immediate answers?</span>{" "}
                  You can ask our source-grounded <span className="font-semibold text-teal-600 dark:text-teal-400">Campus Guide</span> for official circular citations or open the floating <span className="font-semibold text-teal-600 dark:text-teal-400">Personal Assistant</span> for study concept breakdowns.
                </div>
              </div>

              <div className="space-y-3">
                {FAQS.map((faq, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm"
                  >
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {faq.q}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
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
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="technical">Technical / Platform Issue</option>
                        <option value="academic">Academic & Attendance Question</option>
                        <option value="lost_found">Lost & Found Assistance</option>
                        <option value="opportunities">Opportunities & Applications</option>
                        <option value="general">General Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Urgency / Priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="low">Low (General question)</option>
                        <option value="medium">Medium (Standard request)</option>
                        <option value="high">High (Impacting coursework)</option>
                        <option value="urgent">Urgent (System blockage)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      placeholder="Brief summary of your question or issue"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Detailed Description
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Provide specific details, steps to reproduce, or context..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Screenshot (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 transition">
                        <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        Choose Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          className="hidden"
                        />
                      </label>
                      {screenshotFile && (
                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs">
                          {screenshotFile.name}
                        </span>
                      )}
                    </div>
                    {screenshotPreview && (
                      <div className="mt-2 relative w-36 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={submitting}
                      className="flex items-center gap-2 text-xs"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Ticket
                        </>
                      )}
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
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-teal-600" />
                  Loading tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                  No support tickets found. Use &apos;Report a Bug&apos; or &apos;Request Assistance&apos; to submit one.
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {t.subject}
                            </h4>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                t.status === "resolved"
                                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                  : t.status === "in_progress"
                                  ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                                  : "bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300"
                              }`}
                            >
                              {t.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
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
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                          >
                            {selectedTicketId === t.id ? "Close Form" : "Respond / Update"}
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {t.description}
                      </p>

                      {t.screenshot_url && (
                        <div className="pt-1">
                          <a
                            href={t.screenshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Attached Screenshot
                          </a>
                        </div>
                      )}

                      {/* Admin Response block */}
                      {t.admin_response && (
                        <div className="mt-3 p-3 rounded-lg bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 text-xs">
                          <div className="font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5" />
                            Official Support Response ({t.responded_at ? new Date(t.responded_at).toLocaleDateString() : "Reviewed"})
                          </div>
                          <p className="mt-1 text-slate-700 dark:text-slate-300">
                            {t.admin_response}
                          </p>
                        </div>
                      )}

                      {/* Admin edit panel */}
                      {isAdmin && selectedTicketId === t.id && (
                        <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                            Administrator Resolution Controls
                          </h5>
                          <div className="flex gap-2">
                            <select
                              value={adminStatus}
                              onChange={(e) => setAdminStatus(e.target.value as any)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
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
                            className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
