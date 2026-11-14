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
    <Card
      className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 border-teal-800/40 shadow-lg"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Cross-Module Decision Intelligence
              {activeActions.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-900/80 text-teal-300 border border-teal-700/60 font-mono">
                  {activeActions.length} prioritized
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Synthesized from attendance thresholds, timetable schedule, and upcoming deadlines
            </p>
          </div>
        </div>
      </div>

      {recommendedFocus && (
        <div className="mb-4 p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/30 flex items-start gap-3 shadow-inner">
          <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs">
            <span className="font-semibold text-teal-300">Decision Engine Focus: </span>
            <span className="text-slate-200">{recommendedFocus}</span>
          </div>
        </div>
      )}

      {activeActions.length === 0 ? (
        <div className="flex items-center justify-center p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/60">
          <div className="space-y-1">
            <CheckCircle2 className="w-8 h-8 text-teal-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-200">All caught up!</div>
            <p className="text-xs text-slate-400">
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
                    ? "bg-gradient-to-r from-red-950/40 via-amber-950/30 to-slate-950/60 border-amber-600/60 shadow-md hover:border-amber-500"
                    : isUrgent
                    ? "bg-red-950/20 border-red-800/50 hover:border-red-700/80"
                    : isHigh
                    ? "bg-amber-950/20 border-amber-800/50 hover:border-amber-700/80"
                    : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={priorityVariant} size="sm" dot>
                      {isConflict ? "SCHEDULE CONFLICT" : action.priority.toUpperCase()}
                    </Badge>
                    {action.course_code && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-semibold">
                        {action.course_code}
                      </span>
                    )}
                    {action.schedule_info && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800/90 text-teal-300 border border-teal-800/40 font-medium">
                        <Clock className="w-3 h-3 text-teal-400" />
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
                      leftIcon={<Calculator className="w-3.5 h-3.5 text-teal-400" />}
                      className="text-xs text-teal-300 hover:text-teal-200 hover:bg-teal-950/40"
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
