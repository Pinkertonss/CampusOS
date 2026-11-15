"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  Layers,
} from "lucide-react";
import { TimetableSlot } from "../../types";
import { Card, Badge, EmptyState } from "../ui";

interface TimetableSectionProps {
  slots: TimetableSlot[];
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimetableSection({ slots }: TimetableSectionProps) {
  const [viewMode, setViewMode] = useState<"today" | "weekly">("today");
  const [selectedDay, setSelectedDay] = useState<string>("Monday");

  // Determine today's weekday name
  const dayIndex = new Date().getDay(); // 0=Sun, 1=Mon, ..., 5=Fri
  const currentWeekdayName =
    dayIndex >= 1 && dayIndex <= 5 ? WEEKDAYS[dayIndex - 1] : "Monday";

  const todaySlots = slots.filter(
    (s) => s.day_of_week.toLowerCase() === currentWeekdayName.toLowerCase()
  );

  const displaySlots =
    viewMode === "today"
      ? todaySlots
      : slots.filter(
          (s) => s.day_of_week.toLowerCase() === selectedDay.toLowerCase()
        );

  return (
    <Card className="p-5 sm:p-6 border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            Class Timetable
            <Badge variant="primary" size="sm">
              Odd Semester 2024
            </Badge>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Lecture halls and laboratories across TIET campus
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("today")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === "today"
                ? "bg-white dark:bg-slate-900 text-[var(--action-primary)] shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Today ({currentWeekdayName})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("weekly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === "weekly"
                ? "bg-white dark:bg-slate-900 text-[var(--action-primary)] shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Weekly Schedule
          </button>
        </div>
      </div>

      {/* Weekday Selector if in Weekly Mode */}
      {viewMode === "weekly" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2">
          {WEEKDAYS.map((day) => {
            const isSelected = selectedDay === day;
            const count = slots.filter(
              (s) => s.day_of_week.toLowerCase() === day.toLowerCase()
            ).length;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                  isSelected
                    ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
                    : "bg-[var(--surface-secondary)]/60 text-[var(--text-secondary)] hover:bg-slate-200"
                }`}
              >
                {day} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Slots List */}
      {displaySlots.length === 0 ? (
        <EmptyState
          compact
          icon={<Calendar className="w-8 h-8 text-[var(--action-primary)]" />}
          title={`No classes on ${viewMode === "today" ? currentWeekdayName : selectedDay}`}
          description="Enjoy your self-study time or catch up on lab assignments!"
        />
      ) : (
        <div className="space-y-2.5">
          {displaySlots.map((slot) => {
            const isLab = slot.slot_type.toLowerCase().includes("lab");

            return (
              <div
                key={slot.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Time box */}
                  <div className="w-16 h-12 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--action-primary)] font-mono text-xs font-bold flex flex-col items-center justify-center shrink-0">
                    <span>{slot.start_time}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {slot.end_time}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--action-primary)]">
                        {slot.course_code}
                      </span>
                      <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                        {slot.course_name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-[var(--action-primary)]" />
                        {slot.venue}
                      </span>
                      <span>·</span>
                      <span>{slot.day_of_week}</span>
                    </div>
                  </div>
                </div>

                <Badge variant={isLab ? "warning" : "default"} size="sm">
                  {slot.slot_type}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
