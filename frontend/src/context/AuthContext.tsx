"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface StudentProfile {
  id?: string;
  user_id: string;
  full_name: string;
  roll_no: string;
  branch: string;
  semester: number;
  consent_given: boolean;
  role?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: StudentProfile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInAsDemo: () => Promise<void>;
  signInAsAdminDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (data: Omit<StudentProfile, "user_id" | "id">) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo profile for Arjun Mehta (TIET COE Sem 5)
const DEMO_USER_ID = "00000000-0000-0000-0000-000102203099";
export const DEMO_PROFILE: StudentProfile = {
  id: "demo-profile-id",
  user_id: DEMO_USER_ID,
  full_name: "Arjun Mehta",
  roll_no: "102203099",
  branch: "COE",
  semester: 5,
  consent_given: true,
  role: "student",
};

// Demo profile for Administrator (DOAA)
const DEMO_ADMIN_ID = "admin-00000000-0000-0000-0000-000000000001";
export const DEMO_ADMIN_PROFILE: StudentProfile = {
  id: "demo-admin-profile-id",
  user_id: DEMO_ADMIN_ID,
  full_name: "Dr. Administrator (DOAA)",
  roll_no: "ADMIN-001",
  branch: "ACADEMIC-ADMIN",
  semester: 0,
  consent_given: true,
  role: "admin",
};

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);

  // Load profile from Supabase or LocalStorage
  const loadProfile = useCallback(async (userId: string, isDemo = false) => {
    if (isDemo || userId === DEMO_USER_ID || userId === DEMO_ADMIN_ID) {
      if (userId === DEMO_ADMIN_ID) {
        setProfile(DEMO_ADMIN_PROFILE);
      } else {
        setProfile(DEMO_PROFILE);
      }
      setIsOnboarded(true);
      setCookie("campusos_onboarded", "true");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        setProfile(data as StudentProfile);
        const onboarded = Boolean(data.consent_given && data.roll_no);
        setIsOnboarded(onboarded);
        setCookie("campusos_onboarded", onboarded ? "true" : "false");
        return;
      }
    } catch {
      // Supabase table or query failed, check local storage fallback
    }

    // Local fallback for offline/development mode
    const cached = localStorage.getItem(`campusos_profile_${userId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as StudentProfile;
        setProfile(parsed);
        const onboarded = Boolean(parsed.consent_given && parsed.roll_no);
        setIsOnboarded(onboarded);
        setCookie("campusos_onboarded", onboarded ? "true" : "false");
        return;
      } catch {
        // ignore
      }
    }

    setProfile(null);
    setIsOnboarded(false);
    setCookie("campusos_onboarded", "false");
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsLoading(true);

      const isExplicitLoggedOut =
        typeof window !== "undefined" &&
        (localStorage.getItem("campusos_logged_out") === "true" ||
          document.cookie.includes("campusos_logged_out=true"));

      if (isExplicitLoggedOut) {
        if (isMounted) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setIsOnboarded(false);
          deleteCookie("campusos_auth_token");
          deleteCookie("campusos_onboarded");
          setIsLoading(false);
        }
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const isMockSupabase = !supabaseUrl || supabaseUrl.includes("mock-project");
      const isDemoMode = isMockSupabase || localStorage.getItem("campusos_demo_auth") === "true";

      // If mock Supabase or demo mode, immediately hydrate demo profile (Arjun Mehta or Admin)
      if (isDemoMode) {
        const isAdmin = localStorage.getItem("campusos_role") === "admin";
        const uid = isAdmin ? DEMO_ADMIN_ID : DEMO_USER_ID;
        const mockUser = {
          id: uid,
          email: isAdmin ? "admin@thapar.edu" : "arjun.mehta@thapar.edu",
          user_metadata: { full_name: isAdmin ? "Dr. Administrator (DOAA)" : "Arjun Mehta", role: isAdmin ? "admin" : "student" },
          aud: "authenticated",
          created_at: new Date().toISOString(),
          app_metadata: { role: isAdmin ? "admin" : "student" },
        } as unknown as User;

        if (isMounted) {
          setUser(mockUser);
          setCookie("campusos_auth_token", isAdmin ? "dev-admin" : "dev-user-102203099");
          setCookie("campusos_onboarded", "true");
          await loadProfile(uid, true);
          setIsLoading(false);
        }
        return;
      }

      try {
        // Fast timeout to prevent hanging on unresponsive Supabase endpoints
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 2000)
        );
        const { data: { session: activeSession } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (isMounted) {
          if (activeSession?.user) {
            setUser(activeSession.user);
            setSession(activeSession);
            setCookie("campusos_auth_token", activeSession.access_token);
            await loadProfile(activeSession.user.id);
          } else {
            // Default to demo session if unauthenticated in local dev
            const mockUser = {
              id: DEMO_USER_ID,
              email: "arjun.mehta@thapar.edu",
              user_metadata: { full_name: "Arjun Mehta" },
              aud: "authenticated",
              created_at: new Date().toISOString(),
              app_metadata: {},
            } as unknown as User;
            setUser(mockUser);
            setCookie("campusos_auth_token", "dev-user-102203099");
            setCookie("campusos_onboarded", "true");
            await loadProfile(DEMO_USER_ID, true);
          }
        }
      } catch {
        if (isMounted) {
          await loadProfile(DEMO_USER_ID, true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    // Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (currentSession?.user) {
          setUser(currentSession.user);
          setSession(currentSession);
          setCookie("campusos_auth_token", currentSession.access_token);
          await loadProfile(currentSession.user.id);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
          setProfile(null);
          setIsOnboarded(false);
          deleteCookie("campusos_auth_token");
          deleteCookie("campusos_onboarded");
          localStorage.removeItem("campusos_demo_auth");
        }
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    setIsLoading(true);
    localStorage.removeItem("campusos_logged_out");
    deleteCookie("campusos_logged_out");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }

      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
        setCookie("campusos_auth_token", data.session.access_token);
        localStorage.removeItem("campusos_demo_auth");
        await loadProfile(data.user.id);
      }

      setIsLoading(false);
      return {};
    } catch (err: unknown) {
      setIsLoading(false);
      return { error: err instanceof Error ? err.message : "Failed to sign in. Please try again." };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ error?: string }> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || "",
          },
        },
      });

      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        if (data.session) {
          setSession(data.session);
          setCookie("campusos_auth_token", data.session.access_token);
        }
        localStorage.removeItem("campusos_demo_auth");
        await loadProfile(data.user.id);
      }

      setIsLoading(false);
      return {};
    } catch (err: unknown) {
      setIsLoading(false);
      return { error: err instanceof Error ? err.message : "Failed to create account." };
    }
  };

  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    try {
      const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        return { error: error.message };
      }
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Google sign in failed" };
    }
  };

  const signInAsDemo = async () => {
    setIsLoading(true);
    localStorage.removeItem("campusos_logged_out");
    deleteCookie("campusos_logged_out");
    localStorage.setItem("campusos_demo_auth", "true");
    localStorage.setItem("campusos_role", "student");
    localStorage.setItem("campusos_auth_token", "dev-user-102203099");
    const mockUser = {
      id: DEMO_USER_ID,
      email: "arjun.mehta@thapar.edu",
      user_metadata: { full_name: "Arjun Mehta", role: "student" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      app_metadata: { role: "student" },
    } as unknown as User;

    setUser(mockUser);
    setSession(null);
    setProfile(DEMO_PROFILE);
    setIsOnboarded(true);
    setCookie("campusos_auth_token", "dev-user-102203099");
    setCookie("campusos_onboarded", "true");
    setIsLoading(false);
  };

  const signInAsAdminDemo = async () => {
    setIsLoading(true);
    localStorage.removeItem("campusos_logged_out");
    deleteCookie("campusos_logged_out");
    localStorage.setItem("campusos_demo_auth", "true");
    localStorage.setItem("campusos_role", "admin");
    localStorage.setItem("campusos_auth_token", "dev-admin");
    const mockUser = {
      id: DEMO_ADMIN_ID,
      email: "admin@thapar.edu",
      user_metadata: { full_name: "Dr. Administrator (DOAA)", role: "admin" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      app_metadata: { role: "admin" },
    } as unknown as User;

    setUser(mockUser);
    setSession(null);
    setProfile(DEMO_ADMIN_PROFILE);
    setIsOnboarded(true);
    setCookie("campusos_auth_token", "dev-admin");
    setCookie("campusos_onboarded", "true");
    setIsLoading(false);
  };

  const signOut = async () => {
    setIsLoading(true);
    localStorage.setItem("campusos_logged_out", "true");
    localStorage.removeItem("campusos_demo_auth");
    localStorage.removeItem("campusos_role");
    localStorage.removeItem("campusos_auth_token");
    setCookie("campusos_logged_out", "true");
    deleteCookie("campusos_auth_token");
    deleteCookie("campusos_onboarded");

    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    setUser(null);
    setSession(null);
    setProfile(null);
    setIsOnboarded(false);
    setIsLoading(false);

    // Auto refresh website to login screen on sign out
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  const completeOnboarding = async (
    data: Omit<StudentProfile, "user_id" | "id">
  ): Promise<{ error?: string }> => {
    const currentUserId = user?.id || DEMO_USER_ID;
    const newProfile: StudentProfile = {
      ...data,
      user_id: currentUserId,
      consent_given: true,
      created_at: new Date().toISOString(),
    };

    try {
      // Upsert into Supabase profiles
      const { error } = await supabase.from("profiles").upsert(
        {
          user_id: currentUserId,
          full_name: data.full_name,
          roll_no: data.roll_no,
          branch: data.branch,
          semester: data.semester,
          consent_given: true,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        // Fallback save to localStorage for demo
        localStorage.setItem(`campusos_profile_${currentUserId}`, JSON.stringify(newProfile));
      }
    } catch {
      localStorage.setItem(`campusos_profile_${currentUserId}`, JSON.stringify(newProfile));
    }

    setProfile(newProfile);
    setIsOnboarded(true);
    setCookie("campusos_onboarded", "true");
    return {};
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isOnboarded,
        signIn,
        signUp,
        signInWithGoogle,
        signInAsDemo,
        signInAsAdminDemo,
        signOut,
        completeOnboarding,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
