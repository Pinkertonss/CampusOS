"use client";

import React, { useState } from "react";
import {
  Repeat,
  HeartHandshake,
  BookOpen,
  Plus,
  RefreshCw,
  TrendingUp,
  Leaf,
  IndianRupee,
  Package,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Skeleton,
  EmptyState,
} from "../../components/ui";

const MODES = [
  { id: "all", label: "All Items" },
  { id: "exchange", label: "Exchange" },
  { id: "donate", label: "Donate (Free)" },
  { id: "borrow", label: "Borrow" },
];

export default function ReusePlaceholderPage() {
  const [activeMode, setActiveMode] = useState("all");
  const [showSkeleton, setShowSkeleton] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Campus Reuse
            </h1>
            <Badge variant="primary" size="md">
              Circular Economy
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Exchange, donate, or borrow engineering textbooks, calculators, and lab coats across TIET hostels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSkeleton(!showSkeleton)}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {showSkeleton ? "Show UI" : "Toggle Skeleton"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-teal-600 hover:bg-teal-500"
          >
            Post an Item
          </Button>
        </div>
      </div>

      {/* Mode Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {MODES.map((m) => {
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveMode(m.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition shrink-0 ${
                isActive
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {showSkeleton ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
          <Skeleton variant="card" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Impact Stats Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Total Student Savings
                </span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                ₹850
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Saved through peer donations &amp; exchanges
              </p>
            </Card>

            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Items Diverted
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                1 Item
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Chemistry Lab Coat (M) reused
              </p>
            </Card>

            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  CO₂ Diverted
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Leaf className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                2.1 kg
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Estimated emissions avoided
              </p>
            </Card>
          </div>

          {/* Marketplace Content */}
          <Card className="min-h-[380px] flex items-center justify-center p-8">
            <EmptyState
              icon={<Repeat className="w-12 h-12 text-teal-600 dark:text-teal-400" />}
              title="Campus Reuse Marketplace"
              description="No active exchange listings in your hostel right now. Donate or list a textbook, drafter, or calculator to help a junior student!"
              action={{
                label: "List an Item for Donation or Exchange",
                variant: "primary",
                icon: <Plus className="w-4 h-4" />,
                onClick: () => alert("New listing placeholder"),
              }}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
