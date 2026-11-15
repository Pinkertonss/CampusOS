"use client";

import React, { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Check,
  Clock,
  ArrowRight,
  ShieldAlert,
  Compass,
  Calculator,
} from "lucide-react";
import { DailyActionItem } from "../../types";
import { Card, CardHeader, CardTitle, Badge, Button, useToast } from "../ui";

interface ActionPlanListProps {
  initialActions: DailyActionItem[];
  recommendedFocus?: string;
  onActionDismiss?: (id: string) => void;
  onOpenWhatIf?: (courseCode?: string) => void;
}

export default function ActionPlanList({
  initialActions,
  recommendedFocus,
  onActionDismiss,
  onOpenWhatIf,
}: ActionPlanListProps) {
  const [actions, setActions] = useState<DailyActionItem[]>(initialActions);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handleMarkDone = (item: DailyActionItem) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    toast.success("Action handled", {
      description: `Marked "${item.title}" as resolved.`,
    });

    if (onActionDismiss) {
      onActionDismiss(item.id);
    }
  };

  const activeActions = actions.filter((a) => !completedIds.has(a.id));

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] text-[var(--action-primary)] border border-[var(--border-color)] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              Cross-Module Decision Intelligence
              {activeActions.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-badge-border)] font-mono">
                  {activeActions.length} prioritized
                </span>
              )}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Synthesized from attendance thresholds, timetable schedule, and upcoming deadlines
            </p>
          </div>
        </div>
      </div>

      {recommendedFocus && (
        <div className="mb-4 p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] flex items-start gap-3">
          <div className="w-6 h-6 rounded-md bg-[var(--surface-card)] text-[var(--action-primary)] border border-[var(--border-color)] flex items-center justify-center shrink-0 mt-0.5">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs">
            <span className="font-semibold text-[var(--text-primary)]">Decision Engine Focus: </span>
            <span className="text-[var(--text-secondary)]">{recommendedFocus}</span>
          </div>
        </div>
      )}

      {activeActions.length === 0 ? (
        <div className="flex items-center justify-center p-6 text-center rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
          <div className="space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-[var(--text-primary)]">All caught up!</div>
            <p className="text-xs text-[var(--text-secondary)]">
              No urgent attendance risks or deadlines pending today. Great work staying ahead!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeActions.map((action) => {
            const isConflict = action.category === "conflict";
            const isUrgent = action.priority === "urgent";
            const isHigh = action.priority === "high";

            let priorityVariant: "danger" | "warning" | "info" | "default" = "default";
            if (isConflict || isUrgent) priorityVariant = "danger";
            else if (isHigh) priorityVariant = "warning";
            else if (action.priority === "medium") priorityVariant = "info";

            return (
              <div
                key={action.id}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isConflict
                    ? "bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
                    : isUrgent
                    ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                    : isHigh
                    ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                    : "bg-[var(--surface-card)] border-[var(--border-color)]"
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={priorityVariant} size="sm" dot>
                      {isConflict ? "SCHEDULE CONFLICT" : action.priority.toUpperCase()}
                    </Badge>
                    {action.course_code && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] font-semibold">
                        {action.course_code}
                      </span>
                    )}
                    {action.schedule_info && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800/90 text-[var(--text-primary)] border border-[var(--border-color)] font-medium">
                        <Clock className="w-3 h-3 text-[var(--action-primary)]" />
                        {action.schedule_info}
                      </span>
                    )}
                    <h3 className="text-sm font-semibold text-slate-100 truncate">
                      {action.title}
                    </h3>
                  </div>

                  {action.conflict_warning && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium bg-amber-950/40 px-2 py-1 rounded border border-amber-800/40">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>{action.conflict_warning}</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {action.reason}
                  </p>

                  {action.action_required && (
                    <p className="text-[11px] text-slate-400">
                      <strong className="text-slate-300">Action:</strong> {action.action_required}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {action.course_code && onOpenWhatIf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenWhatIf(action.course_code)}
                      leftIcon={<Calculator className="w-3.5 h-3.5 text-[var(--action-primary)]" />}
                      className="text-xs text-[var(--action-primary)] hover:opacity-90 hover:bg-[var(--surface-secondary)]"
                    >
                      Simulate
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMarkDone(action)}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                    className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700"
                  >
                    Mark done
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
