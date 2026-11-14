"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  X,
  Send,
  Loader2,
  Trash2,
  Minimize2,
  Maximize2,
  Sparkles,
  Calculator,
  AlertCircle,
  HelpCircle,
  GraduationCap,
} from "lucide-react";
import { chatWithPersonalAssistant, calculateWithPersonalAssistant } from "../lib/api";
import { Badge } from "./ui";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isCalculation?: boolean;
}

export default function PersonalAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init-1",
      role: "assistant",
      content:
        "Hello! I am your AI Study & Drafting Assistant powered by Gemini. I can help explain engineering concepts, review notes, solve calculations, or draft emails.\n\n*Note: For official Thapar attendance rules, circulars, and course policies, please consult the Campus Guide.*",
      timestamp: "Just now",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    setErrorMsg(null);
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Check if user is asking for math calculation e.g. "calc: 25 * 14" or "eval: (85 * 3 + 92 * 4) / 7"
      if (query.toLowerCase().startsWith("calc:") || query.toLowerCase().startsWith("compute:")) {
        const expr = query.split(":")[1]?.trim() || "";
        const calcRes = await calculateWithPersonalAssistant(expr);
        const calcMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `**Calculation Result (Safe AST)**:\n\`${calcRes.expression}\` = **${calcRes.result}**`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isCalculation: true,
        };
        setMessages((prev) => [...prev, calcMsg]);
      } else {
        // Normal conversation with Gemini
        const history = messages
          .filter((m) => m.id !== "init-1")
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await chatWithPersonalAssistant(query, history);
        const replyMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, replyMsg]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reach personal assistant.");
      const errorReply: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I ran into an error: ${err.message || "Service unavailable"}. Please try again in a moment.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "init-1",
        role: "assistant",
        content:
          "Chat cleared. How can I assist with your studies or coursework today?",
        timestamp: "Just now",
      },
    ]);
    setErrorMsg(null);
  };

  return (
    <>
      {/* Floating launcher trigger */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          aria-label="Open Personal Assistant"
          className="fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-gradient-to-tr from-teal-600 via-teal-500 to-sky-500 text-white shadow-xl shadow-teal-950/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center group focus:outline-none focus:ring-4 focus:ring-teal-500/30"
        >
          <Bot className="w-6 h-6 animate-pulse" />
          <span className="sr-only">Personal Assistant</span>
          {/* Subtle indicator dot */}
          <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full" />
        </button>
      )}

      {/* Assistant Chat Panel */}
      {isOpen && (
        <div
          className={`fixed right-4 sm:right-6 bottom-4 sm:bottom-6 z-50 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isMinimized ? "h-14" : "h-[540px] max-h-[85vh]"
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-teal-600 via-teal-700 to-sky-700 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <span>Personal Assistant</span>
                  <Badge variant="primary" size="sm" className="bg-teal-400/20 text-teal-100 text-[9px] px-1 py-0">
                    Gemini
                  </Badge>
                </div>
                <p className="text-[10px] text-teal-100/80">Study & Concept Companion</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearHistory}
                title="Clear conversation"
                className="p-1.5 rounded-lg text-teal-100/70 hover:text-white hover:bg-white/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Maximize" : "Minimize"}
                className="p-1.5 rounded-lg text-teal-100/70 hover:text-white hover:bg-white/10 transition"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 rounded-lg text-teal-100/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Trust Boundary Notice */}
              <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-800/40 text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5 shrink-0">
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span>
                  Study companion only. Use <strong>Campus Guide</strong> for official campus rules.
                </span>
              </div>

              {/* Messages list */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-slate-50/50 dark:bg-slate-950/50">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                        m.role === "user"
                          ? "bg-teal-600 text-white rounded-br-sm"
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 px-1">
                      {m.timestamp}
                    </span>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    <span>Gemini is thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested quick pills */}
              <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5 overflow-x-auto text-[10px]">
                <button
                  type="button"
                  onClick={() => setInput("Explain Dijkstra's algorithm simply")}
                  className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 transition"
                >
                  💡 Dijkstra&apos;s algorithm
                </button>
                <button
                  type="button"
                  onClick={() => setInput("calc: (8.4 * 20 + 9.0 * 22) / 42")}
                  className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 transition"
                >
                  🧮 Safe GPA Math
                </button>
                <button
                  type="button"
                  onClick={() => setInput("Draft an email requesting a deadline extension")}
                  className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 transition"
                >
                  ✉️ Draft Email
                </button>
              </div>

              {/* Input bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask a question or type calc: 25 * 4..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                  className="p-2 rounded-xl bg-teal-600 text-white disabled:opacity-50 hover:bg-teal-700 transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
