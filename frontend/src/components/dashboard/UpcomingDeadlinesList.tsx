"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { DeadlineTask } from "../../types";
import { Card, Badge, Button, EmptyState, useToast } from "../ui";
import { toggleDeadline } from "../../lib/api";

interface UpcomingDeadlinesListProps {
  deadlines: DeadlineTask[];
  onDeadlineToggled?: () => void;
  onAddTask?: () => void;
}

export default function UpcomingDeadlinesList({
  deadlines,
  onDeadlineToggled,
  onAddTask,
}: UpcomingDeadlinesListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleToggle = async (task: DeadlineTask) => {
    setTogglingId(task.id);
    try {
      await toggleDeadline(task.id);
      const newStatus = task.status === "pending" ? "completed" : "pending";
      toast.success(
        newStatus === "completed" ? "Task marked completed" : "Task re-opened",
        { description: task.title }
      );
      if (onDeadlineToggled) onDeadlineToggled();
    } catch {
      toast.error("Failed to update task status");
    } finally {
      setTogglingId(null);
    }
  };

  const pendingDeadlines = deadlines.filter((d) => d.status === "pending");
  const completedDeadlines = deadlines.filter((d) => d.status === "completed");

  return (
    <Card className="p-5 sm:p-6 border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            Upcoming Deadlines
            {pendingDeadlines.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--action-primary)] font-mono">
                {pendingDeadlines.length}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Midterm papers, lab reports, and campus registration deadlines
          </p>
        </div>

        {onAddTask && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onAddTask}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Task
          </Button>
        )}
      </div>

      {deadlines.length === 0 ? (
        <EmptyState
          compact
          icon={<Calendar className="w-8 h-8 text-[var(--action-primary)]" />}
          title="No deadlines listed"
          description="Add coursework submissions or exam dates to keep your action plan updated."
        />
      ) : (
        <div className="space-y-2.5">
          {deadlines.map((task) => {
            const isCompleted = task.status === "completed";
            const isUrgent = task.priority === "high";

            return (
              <div
                key={task.id}
                className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                  isCompleted
                    ? "bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/40 opacity-60"
                    : "bg-slate-50 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={togglingId === task.id}
                    onClick={() => handleToggle(task)}
                    className="mt-0.5 text-slate-400 hover:text-[var(--action-primary)] dark:hover:text-[var(--action-primary)] transition cursor-pointer shrink-0"
                    aria-label={isCompleted ? "Mark pending" : "Mark completed"}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-[var(--action-primary)]" />
                    ) : (
                      <Circle className="w-5 h-5 hover:text-[var(--action-primary)]" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {task.course_code && (
                        <span className="font-mono text-[11px] font-bold text-[var(--action-primary)]">
                          {task.course_code}
                        </span>
                      )}
                      <h4
                        className={`text-sm font-medium text-[var(--text-primary)] leading-snug ${
                          isCompleted ? "line-through text-slate-400 dark:text-slate-500" : ""
                        }`}
                      >
                        {task.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Due: {task.due_date.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>

                <Badge
                  variant={isCompleted ? "default" : isUrgent ? "danger" : "warning"}
                  size="sm"
                >
                  {isCompleted ? "DONE" : task.priority.toUpperCase()}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
