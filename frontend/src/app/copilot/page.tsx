"use client";

import React, { useState } from "react";
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
} from "../../components/ui";

const SAMPLE_QUESTIONS = [
  "What is the minimum attendance required before detention?",
  "What are the hostel curfew timings for boys and girls?",
  "What is the last date to apply for minor degree registration?",
  "Can I condone my attendance shortage with a medical certificate?",
];

export default function CopilotPlaceholderPage() {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Campus Copilot
            </h1>
            <Badge variant="primary" size="md">
              pgvector RAG
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Grounded Q&amp;A over approved Thapar Institute notices, calendars, and circulars.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowSkeleton(!showSkeleton)}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          {showSkeleton ? "Show UI" : "Toggle Loading Skeleton"}
        </Button>
      </div>

      {showSkeleton ? (
        <div className="space-y-4">
          <Skeleton variant="card" />
          <Skeleton variant="text" lines={5} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chat/Search Card */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="min-h-[460px] flex flex-col justify-between p-6">
              {/* Empty Chat State */}
              <EmptyState
                icon={<Sparkles className="w-10 h-10 text-teal-600 dark:text-teal-400" />}
                title="Strict Grounded Campus Assistant"
                description="Ask anything about TIET campus regulations. Answers are strictly synthesized from approved notices with citations. Unsupported questions are politely declined."
              />

              {/* Sample Prompts */}
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Suggested Questions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInputValue(q)}
                      className="text-left text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 transition line-clamp-1"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Area */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question about Thapar policies..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <Button
                  variant="primary"
                  rightIcon={<Send className="w-4 h-4" />}
                  className="bg-teal-600 hover:bg-teal-500 shrink-0"
                >
                  Ask
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Grounded Corpus Information */}
          <div className="space-y-6">
            <Card
              header={
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal-500" />
                  <span>Approved Campus Corpus</span>
                </CardTitle>
              }
            >
              <div className="space-y-3 text-xs">
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Only documents signed by Institute authorities are indexed in the
                  vector database:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Academic Calendar 2024-25
                    </span>
                    <Badge variant="success" size="sm">
                      Approved
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Attendance &amp; Detention Policy
                    </span>
                    <Badge variant="success" size="sm">
                      Approved
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Hostel Rules 2024
                    </span>
                    <Badge variant="success" size="sm">
                      Approved
                    </Badge>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span>Actionable AI creates tasks only upon explicit student confirmation.</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
