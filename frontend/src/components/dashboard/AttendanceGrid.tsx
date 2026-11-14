"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Plus,
  Minus,
  Sparkles,
} from "lucide-react";
import { AcademicSummaryCourse } from "../../types";
import { Card, Badge, Button, useToast } from "../ui";
import { updateAttendance } from "../../lib/api";

interface AttendanceGridProps {
  courses: AcademicSummaryCourse[];
  onAttendanceUpdated?: () => void;
  onOpenWhatIf?: (courseCode: string) => void;
}

export function ProgressRing({
  percentage,
  size = 64,
  strokeWidth = 6,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercent = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  let strokeColor = "#10b981"; // emerald for >= 75%
  if (percentage < 65.0) {
    strokeColor = "#ef4444"; // red for critical
  } else if (percentage < 75.0) {
    strokeColor = "#f59e0b"; // amber for warning
  }

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-800"
          fill="transparent"
        />
        {/* Progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute text-[11px] font-bold text-slate-800 dark:text-slate-100 font-mono">
        {Math.round(percentage)}%
      </div>
    </div>
  );
}

export default function AttendanceGrid({
  courses,
  onAttendanceUpdated,
  onOpenWhatIf,
}: AttendanceGridProps) {
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);
  const { toast } = useToast();

  const handleQuickLog = async (
    course: AcademicSummaryCourse,
    status: "present" | "absent"
  ) => {
    setUpdatingCode(course.code);
    const newAttended = status === "present" ? course.attended + 1 : course.attended;
    const newTotal = course.total_held + 1;

    try {
      await updateAttendance(course.code, newAttended, newTotal);
      toast.success("Attendance logged", {
        description: `Logged 1 ${status} for ${course.code}. (${newAttended}/${newTotal})`,
      });
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch {
      toast.error("Failed to update attendance");
    } finally {
      setUpdatingCode(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Attendance Overview
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              75% TIET Rule
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time status based on held classes (cancelled sessions excluded)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => {
          const isSafe = course.status === "safe";
          const isWarning = course.status === "warning";
          const isCritical = course.status === "critical";

          let statusBadgeVariant: "success" | "warning" | "danger" = "success";
          if (isCritical) statusBadgeVariant = "danger";
          else if (isWarning) statusBadgeVariant = "warning";

          return (
            <Card
              key={course.code}
              hover
              className="p-5 flex flex-col justify-between border-slate-200 dark:border-slate-800 transition-all shadow-sm"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                        {course.code}
                      </span>
                      <span className="text-[11px] text-slate-400">· {course.credits} cr</span>
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 mt-0.5">
                      {course.name}
                    </h3>
                  </div>

                  <Badge variant={statusBadgeVariant} size="sm" dot>
                    {course.status.toUpperCase()}
                  </Badge>
                </div>

                {/* Progress Ring & Stats Row */}
                <div className="flex items-center gap-4 my-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <ProgressRing percentage={course.percentage} size={64} />

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Attended: <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{course.attended}/{course.total_held}</span> classes
                    </div>

                    {isSafe ? (
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{course.safe_bunks_remaining} safe bunk(s) left</span>
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Attend next {course.classes_needed_for_75 ?? 0} classes</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Quick Logging & What-if Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenWhatIf && onOpenWhatIf(course.code)}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-500 font-medium inline-flex items-center gap-1 transition"
                >
                  <Sparkles className="w-3 h-3" />
                  What-If Sim
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={updatingCode === course.code}
                    onClick={() => handleQuickLog(course, "present")}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition"
                  >
                    +1 Present
                  </button>
                  <button
                    type="button"
                    disabled={updatingCode === course.code}
                    onClick={() => handleQuickLog(course, "absent")}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 hover:bg-red-100 border border-red-200 dark:border-red-800 transition"
                  >
                    +1 Absent
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
