"use client";

import { useState } from "react";
import {
  Sparkles,
  Send,
  BookOpen,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Info,
} from "lucide-react";
import { askCopilot, confirmCopilotTask } from "../../lib/api";
import { Citation, ActionableSuggestion } from "../../types";

interface ChatMessage {
  id: string;
  sender: "user" | "copilot";
  text: string;
  answered?: boolean;
  citations?: Citation[];
  actionable_suggestion?: ActionableSuggestion | null;
  task_confirmed?: boolean;
}

const SAMPLE_PROMPTS = [
  "What is the minimum attendance requirement at Thapar?",
  "When is the Even Semester 2025 fee payment deadline?",
  "What time is hostel curfew and what are the appliance rules?",
  "What are the library borrowing limits and overdue fines?",
  "How do I make sushi at home?", // To verify decline on unsupported question
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m0",
      sender: "copilot",
      text: "Hello Gurasees! I am your Thapar Campus Copilot. I answer questions strictly using approved TIET ordinances, calendars, hostel regulations, and official circulars. Every answer includes verifiable source citations, and I will decline any question outside verified campus policies.",
      answered: true,
      citations: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || input).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await askCopilot(q);
      const botMsg: ChatMessage = {
        id: `c-${Date.now()}`,
        sender: "copilot",
        text: res.answer,
        answered: res.answered,
        citations: res.citations || [],
        actionable_suggestion: res.actionable_suggestion || null,
        task_confirmed: false,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "copilot",
        text: "Error communicating with Campus Copilot server. Please check backend connection.",
        answered: false,
        citations: [],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTask = async (msgId: string, suggestion: ActionableSuggestion) => {
    try {
      await confirmCopilotTask({
        title: suggestion.title,
        due_date: suggestion.due_date,
        priority: suggestion.priority,
        course_code: suggestion.course_code,
      });

      // Mark message as confirmed
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, task_confirmed: true } : m))
      );
    } catch (err) {
      alert("Failed to create task: " + err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Grounded RAG
          </span>
          <span className="text-xs text-slate-400">Strict Source Citation Guarantee</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          Campus Copilot
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Answers strictly from verified TIET ordinances, calendars, hostel regulations, and circulars.
        </p>
      </div>

      {/* RAG Verification Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <p>
          <strong className="text-white">Strict Citation Standard:</strong> The Copilot never answers without retrieved sources. If no relevant clause exists in the official repository, the query is declined.
        </p>
      </div>

      {/* Suggested Prompts */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-400">Try asking about:</span>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[460px] flex flex-col justify-between shadow-xl">
        <div className="space-y-6 overflow-y-auto max-h-[560px] pr-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4.5 text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-red-600 text-white rounded-br-sm shadow-md"
                    : msg.answered === false
                    ? "bg-amber-950/30 border border-amber-800/40 text-amber-200 rounded-bl-sm"
                    : "bg-slate-950 border border-slate-800/80 text-slate-200 rounded-bl-sm"
                }`}
              >
                {/* Header for Bot */}
                {msg.sender === "copilot" && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/80 text-xs">
                    <div className="w-5 h-5 rounded-full bg-red-950 text-red-300 flex items-center justify-center font-bold text-[10px] border border-red-800">
                      TI
                    </div>
                    <span className="font-semibold text-slate-300">TIET Campus Copilot</span>
                    {msg.answered === false ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        Declined (Unsupported)
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Verified Citation
                      </span>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Citations badges */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                      Official Sources &amp; Citations:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {msg.citations.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedCitation(c)}
                          className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-red-300 flex items-center gap-1.5 transition-colors"
                        >
                          <BookOpen className="w-3 h-3 text-red-400" />
                          <span>{c.document_title}</span>
                          <span className="text-slate-500">p.{c.page_number}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable AI Task Suggestion */}
                {msg.actionable_suggestion && msg.actionable_suggestion.has_action && (
                  <div className="mt-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Actionable AI Notice Detected
                      </span>
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200">
                        {msg.actionable_suggestion.priority} Priority
                      </span>
                    </div>

                    <div className="text-slate-200 font-medium">
                      {msg.actionable_suggestion.title}
                    </div>

                    <div className="text-[11px] text-amber-200/80 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        Due: {new Date(msg.actionable_suggestion.due_date).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>{msg.actionable_suggestion.reason}</span>
                    </div>

                    <div className="pt-2 border-t border-amber-800/40 flex items-center justify-between">
                      <span className="text-[10px] text-amber-300/70">
                        *Requires student confirmation before adding to tasks
                      </span>
                      {msg.task_confirmed ? (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Added to Tasks
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            handleConfirmTask(msg.id, msg.actionable_suggestion!)
                          }
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                        >
                          Confirm &amp; Add Task
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-3 bg-slate-950 rounded-xl max-w-xs border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              Retrieving verified campus documents &amp; citations...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="pt-4 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about TIET attendance, hostel curfew, exam makeup, fee dates..."
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-red-600 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium text-sm transition-all shadow-md shadow-red-950 flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
        </div>
      </div>

      {/* CITATION MODAL / VIEWER */}
      {selectedCitation && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-semibold text-red-400">
                  {selectedCitation.source_ref}
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {selectedCitation.document_title}
                </h3>
                <p className="text-xs text-slate-400">{selectedCitation.section_title}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Page {selectedCitation.page_number}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed font-serif">
              &ldquo;{selectedCitation.excerpt}&rdquo;
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Verified against official TIET registrar repository.
              </span>
              <button
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
