"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Compass,
  Sparkles,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  ExternalLink,
  Sliders,
  Filter,
  Search,
  Check,
  X,
  Plus,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  BookOpen,
  Send,
  FileCheck2,
  Briefcase,
  Award,
  GraduationCap,
  FileText,
  Upload,
  Trash2,
  Download,
  Eye,
  Globe,
  ShieldCheck,
  CheckCircle,
  Info,
  Lock,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Modal,
  Skeleton,
  useToast,
  EmptyState,
} from "../../components/ui";
import {
  getOpportunities,
  getRecommendedOpportunities,
  getStudentSkillProfile,
  updateStudentSkillProfile,
  toggleSaveOpportunity,
  getSavedOpportunities,
  applyToOpportunity,
  getAppliedOpportunities,
  getStudentExperienceProfile,
  updateStudentExperienceProfile,
  uploadStudentResume,
  deleteStudentResume,
  getOpportunityEligibility,
} from "../../lib/api";
import {
  Opportunity,
  OpportunityRecommendation,
  OpportunityRecommendationResponse,
  StudentSkillProfile,
  OpportunityApplication,
  StudentExperienceProfile,
  EducationEntry,
  ProjectEntry,
  WorkExperienceEntry,
  CertificationEntry,
  OpportunityEligibility,
} from "../../types";

