"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  BookOpen,
  Send,
  ShieldAlert,
  Calendar,
  Clock,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  FileText,
  Upload,
  Trash2,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Search,
  Check,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  Modal,
} from "../../components/ui";
import {
  Citation,
  ActionableSuggestion,
  CopilotQueryResponse,
  CampusDocument,
} from "../../types";
import {
  askCopilotStream,
  askCopilot,
  confirmCopilotTask,
  getCampusDocuments,
  uploadCampusDocument,
  deleteCampusDocument,
} from "../../lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "copilot";
  text: string;
  citations?: Citation[];
  grounded?: boolean;
  isDeclined?: boolean;
  confidence?: number;
  actionableSuggestion?: ActionableSuggestion | null;
  taskConfirmed?: boolean;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  "What is the minimum attendance requirement to appear in exams?",
  "What time is the hostel curfew and turnstile entry?",
  "When is the last date to pay tuition fees for even semester?",
  "What is the penalty if my attendance is below 65%?",
  "Can I apply for a minor degree in AI/ML?",
  "What are the library operating hours during exam periods?",
];

let msgSequenceCounter = 0;
function createUniqueMsgId(prefix: string): string {
  msgSequenceCounter += 1;
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${Date.now()}-${msgSequenceCounter}-${rand}`;
}

export default function CampusCopilotPage() {
  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<"chat" | "admin">("chat");

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [streamingConfidence, setStreamingConfidence] = useState<number>(0);
  const [streamingDeclined, setStreamingDeclined] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Source Inspector Drawer State
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  // Admin Document Management State
  const [documents, setDocuments] = useState<CampusDocument[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("circular");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [docToDelete, setDocToDelete] = useState<CampusDocument | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Load documents when opening admin tab
  useEffect(() => {
    if (activeTab === "admin") {
      fetchDocuments();
    }
  }, [activeTab]);

  const fetchDocuments = async () => {
    setDocLoading(true);
    try {
      const docs = await getCampusDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load campus documents:", err);
    } finally {
      setDocLoading(false);
    }
  };

  // Submit Query to Copilot with Streaming
  const handleSendMessage = async (queryText?: string) => {
    const q = (queryText || inputValue).trim();
    if (!q || isLoading) return;

    setInputValue("");
    const userMsgId = createUniqueMsgId("msg-user");
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: "user",
        text: q,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
    setMessages(newMessages);

    setIsLoading(true);
    setStreamingText("");
    setStreamingCitations([]);
    setStreamingConfidence(0);
    setStreamingDeclined(false);

    let accumulatedText = "";
    let capturedCitations: Citation[] = [];
    let wasDeclined = false;
    let isFinished = false;

    try {
      await askCopilotStream(q, {
        onToken: (token) => {
          accumulatedText += token;
          setStreamingText(accumulatedText);
        },
        onCitations: (cits) => {
          capturedCitations = cits;
          setStreamingCitations(cits);
        },
        onRefusal: (refusalMsg) => {
          wasDeclined = true;
          setStreamingDeclined(true);
          accumulatedText = refusalMsg;
          setStreamingText(refusalMsg);
        },
        onDone: () => {
          if (isFinished) return;
          isFinished = true;
          const copilotMsgId = createUniqueMsgId("msg-copilot");
          setMessages((prev) => [
            ...prev,
            {
              id: copilotMsgId,
              sender: "copilot",
              text: accumulatedText || "I couldn't find this in the approved campus documents.",
              citations: capturedCitations,
              grounded: !wasDeclined && capturedCitations.length > 0,
              isDeclined: wasDeclined,
              confidence: wasDeclined ? 0.0 : 0.88,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setStreamingText("");
          setStreamingCitations([]);
          setIsLoading(false);
        },
      });
    } catch (err) {
      console.error("Query failed:", err);
      if (isFinished) return;
      isFinished = true;
      // Fallback query
      try {
        const fallback = await askCopilot(q);
        setMessages((prev) => [
          ...prev,
          {
            id: createUniqueMsgId("msg-copilot"),
            sender: "copilot",
            text: fallback.answer,
            citations: fallback.citations,
            grounded: fallback.grounded ?? fallback.answered,
            isDeclined: !fallback.answered,
            confidence: fallback.confidence,
            actionableSuggestion: fallback.actionable_suggestion,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } catch (e2) {
        setMessages((prev) => [
          ...prev,
          {
            id: createUniqueMsgId("msg-copilot"),
            sender: "copilot",
            text: "Error reaching Campus Copilot. Please verify that backend is running.",
            isDeclined: true,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } finally {
        setStreamingText("");
        setIsLoading(false);
      }
    }
  };

  // Confirm Actionable Task
  const handleConfirmTask = async (msgId: string, suggestion: ActionableSuggestion) => {
    try {
      await confirmCopilotTask({
        title: suggestion.title,
        due_date: suggestion.due_date,
        priority: suggestion.priority,
        course_code: suggestion.course_code,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, taskConfirmed: true } : m))
      );
    } catch (e) {
      console.error("Failed to confirm task:", e);
    }
  };

  // Upload Admin Document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadTitle.trim()) {
      setUploadFeedback({ type: "error", text: "Please provide both a document title and file." });
      return;
    }

    setIsUploading(true);
    setUploadFeedback(null);

    try {
      const res = await uploadCampusDocument(selectedFile, uploadTitle.trim(), uploadCategory);
      setUploadFeedback({
        type: "success",
        text: `Successfully ingested "${uploadTitle}" into ${res.chunks_created} vector chunks!`,
      });
      setUploadTitle("");
      setSelectedFile(null);
      fetchDocuments();
    } catch (err: any) {
      setUploadFeedback({
        type: "error",
        text: err?.message || "Failed to process and index document.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    try {
      await deleteCampusDocument(docToDelete.id);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setDocToDelete(null);
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              Campus Copilot
            </h1>
            <Badge variant="primary" size="md">
              Source-Grounded RAG
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Strict factual Q&amp;A over approved Thapar Institute academic regulations, calendars, and hostel notices.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition ${
              activeTab === "chat"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Assistant Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
              activeTab === "admin"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Manage Documents (Admin)
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: ASSISTANT CHAT UI */}
      {/* ============================================================ */}
      {activeTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* Main Chat Area */}
          <div className={`${selectedCitation ? "lg:col-span-2" : "lg:col-span-3"} space-y-4 transition-all duration-300`}>
            <Card className="min-h-[550px] flex flex-col justify-between border-slate-200 dark:border-slate-800 shadow-sm">
              {/* Chat Messages Log */}
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[580px]">
                {messages.length === 0 && !streamingText && (
                  <div className="py-8">
                    <EmptyState
                      icon={<BookOpen className="w-10 h-10 text-teal-600 dark:text-teal-400" />}
                      title="Strict Campus Knowledge Assistant"
                      description="Ask about attendance cutoffs, detention rules, hostel curfews, exam schedules, or fee deadlines. Answers strictly cite approved campus documents."
                    />

                    {/* Starter Questions */}
                    <div className="mt-8 space-y-2.5 max-w-2xl mx-auto">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block text-center">
                        Suggested Starter Inquiries
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {SAMPLE_QUESTIONS.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(q)}
                            className="text-left text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 transition line-clamp-2 hover:border-teal-300 dark:hover:border-teal-700"
                          >
                            <span className="font-medium text-teal-700 dark:text-teal-400 mr-1.5">Q:</span>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rendered Messages */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 text-sm ${
                        msg.sender === "user"
                          ? "bg-teal-600 text-white rounded-br-sm"
                          : msg.isDeclined
                          ? "bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-slate-900 dark:text-slate-100 rounded-bl-sm"
                          : "bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/70 rounded-bl-sm shadow-xs"
                      }`}
                    >
                      {/* Declined State Header */}
                      {msg.sender === "copilot" && msg.isDeclined && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 font-semibold text-xs">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>Question Declined (Out of Approved Domain)</span>
                        </div>
                      )}

                      {/* Message Body */}
                      <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>

                      {/* Source Citation Chips */}
                      {msg.sender === "copilot" && msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-teal-600" />
                            Authoritative Sources Cited:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.citations.map((cit, cIdx) => (
                              <button
                                key={cIdx}
                                type="button"
                                onClick={() => setSelectedCitation(cit)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition shadow-2xs font-medium cursor-pointer"
                              >
                                <span className="bg-teal-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                                  {cIdx + 1}
                                </span>
                                <span className="truncate max-w-[160px]">{cit.document_title}</span>
                                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">
                                  ({cit.page_ref || `Page ${cit.page_number || 1}`})
                                </span>
                                {cit.is_archived && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-semibold">
                                    Archived Notice
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actionable Suggestion Card */}
                      {msg.actionableSuggestion && msg.actionableSuggestion.has_action && (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Actionable Campus Notice Detected</span>
                            </div>
                            <Badge variant={msg.actionableSuggestion.priority === "high" ? "danger" : "warning"} size="sm">
                              {msg.actionableSuggestion.priority.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                            {msg.actionableSuggestion.title}
                          </div>
                          {msg.actionableSuggestion.reason && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                              {msg.actionableSuggestion.reason}
                            </p>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span>Deadline: {new Date(msg.actionableSuggestion.due_date).toLocaleDateString()}</span>
                            {msg.actionableSuggestion.course_code && (
                              <span className="font-mono text-[10px]">{msg.actionableSuggestion.course_code}</span>
                            )}
                          </div>
                          {msg.taskConfirmed ? (
                            <Badge variant="success" size="sm" className="mt-1">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Added to Tasks
                            </Badge>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full text-xs mt-1"
                              onClick={() => handleConfirmTask(msg.id, msg.actionableSuggestion!)}
                            >
                              Add to Academic Deadlines
                            </Button>
                          )}
                        </div>
                      )}

                      <div className="mt-1.5 text-[10px] text-right opacity-70">
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Real-time Streaming Response Card */}
                {isLoading && (
                  <div className="flex flex-col items-start">
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm p-4 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-xs">
                      {streamingDeclined && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-rose-200 text-rose-700 font-semibold text-xs">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>Question Declined</span>
                        </div>
                      )}

                      <div className="whitespace-pre-line leading-relaxed">
                        {streamingText}
                        <span className="inline-block w-1.5 h-4 ml-1 bg-teal-600 dark:bg-teal-400 animate-pulse align-middle" />
                      </div>

                      {streamingCitations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase">
                            Sources Identified:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {streamingCitations.map((c, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-medium"
                              >
                                [{i + 1}] {c.document_title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 rounded-b-xl">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask a question about Thapar academic policies, curfews, or fees..."
                    disabled={isLoading}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white placeholder-slate-400 disabled:opacity-60"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading || !inputValue.trim()}
                    className="shrink-0"
                    leftIcon={<Send className="w-4 h-4" />}
                  >
                    Ask
                  </Button>
                </form>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <span>Zero guessing policy: answers strictly cite approved campus documents.</span>
                  <span className="text-teal-600 dark:text-teal-400 font-medium">Citation-Grounded Verified Search · 768-dim Embeddings</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Source Inspector Side Panel (Slides open when citation clicked) */}
          {selectedCitation && (
            <div className="lg:col-span-1 space-y-4">
              <Card className="h-full border-teal-200 dark:border-teal-900 shadow-md flex flex-col justify-between">
                <div>
                  <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <CardTitle className="text-sm font-semibold">Source Inspector</CardTitle>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCitation(null)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                        Document Title
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {selectedCitation.document_title}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="primary" size="sm">
                        {selectedCitation.page_ref || `Page ${selectedCitation.page_number || 1}`}
                      </Badge>
                      {selectedCitation.review_status && (
                        <Badge variant={selectedCitation.is_archived ? "warning" : "success"} size="sm">
                          {selectedCitation.is_archived ? "Archived Circular" : "Standing Policy"}
                        </Badge>
                      )}
                      {selectedCitation.effective_date && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Effective: {selectedCitation.effective_date}
                        </span>
                      )}
                    </div>

                    {selectedCitation.issuing_body && (
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Issuing Body: </span>
                        {selectedCitation.issuing_body}
                      </div>
                    )}

                    {selectedCitation.official_reference && (
                      <div className="text-[11px] font-mono text-slate-500">
                        Ref: {selectedCitation.official_reference}
                      </div>
                    )}

                    {selectedCitation.section_title && (
                      <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                        {selectedCitation.section_title}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                        Exact Retrieved Chunk Excerpt
                      </span>
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono whitespace-pre-line max-h-[320px] overflow-y-auto">
                        {selectedCitation.snippet || selectedCitation.excerpt}
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="border-t border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/40 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedCitation(null)}
                  >
                    Close Inspector
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: ADMIN DOCUMENT MANAGEMENT UI */}
      {/* ============================================================ */}
      {activeTab === "admin" && (
        <div className="space-y-6">
          {/* Upload Form Card */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <CardTitle className="text-lg">Ingest Approved Campus Document</CardTitle>
              </div>
              <CardDescription>
                Upload official PDF, DOCX, or TXT documents. Files will be extracted per-page, partitioned into ~500 token chunks (~80 overlap), embedded via 768-dim vector model, and stored in pgvector.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleUploadDocument} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Document Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Document Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TIET Hostel Rules Winter 2024"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none dark:text-white"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Source Category
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none dark:text-white"
                    >
                      <option value="circular">General Campus Circular</option>
                      <option value="academic_ordinance">Academic Regulations &amp; Ordinance</option>
                      <option value="exam_rules">Examination &amp; Makeup Rules</option>
                      <option value="hostel_rules">Hostel Code of Conduct</option>
                      <option value="calendar">Official Academic Calendar</option>
                      <option value="fee_notice">Fee &amp; Registration Notice</option>
                    </select>
                  </div>
                </div>

                {/* File Drop Area */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Document File (.pdf, .docx, .txt) *
                  </label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 rounded-xl p-6 text-center transition bg-slate-50/50 dark:bg-slate-900/30">
                    <input
                      type="file"
                      id="doc-upload"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center">
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {selectedFile ? selectedFile.name : "Click to select a document file"}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        Max 25 MB • PDF with page structure, Word (.docx), or plain text (.txt)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Feedback Alerts */}
                {uploadFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      uploadFeedback.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    }`}
                  >
                    {uploadFeedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{uploadFeedback.text}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isUploading || !selectedFile || !uploadTitle.trim()}
                    leftIcon={<Upload className="w-4 h-4" />}
                  >
                    {isUploading ? "Extracting & Embedding..." : "Ingest Document"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* List of Ingested Documents */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Approved Corpus Documents</CardTitle>
                <CardDescription>
                  {documents.length} official documents indexed in vector database.
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchDocuments}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Refresh
              </Button>
            </CardHeader>

            <CardContent>
              {docLoading ? (
                <div className="space-y-3">
                  <Skeleton variant="card" />
                  <Skeleton variant="text" lines={3} />
                </div>
              ) : documents.length === 0 ? (
                <EmptyState
                  icon={<FileText className="w-8 h-8 text-slate-400" />}
                  title="No Documents Found"
                  description="Upload campus notices above to populate the vector search index."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3">Document Title</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Vector Chunks</th>
                        <th className="p-3">Approval</th>
                        <th className="p-3">Indexed Date</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-medium text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                              <span className="truncate max-w-[260px]">{doc.title}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="default" size="sm">
                              {doc.source_label}
                            </Badge>
                          </td>
                          <td className="p-3 font-semibold text-teal-700 dark:text-teal-400">
                            {doc.chunk_count} chunks
                          </td>
                          <td className="p-3">
                            <Badge variant="success" size="sm">
                              Approved
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-500">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => setDocToDelete(doc)}
                              className="text-rose-600 hover:text-rose-800 dark:hover:text-rose-400 p-1 rounded transition"
                              title="Delete document and vector chunks"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setDocToDelete(null)}
          title="Delete Approved Document"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>{docToDelete.title}</strong>? All {docToDelete.chunk_count} vector chunks will be purged immediately from pgvector.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setDocToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeleteDocument}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
