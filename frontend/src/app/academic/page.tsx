"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowLeft,
  RefreshCw,
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

export default function AcademicPlaceholderPage() {
  const [showSkeleton, setShowSkeleton] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Academic Dashboard &amp; What-If Planner
            </h1>
            <Badge variant="warning" size="md">
              75% TIET Rule
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulate missed lectures, target exam scores, and forecast attendance safety margins.
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
          <Link href="/">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Overview
            </Button>
          </Link>
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-4">
          <Skeleton variant="card" />
          <Skeleton variant="table" rows={6} columns={5} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="min-h-[380px] flex items-center justify-center p-8">
              <EmptyState
                icon={<Calculator className="w-12 h-12 text-teal-600 dark:text-teal-400" />}
                title="What-If Planner Simulation Engine"
                description="Test 'Can I miss 2 more DAA classes?' or 'What score do I need in End-Sem to secure an A- grade?'. Calculations use official TIET 75% attendance and relative grading policies."
                action={{
                  label: "Run Sample Simulation",
                  variant: "primary",
                  onClick: () => alert("Simulation module placeholder"),
                }}
              />
            </Card>
          </div>

          <div className="space-y-6">
            <Card
              header={
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>TIET Regulation 2.1</span>
                </CardTitle>
              }
            >
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <p>
                  Minimum attendance requirement is <strong>75% in each course</strong>.
                  Students falling below 75% are detained from taking end-semester examinations.
                </p>
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200">
                  Shortage up to 10% may be condoned by the Dean only on documented medical grounds submitted within 7 days.
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