export default function OpportunitiesPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"recommended" | "explore" | "experience" | "saved" | "applied">("recommended");
  const [recommendations, setRecommendations] = useState<OpportunityRecommendation[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [appliedList, setAppliedList] = useState<OpportunityApplication[]>([]);
  const [profile, setProfile] = useState<StudentSkillProfile | null>(null);

  // Student Experience Profile State
  const [experienceProfile, setExperienceProfile] = useState<StudentExperienceProfile | null>(null);
  const [savingExperience, setSavingExperience] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  // Add Project Modal State
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [projTitle, setProjTitle] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projTech, setProjTech] = useState("");
  const [projRole, setProjRole] = useState("Developer");
  const [projLink, setProjLink] = useState("");

  // Add Work Experience Modal State
  const [addWorkOpen, setAddWorkOpen] = useState(false);
  const [workRole, setWorkRole] = useState("");
  const [workCompany, setWorkCompany] = useState("");
  const [workLocation, setWorkLocation] = useState("Patiala, Punjab");
  const [workStart, setWorkStart] = useState("2024-06-01");
  const [workEnd, setWorkEnd] = useState("");
  const [workDesc, setWorkDesc] = useState("");

  // Add Certification Modal State
  const [addCertOpen, setAddCertOpen] = useState(false);
  const [certTitle, setCertTitle] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certDate, setCertDate] = useState("2024-03-15");
  const [certUrl, setCertUrl] = useState("");

  // Experience Profile skill and achievement inputs
  const [expSkillInput, setExpSkillInput] = useState("");
  const [achievementInput, setAchievementInput] = useState("");

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Edit Profile Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [editOptIn, setEditOptIn] = useState<boolean>(true);
  const [editHours, setEditHours] = useState<number>(10);
  const [savingProfile, setSavingProfile] = useState(false);

  // Apply Modal
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedOppToApply, setSelectedOppToApply] = useState<Opportunity | null>(null);
  const [statementInput, setStatementInput] = useState("");
  const [commitmentInput, setCommitmentInput] = useState(8);
  const [submittingApp, setSubmittingApp] = useState(false);

  const { toast } = useToast();

  const appliedOppIds = new Set(appliedList.map((a) => a.opportunity_id));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recData, allData, savedData, profData, appsData, expData] = await Promise.all([
        getRecommendedOpportunities().catch(() => null),
        getOpportunities(),
        getSavedOpportunities().catch(() => []),
        getStudentSkillProfile().catch(() => null),
        getAppliedOpportunities().catch(() => []),
        getStudentExperienceProfile().catch(() => null),
      ]);

      if (recData) {
        setRecommendations(recData.recommendations || []);
      }
      setAllOpportunities(allData || []);
      setSavedOpportunities(savedData || []);
      setAppliedList(appsData || []);
      const sIds = new Set((savedData || []).map((o) => o.id));
      setSavedIds(sIds);

      if (profData) {
        setProfile(profData);
        setEditSkills(profData.skills || []);
        setEditOptIn(profData.opt_in_matching ?? true);
        setEditHours(profData.available_hours_per_week || 10);
      }

      if (expData) {
        setExperienceProfile(expData);
      }
    } catch (err) {
      console.error("Failed to load opportunities:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleSave = async (oppId: string) => {
    try {
      const res = await toggleSaveOpportunity(oppId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (res.saved) {
          next.add(oppId);
        } else {
          next.delete(oppId);
        }
        return next;
      });

      const updatedSaved = await getSavedOpportunities();
      setSavedOpportunities(updatedSaved);

      toast.success(res.saved ? "Opportunity Saved" : "Opportunity Removed", {
        description: res.message,
      });
    } catch (err) {
      toast.error("Failed to save opportunity", {
        description: "Could not update bookmark status.",
      });
    }
  };

  const handleOpenApplyModal = (opp: Opportunity) => {
    setSelectedOppToApply(opp);
    const topSkills = (profile?.skills || ["Python", "Machine Learning"]).slice(0, 3).join(", ");
    setStatementInput(
      `I am eager to contribute to ${opp.title} at ${opp.organization}. My technical background in ${topSkills} aligns closely with your team's goals, and I can commit ${opp.time_commitment_hrs_week} hours per week without timetable conflicts.`
    );
    setCommitmentInput(opp.time_commitment_hrs_week);
    setApplyModalOpen(true);
  };

  const handleConfirmApply = async () => {
    if (!selectedOppToApply) return;
    setSubmittingApp(true);
    try {
      const application = await applyToOpportunity(selectedOppToApply.id, {
        statement_of_interest: statementInput,
        available_hours_per_week: commitmentInput,
      });

      setAppliedList((prev) => [...prev, application]);
      setApplyModalOpen(false);

      toast.success("Application Submitted!", {
        description: `Your application for "${selectedOppToApply.title}" was registered with ${selectedOppToApply.organization}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit application";
      toast.error("Application Failed", {
        description: msg,
      });
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (!editSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setEditSkills([...editSkills, trimmed]);
    }
    setSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setEditSkills(editSkills.filter((s) => s !== skillToRemove));
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await updateStudentSkillProfile({
        skills: editSkills,
        opt_in_matching: editOptIn,
        available_hours_per_week: editHours,
      });
      setProfile(updated);
      setEditModalOpen(false);

      toast.success("Profile Updated", {
        description: "Your skills and matching preferences have been updated.",
      });

      const recRes = await getRecommendedOpportunities();
      setRecommendations(recRes.recommendations || []);
    } catch (err) {
      toast.error("Update Failed", {
        description: "Could not save your skill preferences.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveExpProfile = async (updates: Partial<StudentExperienceProfile>) => {
    setSavingExperience(true);
    try {
      const updated = await updateStudentExperienceProfile(updates);
      setExperienceProfile(updated);
      toast.success("Profile Updated", {
        description: "Your student experience profile has been saved.",
      });
      const recRes = await getRecommendedOpportunities().catch(() => null);
      if (recRes) setRecommendations(recRes.recommendations || []);
    } catch (err: any) {
      toast.error("Failed to Save", {
        description: err.message || "Could not update experience profile.",
      });
    } finally {
      setSavingExperience(false);
    }
  };

  const handleUploadResumeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Invalid File Type", { description: "Only PDF resumes are supported." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File Too Large", { description: "Resume must not exceed 10 MB." });
      return;
    }
    setUploadingResume(true);
    try {
      const res = await uploadStudentResume(file);
      const updated = await getStudentExperienceProfile();
      setExperienceProfile(updated);
      toast.success("Resume Uploaded", { description: `Uploaded "${res.filename}" successfully.` });
    } catch (err: any) {
      toast.error("Upload Failed", { description: err.message || "Failed to upload resume." });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDeleteResumeFile = async () => {
    try {
      await deleteStudentResume();
      const updated = await getStudentExperienceProfile();
      setExperienceProfile(updated);
      toast.success("Resume Removed", { description: "Resume was removed from your profile." });
    } catch (err: any) {
      toast.error("Delete Failed", { description: err.message || "Failed to delete resume." });
    }
  };

  const handleAddProject = () => {
    if (!projTitle.trim()) return;
    const newProj: ProjectEntry = {
      id: `proj-${Date.now()}`,
      title: projTitle.trim(),
      description: projDesc.trim(),
      technologies: projTech.split(",").map((s) => s.trim()).filter(Boolean),
      role: projRole.trim() || "Developer",
      link: projLink.trim() || null,
    };
    const currentProjs = experienceProfile?.projects || [];
    handleSaveExpProfile({ projects: [...currentProjs, newProj] });
    setProjTitle("");
    setProjDesc("");
    setProjTech("");
    setProjLink("");
    setAddProjectOpen(false);
  };

  const handleDeleteProject = (projId: string) => {
    const currentProjs = experienceProfile?.projects || [];
    handleSaveExpProfile({ projects: currentProjs.filter((p) => p.id !== projId) });
  };

  const handleAddWork = () => {
    if (!workRole.trim() || !workCompany.trim()) return;
    const newW: WorkExperienceEntry = {
      id: `work-${Date.now()}`,
      role: workRole.trim(),
      company: workCompany.trim(),
      location: workLocation.trim() || null,
      start_date: workStart.trim() || "2024-06-01",
      end_date: workEnd.trim() || null,
      is_current: !workEnd.trim(),
      description: workDesc.trim(),
    };
    const currentWork = experienceProfile?.work_experience || [];
    handleSaveExpProfile({ work_experience: [...currentWork, newW] });
    setWorkRole("");
    setWorkCompany("");
    setWorkDesc("");
    setAddWorkOpen(false);
  };

  const handleDeleteWork = (workId: string) => {
    const currentWork = experienceProfile?.work_experience || [];
    handleSaveExpProfile({ work_experience: currentWork.filter((w) => w.id !== workId) });
  };

  const handleAddCert = () => {
    if (!certTitle.trim() || !certIssuer.trim()) return;
    const newC: CertificationEntry = {
      id: `cert-${Date.now()}`,
      title: certTitle.trim(),
      issuer: certIssuer.trim(),
      issue_date: certDate.trim() || "2024-03-15",
      credential_url: certUrl.trim() || null,
    };
    const currentCerts = experienceProfile?.certifications || [];
    handleSaveExpProfile({ certifications: [...currentCerts, newC] });
    setCertTitle("");
    setCertIssuer("");
    setCertUrl("");
    setAddCertOpen(false);
  };

  const handleDeleteCert = (certId: string) => {
    const currentCerts = experienceProfile?.certifications || [];
    handleSaveExpProfile({ certifications: currentCerts.filter((c) => c.id !== certId) });
  };

  const handleAddExpSkill = () => {
    const trimmed = expSkillInput.trim();
    if (!trimmed) return;
    const currentSkills = experienceProfile?.skills || [];
    if (!currentSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      handleSaveExpProfile({ skills: [...currentSkills, trimmed] });
    }
    setExpSkillInput("");
  };

  const handleRemoveExpSkill = (skill: string) => {
    const currentSkills = experienceProfile?.skills || [];
    handleSaveExpProfile({ skills: currentSkills.filter((s) => s !== skill) });
  };

  const handleAddAchievement = () => {
    const trimmed = achievementInput.trim();
    if (!trimmed) return;
    const currentAchs = experienceProfile?.achievements || [];
    handleSaveExpProfile({ achievements: [...currentAchs, trimmed] });
    setAchievementInput("");
  };

  const handleRemoveAchievement = (ach: string) => {
    const currentAchs = experienceProfile?.achievements || [];
    handleSaveExpProfile({ achievements: currentAchs.filter((a) => a !== ach) });
  };

  const filteredExplore = allOpportunities.filter((opp) => {
    const matchesCat = selectedCategory === "all" || opp.category.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      opp.title.toLowerCase().includes(q) ||
      opp.description.toLowerCase().includes(q) ||
      opp.required_skills.some((s) => s.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================
          1. HEADER & SKILLS BAR
      ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-sky-950/40 border border-teal-800/40 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Campus Opportunity Engine
            </h1>
            <Badge variant="primary" size="sm" dot>
              AI Matched
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            Research positions, hackathons, and projects matched against your skills and academic schedule.
          </p>
        </div>

        {/* Skills & Availability Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditModalOpen(true)}
            leftIcon={<Sliders className="w-3.5 h-3.5 text-teal-400" />}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs"
          >
            Matching Preferences
          </Button>
        </div>
      </div>

      {/* Active Skills Strip */}
      {profile && (
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Your Active Skills:</span>
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-md bg-teal-950/60 border border-teal-800/50 text-teal-300 font-mono text-[11px]"
              >
                {skill}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>
              Availability: <strong className="text-slate-200">{profile.available_hours_per_week} hrs/week</strong>
            </span>
            <span>
              Opt-In:{" "}
              <strong className={profile.opt_in_matching ? "text-teal-400" : "text-amber-400"}>
                {profile.opt_in_matching ? "Active" : "Paused"}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* ========================================================
          2. NAVIGATION TABS & FILTER BAR
      ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("recommended")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "recommended"
                ? "bg-teal-500 text-slate-950 shadow-sm"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Recommendations ({recommendations.length})
          </button>
          <button
            onClick={() => setActiveTab("explore")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "explore"
                ? "bg-teal-500 text-slate-950 shadow-sm"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            All Opportunities ({allOpportunities.length})
          </button>
          <button
            onClick={() => setActiveTab("experience")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "experience"
                ? "bg-teal-500 text-slate-950 shadow-sm"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Student Experience
          </button>
          <button
            onClick={() => setActiveTab("applied")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "applied"
                ? "bg-teal-500 text-slate-950 shadow-sm"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Applied ({appliedList.length})
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "saved"
                ? "bg-teal-500 text-slate-950 shadow-sm"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            Saved ({savedOpportunities.length})
          </button>
        </div>

        {activeTab === "explore" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search skills or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 w-44"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Categories</option>
              <option value="research">Research</option>
              <option value="project">Project</option>
              <option value="hackathon">Hackathon</option>
              <option value="tutoring">Tutoring</option>
            </select>
          </div>
        )}
      </div>

      {/* ========================================================
          3. CONTENT DISPLAY
      ======================================================== */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton variant="card" height={220} />
          <Skeleton variant="card" height={220} />
          <Skeleton variant="card" height={220} />
          <Skeleton variant="card" height={220} />
        </div>
      ) : activeTab === "recommended" ? (
        recommendations.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
            <Compass className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">No Recommendations Available</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Make sure opt-in matching is enabled in your preferences and add skills to receive smart recommendations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec) => {
              const opp = rec.opportunity;
              const isSaved = savedIds.has(opp.id);
              const isApplied = appliedOppIds.has(opp.id);
              const scoreColor =
                rec.match_score >= 85
                  ? "bg-teal-950/80 text-teal-300 border-teal-600/60"
                  : rec.match_score >= 70
                  ? "bg-sky-950/80 text-sky-300 border-sky-600/60"
                  : "bg-slate-800 text-slate-300 border-slate-700";

              return (
                <Card
                  key={opp.id}
                  className="p-5 bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Score & Category */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono ${scoreColor}`}
                        >
                          {rec.match_score}% Match
                        </span>
                        <span className="text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {opp.category}
                        </span>
                        {rec.eligibility && (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border font-mono ${
                              rec.eligibility.status === "ELIGIBLE"
                                ? "bg-emerald-950/80 text-emerald-300 border-emerald-600/60"
                                : rec.eligibility.status === "NOT_ELIGIBLE"
                                ? "bg-rose-950/80 text-rose-300 border-rose-600/60"
                                : "bg-amber-950/80 text-amber-300 border-amber-600/60"
                            }`}
                          >
                            {rec.eligibility.status.replace("_", " ")}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleToggleSave(opp.id)}
                        aria-label={isSaved ? "Remove from saved" : "Save opportunity"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isSaved
                            ? "bg-teal-500/20 text-teal-400 border border-teal-500/40"
                            : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700"
                        }`}
                        title={isSaved ? "Saved" : "Save opportunity"}
                      >
                        <Bookmark className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>

                    {/* Title & Organization */}
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-100 hover:text-teal-300 transition-colors">
                        {opp.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {opp.organization} {opp.mentor_name && `· Mentor: ${opp.mentor_name}`}
                      </p>
                    </div>

                    {/* Schedule Conflict / Fit Indicator */}
                    {rec.schedule_collision_warning ? (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-start gap-2 text-xs text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold">Schedule Warning:</strong>{" "}
                          {rec.schedule_collision_warning}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-teal-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                        <span>Fits your weekly academic timetable</span>
                      </div>
                    )}

                    {/* Academic Advisory */}
                    {rec.academic_advisory && (
                      <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-900/50 flex items-start gap-2 text-xs text-red-300">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold">Academic Advisory:</strong> {rec.academic_advisory}
                        </div>
                      </div>
                    )}

                    {/* Skills Breakdown */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-400 font-medium">Required Skills:</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {opp.required_skills.map((skill) => {
                          const isMatched = rec.matched_skills.some(
                            (s) => s.toLowerCase() === skill.toLowerCase()
                          );
                          return (
                            <span
                              key={skill}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${
                                isMatched
                                  ? "bg-teal-950/60 text-teal-300 border-teal-700/60 font-semibold"
                                  : "bg-slate-800/60 text-slate-400 border-slate-700"
                              }`}
                            >
                              {isMatched && <Check className="w-3 h-3 text-teal-400" />}
                              {skill}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Transparent Explanation */}
                    <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      <strong className="text-slate-300">Recommendation Reason:</strong>{" "}
                      {rec.recommendation_reason}
                    </div>
                  </div>

                  {/* Footer Meta & Action */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {opp.time_commitment_hrs_week}h/week
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {opp.location}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isApplied ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-mono">
                          <Check className="w-3.5 h-3.5" />
                          Applied
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenApplyModal(opp)}
                          className="text-xs px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                        >
                          Apply Now
                        </Button>
                      )}

                      {opp.application_link && (
                        <a
                          href={opp.application_link}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Official portal for ${opp.title}`}
                          className="p-1 text-slate-400 hover:text-teal-300 transition-colors"
                          title="View Official Portal"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : activeTab === "explore" ? (
        filteredExplore.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
            <Compass className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">No Opportunities Found</div>
            <p className="text-xs text-slate-400">Try adjusting your keyword search or category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExplore.map((opp) => {
              const isSaved = savedIds.has(opp.id);
              const isApplied = appliedOppIds.has(opp.id);
              return (
                <Card
                  key={opp.id}
                  className="p-5 bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {opp.category}
                      </span>
                      <button
                        onClick={() => handleToggleSave(opp.id)}
                        aria-label={isSaved ? "Remove from saved" : "Save opportunity"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isSaved
                            ? "bg-teal-500/20 text-teal-400 border border-teal-500/40"
                            : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700"
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>

                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-100">{opp.title}</h3>
                      <p className="text-xs text-slate-400">
                        {opp.organization} {opp.mentor_name && `· Mentor: ${opp.mentor_name}`}
                      </p>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2">{opp.description}</p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {opp.required_skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {opp.time_commitment_hrs_week}h/week · {opp.location}
                    </span>

                    <div className="flex items-center gap-2">
                      {isApplied ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-mono">
                          <Check className="w-3.5 h-3.5" />
                          Applied
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenApplyModal(opp)}
                          className="text-xs px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                        >
                          Apply Now
                        </Button>
                      )}

                      {opp.application_link && (
                        <a
                          href={opp.application_link}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Official portal for ${opp.title}`}
                          className="p-1 text-slate-400 hover:text-teal-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : activeTab === "applied" ? (
        appliedList.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
            <FileCheck2 className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">No Applications Submitted</div>
            <p className="text-xs text-slate-400">
              Browse recommendations or explore campus opportunities and click &quot;Apply Now&quot; to submit your interest.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appliedList.map((app) => (
              <Card key={app.id} className="p-5 bg-slate-900/80 border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold uppercase">
                      {app.status}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Applied {new Date(app.applied_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-100">{app.opportunity_title}</h3>
                    <p className="text-xs text-slate-400">{app.organization}</p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <div className="text-[11px] font-medium text-slate-400">Your Statement of Interest:</div>
                    <p className="italic text-slate-300 leading-relaxed">&ldquo;{app.statement_of_interest}&rdquo;</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Committed: <strong className="text-slate-200">{app.available_hours_per_week} hrs/week</strong></span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pending Faculty Review
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : activeTab === "experience" ? (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-teal-950/40 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Student Experience &amp; Verified Credentials</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Institutional academic records, verified CGPA, project showcase, work experience, and resume management for opportunity matching and candidate discovery.
            </p>
          </div>

          {/* 1. Institutional Records (Locked / Read-Only) */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">Institutional Academic Record (TIET)</h3>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                <Lock className="w-3 h-3 text-emerald-400" />
                Verified &amp; Locked
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">Program &amp; Degree</div>
                <div className="font-semibold text-slate-200">
                  {experienceProfile?.education?.[0]?.program || "B.Tech"} - {experienceProfile?.education?.[0]?.branch || "Computer Engineering"}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">Current Semester</div>
                <div className="font-semibold text-slate-200">
                  Semester {experienceProfile?.education?.[0]?.semester || 5}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">Graduation Year</div>
                <div className="font-semibold text-slate-200">
                  Class of {experienceProfile?.education?.[0]?.graduation_year || 2026}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">Institutional CGPA</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-teal-300">
                    {experienceProfile?.education?.[0]?.cgpa_verified
                      ? experienceProfile.education[0].cgpa_verified.toFixed(2)
                      : experienceProfile?.cgpa_verified
                      ? experienceProfile.cgpa_verified.toFixed(2)
                      : "8.52"}
                  </span>
                  <span className="text-[10px] text-slate-400">/ 10.00</span>
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/50 flex items-start gap-2 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
              <span>
                Official CGPA and branch records are synchronized directly from institute records. Students cannot manually alter verified academic metrics.
              </span>
            </div>
          </Card>

          {/* 2. Resume Section */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-200">Official Resume</h3>
              </div>
              <span className="text-[11px] text-slate-400">PDF up to 10MB</span>
            </div>

            {experienceProfile?.resume_file_name || experienceProfile?.resume_filename ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-950/60 border border-teal-800/50 text-teal-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-xs text-slate-200">
                      {experienceProfile.resume_file_name || experienceProfile.resume_filename}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Uploaded {experienceProfile.resume_updated_at || experienceProfile.resume_uploaded_at ? new Date(experienceProfile.resume_updated_at || experienceProfile.resume_uploaded_at!).toLocaleDateString() : "Recently"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/api/opportunities/profile/experience/resume"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-400" />
                    Download / Preview
                  </a>
                  <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-teal-400" />
                    Replace
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleUploadResumeFile}
                      disabled={uploadingResume}
                      className="hidden"
                    />
                  </label>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteResumeFile}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-xs"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 border-2 border-dashed border-slate-800 rounded-xl text-center space-y-2 hover:border-slate-700 transition-colors">
                <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-xs font-semibold text-slate-300">No Resume Uploaded</div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Upload your latest resume in PDF format (under 10MB) to share with faculty mentors and recruiters.
                </p>
                <div className="pt-1">
                  <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 cursor-pointer font-bold shadow transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingResume ? "Uploading..." : "Upload Resume PDF"}
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleUploadResumeFile}
                      disabled={uploadingResume}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </Card>

          {/* 3. Skills */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-200">Technical Skills</h3>
              </div>
              <span className="text-[11px] text-slate-400">{experienceProfile?.skills?.length || 0} skills</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a technical skill (e.g. PyTorch, TypeScript, Docker)..."
                value={expSkillInput}
                onChange={(e) => setExpSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddExpSkill())}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              <Button size="sm" onClick={handleAddExpSkill} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add Skill
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(experienceProfile?.skills || []).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-950/60 border border-teal-800/60 text-teal-300 font-mono text-xs"
                >
                  {skill}
                  <button
                    onClick={() => handleRemoveExpSkill(skill)}
                    aria-label={`Remove ${skill}`}
                    className="text-teal-400 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </Card>

          {/* 4. Projects Showcase */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-200">Projects Showcase</h3>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAddProjectOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Add Project
              </Button>
            </div>

            {(!experienceProfile?.projects || experienceProfile.projects.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-950/40 border border-slate-800/60">
                No projects added yet. Showcase your capstone, hackathon, or open-source projects.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {experienceProfile.projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs text-slate-100">{proj.title}</h4>
                        <button
                          onClick={() => handleDeleteProject(proj.id)}
                          aria-label={`Delete project ${proj.title}`}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[11px] text-teal-400 font-medium">Role: {proj.role}</div>
                      <p className="text-xs text-slate-300 leading-relaxed">{proj.description}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.technologies.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    {proj.link && (
                      <div className="pt-2 border-t border-slate-800/60">
                        <a
                          href={proj.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Project Repository
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 5. Work Experience & Internships */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-200">Work Experience &amp; Internships</h3>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAddWorkOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Add Experience
              </Button>
            </div>

            {(!experienceProfile?.work_experience || experienceProfile.work_experience.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-950/40 border border-slate-800/60">
                No work experience or internships added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {experienceProfile.work_experience.map((work) => (
                  <div
                    key={work.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-slate-100">{work.role}</div>
                      <div className="text-slate-400 font-medium">
                        {work.company} {work.location && `· ${work.location}`}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {work.start_date} – {work.is_current ? "Present" : work.end_date || "Completed"}
                      </div>
                      <p className="text-slate-300 pt-1 leading-relaxed">{work.description}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteWork(work.id)}
                      aria-label={`Delete experience ${work.role}`}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 6. Certifications */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-200">Certifications &amp; Licenses</h3>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAddCertOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Add Certification
              </Button>
            </div>

            {(!experienceProfile?.certifications || experienceProfile.certifications.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-950/40 border border-slate-800/60">
                No certifications added yet. Add industry certifications from AWS, Google, Coursera, etc.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {experienceProfile.certifications.map((cert) => (
                  <div
                    key={cert.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-slate-100">{cert.title}</div>
                      <div className="text-slate-400 font-medium">{cert.issuer}</div>
                      <div className="text-[11px] text-slate-500">Issued: {cert.issue_date}</div>
                      {cert.credential_url && (
                        <a
                          href={cert.credential_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 pt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Credential
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCert(cert.id)}
                      aria-label={`Delete certification ${cert.title}`}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 7. Achievements & Extracurricular Activities */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-200">Achievements &amp; Extracurricular Activities</h3>
              </div>
              <span className="text-[11px] text-slate-400">{experienceProfile?.achievements?.length || 0} items</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add an achievement (e.g. Hackathon Finalist, Technical Society Lead)..."
                value={achievementInput}
                onChange={(e) => setAchievementInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAchievement())}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              <Button size="sm" onClick={handleAddAchievement} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add
              </Button>
            </div>

            <div className="space-y-1.5">
              {(experienceProfile?.achievements || []).map((ach, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    {ach}
                  </span>
                  <button
                    onClick={() => handleRemoveAchievement(ach)}
                    aria-label={`Remove achievement ${ach}`}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* 8. Preferred Opportunity Types & Candidate Discovery */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-5">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-200">Preferred Opportunity Types</h3>
              <p className="text-[11px] text-slate-400">
                Select the types of campus opportunities you are actively interested in.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Research", "Internship", "Hackathon", "Project", "Club", "Tutoring"].map((type) => {
                  const currentTypes = experienceProfile?.preferred_opportunity_types || [];
                  const isSelected = currentTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        const next = isSelected
                          ? currentTypes.filter((t) => t !== type)
                          : [...currentTypes, type];
                        handleSaveExpProfile({ preferred_opportunity_types: next });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? "bg-teal-500 text-slate-950 border-teal-400 font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Candidate Discovery Opt-In */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-200">Candidate Discovery by Creators</div>
                <div className="text-[11px] text-slate-400">
                  Allow professors and opportunity managers to discover your profile and send invitations.
                </div>
              </div>
              <input
                type="checkbox"
                checked={experienceProfile?.discovery_opt_in ?? true}
                onChange={(e) => handleSaveExpProfile({ discovery_opt_in: e.target.checked })}
                aria-label="Allow candidate discovery by creators"
                className="w-4 h-4 rounded text-teal-500 focus:ring-teal-400 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>
          </Card>
        </div>
      ) : activeTab === "saved" ? (
        savedOpportunities.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
            <Bookmark className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">No Saved Opportunities</div>
            <p className="text-xs text-slate-400">Click the bookmark icon on any opportunity to save it for later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedOpportunities.map((opp) => {
              const isApplied = appliedOppIds.has(opp.id);
              return (
                <Card key={opp.id} className="p-5 bg-slate-900/80 border-slate-800 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {opp.category}
                      </span>
                      <button
                        onClick={() => handleToggleSave(opp.id)}
                        aria-label="Remove from saved"
                        className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40"
                      >
                        <Bookmark className="w-3.5 h-3.5" fill="currentColor" />
                      </button>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-100">{opp.title}</h3>
                      <p className="text-xs text-slate-400">
                        {opp.organization} {opp.mentor_name && `· Mentor: ${opp.mentor_name}`}
                      </p>
                    </div>
                    <p className="text-xs text-slate-300">{opp.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {opp.location}
                    </span>

                    <div className="flex items-center gap-2">
                      {isApplied ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-mono">
                          <Check className="w-3.5 h-3.5" />
                          Applied
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenApplyModal(opp)}
                          className="text-xs px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                        >
                          Apply Now
                        </Button>
                      )}

                      {opp.application_link && (
                        <a
                          href={opp.application_link}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Official portal for ${opp.title}`}
                          className="p-1 text-slate-400 hover:text-teal-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {/* ========================================================
          4. APPLY MODAL
      ======================================================== */}
      {selectedOppToApply && (
        <Modal
          isOpen={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
          title={`Apply: ${selectedOppToApply.title}`}
          size="md"
        >
          <div className="space-y-4 text-xs text-slate-300">
            {/* Opportunity Context Header */}
            <div className="p-3 rounded-lg bg-teal-950/40 border border-teal-800/40 space-y-1">
              <div className="font-semibold text-slate-100">{selectedOppToApply.organization}</div>
              <p className="text-slate-400">
                {selectedOppToApply.location} · {selectedOppToApply.time_commitment_hrs_week} hours/week requirement
              </p>
            </div>

            {/* Candidate Pre-filled Profile */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="font-semibold text-slate-200">Candidate Information</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div>Student: <strong className="text-slate-200">Arjun Mehta</strong></div>
                <div>Roll No: <strong className="text-slate-200">102203099</strong></div>
                <div>Branch: <strong className="text-slate-200">COE (Semester 5)</strong></div>
                <div>Campus: <strong className="text-slate-200">Thapar Institute (TIET)</strong></div>
              </div>
            </div>

            {/* Statement of Interest */}
            <div className="space-y-1.5">
              <label htmlFor="apply-statement" className="font-semibold text-slate-200">
                Statement of Interest &amp; Relevant Experience
              </label>
              <textarea
                id="apply-statement"
                rows={4}
                value={statementInput}
                onChange={(e) => setStatementInput(e.target.value)}
                placeholder="Describe your motivation and any relevant projects or coursework..."
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed resize-none"
              />
            </div>

            {/* Weekly Commitment Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="apply-hrs" className="font-semibold text-slate-200">
                  Weekly Available Hours
                </label>
                <span className="font-mono text-teal-400 font-bold">{commitmentInput} hrs/wk</span>
              </div>
              <input
                id="apply-hrs"
                type="range"
                min={2}
                max={25}
                step={1}
                value={commitmentInput}
                onChange={(e) => setCommitmentInput(Number(e.target.value))}
                className="w-full accent-teal-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setApplyModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmApply}
                isLoading={submittingApp}
                leftIcon={<Send className="w-3.5 h-3.5" />}
                className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
              >
                Submit Application
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================
          5. EDIT SKILLS & AVAILABILITY MODAL
      ======================================================== */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Matching Preferences & Skills"
        size="md"
      >
        <div className="space-y-5 text-xs text-slate-300">
          {/* Opt-in toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div>
              <div className="font-semibold text-slate-200">Opt-In for Opportunity Matching</div>
              <div className="text-[11px] text-slate-400">
                Allow algorithm to match your skills with campus research and projects
              </div>
            </div>
            <input
              type="checkbox"
              checked={editOptIn}
              onChange={(e) => setEditOptIn(e.target.checked)}
              aria-label="Opt-in for opportunity matching"
              className="w-4 h-4 rounded text-teal-500 focus:ring-teal-400 bg-slate-900 border-slate-700"
            />
          </div>

          {/* Availability hours slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="avail-hours-slider" className="font-semibold text-slate-200">Available Time Commitment</label>
              <span className="font-mono text-teal-400 font-bold">{editHours} hours / week</span>
            </div>
            <input
              id="avail-hours-slider"
              type="range"
              min={2}
              max={25}
              step={1}
              value={editHours}
              onChange={(e) => setEditHours(Number(e.target.value))}
              aria-label="Available time commitment in hours per week"
              className="w-full accent-teal-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Light (2 hrs)</span>
              <span>Balanced (10 hrs)</span>
              <span>Intensive (25 hrs)</span>
            </div>
          </div>

          {/* Add Skill Tags */}
          <div className="space-y-2">
            <label htmlFor="skill-input-box" className="font-semibold text-slate-200">Your Technical Skills & Strengths</label>
            <div className="flex gap-2">
              <input
                id="skill-input-box"
                type="text"
                placeholder="Add a skill (e.g. PyTorch, Next.js, C++)"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                aria-label="New skill name to add"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              <Button size="sm" variant="secondary" onClick={handleAddSkill}>
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {editSkills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-950/60 border border-teal-800/60 text-teal-300 font-mono text-[11px]"
                >
                  {s}
                  <button
                    onClick={() => handleRemoveSkill(s)}
                    aria-label={`Remove skill ${s}`}
                    className="text-teal-400 hover:text-red-400 transition-colors ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveProfile} isLoading={savingProfile}>
              Save Preferences
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================
          6. ADD PROJECT MODAL
      ======================================================== */}
      <Modal
        isOpen={addProjectOpen}
        onClose={() => setAddProjectOpen(false)}
        title="Add Project"
        size="md"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Project Title *</label>
            <input
              type="text"
              placeholder="e.g. Distributed Task Queue"
              value={projTitle}
              onChange={(e) => setProjTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Your Role</label>
            <input
              type="text"
              placeholder="e.g. Backend Lead, Full Stack Developer"
              value={projRole}
              onChange={(e) => setProjRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Technologies (comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. Python, Redis, Docker, FastAPI"
              value={projTech}
              onChange={(e) => setProjTech(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Project or Repository URL (optional)</label>
            <input
              type="url"
              placeholder="https://github.com/username/project"
              value={projLink}
              onChange={(e) => setProjLink(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Description</label>
            <textarea
              rows={3}
              placeholder="What did you build, what challenges did you solve, and what was the impact?"
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed resize-none"
            />
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddProjectOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddProject} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold">
              Save Project
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================
          7. ADD WORK EXPERIENCE MODAL
      ======================================================== */}
      <Modal
        isOpen={addWorkOpen}
        onClose={() => setAddWorkOpen(false)}
        title="Add Work Experience / Internship"
        size="md"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">Role / Position *</label>
              <input
                type="text"
                placeholder="e.g. Machine Learning Intern"
                value={workRole}
                onChange={(e) => setWorkRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">Company / Organization *</label>
              <input
                type="text"
                placeholder="e.g. TIET Research Lab, Microsoft"
                value={workCompany}
                onChange={(e) => setWorkCompany(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Location</label>
            <input
              type="text"
              placeholder="e.g. Patiala, Punjab or Remote"
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">Start Date</label>
              <input
                type="text"
                placeholder="YYYY-MM (e.g. 2024-06)"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">End Date (leave blank if current)</label>
              <input
                type="text"
                placeholder="YYYY-MM or Present"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Description</label>
            <textarea
              rows={3}
              placeholder="Describe your responsibilities, tools used, and deliverables achieved..."
              value={workDesc}
              onChange={(e) => setWorkDesc(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed resize-none"
            />
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddWorkOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddWork} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold">
              Save Experience
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================
          8. ADD CERTIFICATION MODAL
      ======================================================== */}
      <Modal
        isOpen={addCertOpen}
        onClose={() => setAddCertOpen(false)}
        title="Add Certification"
        size="md"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Certification Name *</label>
            <input
              type="text"
              placeholder="e.g. AWS Certified Cloud Practitioner"
              value={certTitle}
              onChange={(e) => setCertTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Issuing Organization *</label>
            <input
              type="text"
              placeholder="e.g. Amazon Web Services, Google Cloud, DeepLearning.AI"
              value={certIssuer}
              onChange={(e) => setCertIssuer(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Issue Date</label>
            <input
              type="text"
              placeholder="YYYY-MM (e.g. 2024-03)"
              value={certDate}
              onChange={(e) => setCertDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Credential URL (optional)</label>
            <input
              type="url"
              placeholder="https://www.credly.com/badges/..."
              value={certUrl}
              onChange={(e) => setCertUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddCertOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCert} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold">
              Save Certification
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
