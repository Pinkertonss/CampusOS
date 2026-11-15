"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap,
  Sparkles,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, Badge, useToast } from "../../components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const { signIn, signInWithGoogle, signInAsDemo, signInAsAdminDemo, isLoading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [adminDemoSubmitting, setAdminDemoSubmitting] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning("Please fill in both your email and password");
      return;
    }

    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);

    if (res.error) {
      toast.error("Sign in failed", {
        description: res.error,
      });
    } else {
      toast.success("Welcome back!", {
        description: "Redirecting to your student dashboard...",
      });
      router.push(nextUrl);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    const res = await signInWithGoogle();
    setGoogleSubmitting(false);
    if (res.error) {
      toast.error("Google sign in failed", {
        description: res.error,
      });
    }
  };

  const handleDemoSignIn = async () => {
    setDemoSubmitting(true);
    await signInAsDemo();
    setDemoSubmitting(false);
    toast.success("Signed in as Demo Student", {
      description: "Welcome Arjun Mehta (TIET COE)",
    });
    router.push(nextUrl);
  };

  const handleAdminDemoSignIn = async () => {
    setAdminDemoSubmitting(true);
    await signInAsAdminDemo();
    setAdminDemoSubmitting(false);
    toast.success("Signed in as Administrator (Demo)", {
      description: "Welcome Dr. Administrator (DOAA)",
    });
    router.push("/admin");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[var(--page-bg)] text-[var(--text-primary)]">
      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs mb-2">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">CampusOS</h1>
            <Badge variant="primary" size="sm">
              TIET Pilot
            </Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            One personalized platform fixing fragmented campus information.
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-6 sm:p-8 bg-[var(--surface-card)] border-[var(--border-color)] shadow-xl">
          {/* Demo Quick Sign-in Banner for Hackathon Evaluators */}
          <div className="mb-6 p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--action-primary)]" /> Instant Demo Personas
              </span>
              <span className="text-[10px] text-[var(--accent-badge-text)] bg-[var(--accent-badge-bg)] border border-[var(--accent-badge-border)] px-1.5 py-0.5 rounded font-mono">
                Student &amp; Admin
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Explore with verified student attendance or institutional administrative governance without manual credentials.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                isLoading={demoSubmitting}
                onClick={handleDemoSignIn}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                className="font-medium text-xs"
              >
                Student (Arjun)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                isLoading={adminDemoSubmitting}
                onClick={handleAdminDemoSignIn}
                leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-[var(--action-primary)]" />}
                className="font-medium text-xs"
              >
                Admin (DOAA)
              </Button>
            </div>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-400 font-medium tracking-wider">
                Or with your email
              </span>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Campus Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="student@thapar.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] focus:border-[var(--action-primary)] transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-300"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] focus:border-[var(--action-primary)] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={submitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="mt-2 bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)]"
            >
              Sign In
            </Button>
          </form>

          {/* Google OAuth Button */}
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              isLoading={googleSubmitting}
              onClick={handleGoogleSignIn}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </Button>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-[var(--action-primary)] hover:opacity-80 font-medium underline-offset-4 hover:underline"
            >
              Create account
            </Link>
          </div>
        </Card>

        {/* Security & Privacy Footer Note */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-[var(--action-primary)]" />
          <span>Privacy first · Row-Level Security · Explicit consent only</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-400">
          Loading CampusOS...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
