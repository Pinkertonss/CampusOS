"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  User as UserIcon,
  Hash,
  Layers,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, Badge, useToast } from "../../components/ui";

const BRANCH_OPTIONS = [
  { code: "COE", name: "Computer Engineering (COE)" },
  { code: "CSE", name: "Computer Science & Engineering (CSE)" },
  { code: "ENC", name: "Electronics & Computer Engineering (ENC)" },
  { code: "ECE", name: "Electronics & Communication (ECE)" },
  { code: "ELE", name: "Electrical Engineering (ELE)" },
  { code: "MEC", name: "Mechanical Engineering (MEC)" },
  { code: "CIE", name: "Civil Engineering (CIE)" },
  { code: "CHE", name: "Chemical Engineering (CHE)" },
  { code: "BIOT", name: "Biotechnology (BIOT)" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, completeOnboarding, isOnboarded } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [branch, setBranch] = useState("COE");
  const [semester, setSemester] = useState(5);
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOnboarded) {
      router.push("/");
    }
  }, [isOnboarded, router]);

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    } else if (profile?.full_name) {
      setFullName(profile.full_name);
    }
    if (profile?.roll_no) setRollNo(profile.roll_no);
    if (profile?.branch) setBranch(profile.branch);
    if (profile?.semester) setSemester(profile.semester);
  }, [user, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.warning("Please provide your full name");
      return;
    }

    if (!rollNo.trim()) {
      toast.warning("Please provide your Thapar roll number");
      return;
    }

    if (!consentGiven) {
      toast.error("Consent required", {
        description:
          "You must agree to the privacy and personalization consent to use CampusOS.",
      });
      return;
    }

    setSubmitting(true);
    const res = await completeOnboarding({
      full_name: fullName.trim(),
      roll_no: rollNo.trim(),
      branch,
      semester: Number(semester),
      consent_given: true,
    });
    setSubmitting(false);

    if (res.error) {
      toast.error("Onboarding failed", {
        description: res.error,
      });
    } else {
      toast.success("Profile setup complete!", {
        description: `Welcome to CampusOS, ${fullName}! Launching your dashboard...`,
      });
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-sky-500 text-white shadow-lg shadow-teal-900/30 mb-2">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Student Onboarding
            </h1>
            <Badge variant="primary" size="sm">
              Step 1 of 1
            </Badge>
          </div>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Set up your academic profile so CampusOS can calculate your attendance
            limits, semester credits, and timetable.
          </p>
        </div>

        {/* Onboarding Form Card */}
        <Card className="p-6 sm:p-8 bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label
                htmlFor="onboarding-name"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="onboarding-name"
                  type="text"
                  required
                  placeholder="e.g. Arjun Mehta"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Roll Number & Semester Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="onboarding-roll"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  TIET Roll Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    id="onboarding-roll"
                    type="text"
                    required
                    placeholder="e.g. 102203099"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="onboarding-semester"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Current Semester
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Layers className="w-4 h-4" />
                  </div>
                  <select
                    id="onboarding-semester"
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Branch */}
            <div>
              <label
                htmlFor="onboarding-branch"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Engineering Branch / Department
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <BookOpen className="w-4 h-4" />
                </div>
                <select
                  id="onboarding-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                >
                  {BRANCH_OPTIONS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Privacy & Consent Checkbox Card */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacy & Data Personalization Consent</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                CampusOS processes your course enrollments, attendance records, and
                grades <strong>strictly to personalize your dashboard</strong> and
                compute What-If projections. Your personal data is protected by
                PostgreSQL Row-Level Security (RLS) and is never shared, sold, or used
                without your explicit permission.
              </p>
              <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-teal-600 focus:ring-teal-500 focus:ring-offset-slate-950 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-200">
                  I consent to CampusOS using my academic data solely to personalize
                  my dashboard, attendance tracker, and Copilot suggestions.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={submitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="mt-4 bg-teal-600 hover:bg-teal-500 py-2.5 text-sm font-semibold"
            >
              Complete Setup & Enter CampusOS
            </Button>
          </form>
        </Card>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          Thapar Institute of Engineering & Technology · Single-Campus Hackathon Pilot
        </div>
      </div>
    </div>
  );
}
