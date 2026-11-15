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
  Users,
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
import { useAuth } from "../../context/AuthContext";
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
  createOpportunity,
  updateOpportunity,
  publishOpportunity,
  closeOpportunity,
  archiveOpportunity,
  previewOpportunityMatching,
  getOpportunityCandidatesFiltered,
  sendOpportunityInvitations,
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
  CandidateDiscoveryResponse,
} from "../../types";

export default function OpportunitiesPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"recommended" | "explore" | "experience" | "saved" | "applied" | "admin">("recommended");
  const [recommendations, setRecommendations] = useState<OpportunityRecommendation[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [appliedList, setAppliedList] = useState<OpportunityApplication[]>([]);
  const [profile, setProfile] = useState<StudentSkillProfile | null>(null);

  // Admin Opportunity Creator & Live Matching Preview State
  const [createOppOpen, setCreateOppOpen] = useState(false);
  const [editingOppId, setEditingOppId] = useState<string | null>(null);
  const [oppTitle, setOppTitle] = useState("");
  const [oppOrg, setOppOrg] = useState("");
  const [oppCategory, setOppCategory] = useState("project");
  const [oppRoleType, setOppRoleType] = useState("internship");
  const [oppLocation, setOppLocation] = useState("Patiala, Punjab");
  const [oppStipend, setOppStipend] = useState("₹15,000 / month");
  const [oppHours, setOppHours] = useState(10);
  const [oppDeadline, setOppDeadline] = useState("2026-12-01");
  const [oppSkills, setOppSkills] = useState("Python, FastAPI, Next.js");
  const [oppMinCgpa, setOppMinCgpa] = useState<number | undefined>(7.5);
  const [oppBranches, setOppBranches] = useState("COE, CSE, ENC");
  const [oppMaxBacklogs, setOppMaxBacklogs] = useState<number>(0);
  const [oppMinAttendance, setOppMinAttendance] = useState<number>(75);
  const [oppPreferred, setOppPreferred] = useState("");
  const [oppDesc, setOppDesc] = useState("");
  const [previewData, setPreviewData] = useState<CandidateDiscoveryResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingOpp, setSavingOpp] = useState(false);

  // Candidate Discovery Modal State
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [selectedOppForCandidates, setSelectedOppForCandidates] = useState<Opportunity | null>(null);
  const [candidatesList, setCandidatesList] = useState<any[]>([]);
  const [candidateStats, setCandidateStats] = useState<{ eligible: number; not_eligible: number; incomplete: number } | null>(null);
  const [candidateFilterStatus, setCandidateFilterStatus] = useState("all");
  const [candidateFilterBranch, setCandidateFilterBranch] = useState("all");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [invitedCandidateIds, setInvitedCandidateIds] = useState<Set<string>>(new Set());

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

  const handleLiveMatchingPreview = async () => {
    setPreviewLoading(true);
    try {
      const draft: any = {
        title: oppTitle || "Draft Opportunity",
        organization: oppOrg || "Campus Organization",
        category: oppCategory,
        role_type: oppRoleType,
        location: oppLocation,
        stipend: oppStipend,
        time_commitment_hrs_week: Number(oppHours) || 10,
        application_deadline: oppDeadline,
        required_skills: oppSkills.split(",").map((s) => s.trim()).filter(Boolean),
        preferred_qualifications: oppPreferred ? oppPreferred.split(",").map((s) => s.trim()).filter(Boolean) : [],
        description: oppDesc || "Draft description",
        criteria: {
          min_cgpa: oppMinCgpa ? Number(oppMinCgpa) : null,
          allowed_branches: oppBranches ? oppBranches.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : null,
          max_active_backlogs: Number(oppMaxBacklogs) || 0,
          min_attendance_percentage: Number(oppMinAttendance) || 75,
        },
      };
      const res = await previewOpportunityMatching(draft);
      setPreviewData(res);
      toast.success("Matching Preview Evaluated", {
        description: `Found ${res.total_eligible_candidates} eligible candidates across campus pool.`,
      });
    } catch (err: any) {
      toast.error("Preview Failed", { description: err.message || "Failed to preview matching." });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveOpportunity = async (asPublished: boolean = true) => {
    if (!oppTitle.trim() || !oppOrg.trim()) {
      toast.error("Missing Fields", { description: "Please provide both title and organization." });
      return;
    }
    setSavingOpp(true);
    try {
      const payload: any = {
        title: oppTitle.trim(),
        organization: oppOrg.trim(),
        category: oppCategory,
        role_type: oppRoleType,
        location: oppLocation.trim(),
        stipend: oppStipend.trim(),
        time_commitment_hrs_week: Number(oppHours) || 10,
        application_deadline: oppDeadline,
        required_skills: oppSkills.split(",").map((s) => s.trim()).filter(Boolean),
        preferred_qualifications: oppPreferred ? oppPreferred.split(",").map((s) => s.trim()).filter(Boolean) : [],
        description: oppDesc.trim(),
        status: asPublished ? "open" : "draft",
        criteria: {
          min_cgpa: oppMinCgpa ? Number(oppMinCgpa) : null,
          allowed_branches: oppBranches ? oppBranches.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : null,
          max_active_backlogs: Number(oppMaxBacklogs) || 0,
          min_attendance_percentage: Number(oppMinAttendance) || 75,
        },
      };

      if (editingOppId) {
        await updateOpportunity(editingOppId, payload);
        toast.success("Opportunity Updated", { description: "Changes have been persisted successfully." });
      } else {
        await createOpportunity(payload);
        toast.success("Opportunity Created", {
          description: asPublished
            ? "Opportunity published to student portal."
            : "Opportunity saved as draft.",
        });
      }

      setCreateOppOpen(false);
      setEditingOppId(null);
      setPreviewData(null);
      await loadData();
    } catch (err: any) {
      toast.error("Save Failed", { description: err.message || "Failed to save opportunity." });
    } finally {
      setSavingOpp(false);
    }
  };

  const handleOpenCandidateDiscovery = async (opp: Opportunity) => {
    setSelectedOppForCandidates(opp);
    setCandidateModalOpen(true);
    setCandidateFilterStatus("all");
    setCandidateFilterBranch("all");
    setCandidateSearch("");
    setLoadingCandidates(true);
    try {
      const res = await getOpportunityCandidatesFiltered(opp.id);
      setCandidatesList(res.candidates || []);
      setCandidateStats({
        eligible: res.total_eligible_candidates || 0,
        not_eligible: res.not_eligible_count || 0,
        incomplete: res.incomplete_profile_count || 0,
      });
    } catch (err: any) {
      toast.error("Discovery Failed", { description: err.message || "Failed to load candidates." });
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleFilterCandidates = async (statusVal?: string, branchVal?: string, searchVal?: string) => {
    if (!selectedOppForCandidates) return;
    setLoadingCandidates(true);
    try {
      const res = await getOpportunityCandidatesFiltered(selectedOppForCandidates.id, {
        status: statusVal ?? candidateFilterStatus,
        branch: branchVal ?? candidateFilterBranch,
        query: searchVal ?? candidateSearch,
      });
      setCandidatesList(res.candidates || []);
    } catch (err: any) {
      toast.error("Filter Failed", { description: err.message || "Could not apply candidate filter." });
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleSendCandidateInvitation = async (studentId: string) => {
    if (!selectedOppForCandidates) return;
    try {
      await sendOpportunityInvitations(selectedOppForCandidates.id, [studentId]);
      setInvitedCandidateIds((prev) => new Set([...prev, studentId]));
      toast.success("Invitation Sent", { description: "In-app invitation notification sent to student." });
    } catch (err: any) {
      toast.error("Invitation Failed", { description: err.message || "Failed to send invitation." });
    }
  };

  const handleOppStatusChange = async (oppId: string, action: "publish" | "close" | "archive") => {
    try {
      if (action === "publish") await publishOpportunity(oppId);
      if (action === "close") await closeOpportunity(oppId);
      if (action === "archive") await archiveOpportunity(oppId);
      toast.success("Status Updated", { description: `Opportunity ${action}ed successfully.` });
      await loadData();
    } catch (err: any) {
      toast.error("Action Failed", { description: err.message || `Failed to ${action} opportunity.` });
    }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-color)] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] text-[var(--action-primary)] border border-[var(--border-color)] flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Campus Opportunity Engine
            </h1>
            <Badge variant="primary" size="sm" dot>
              AI Matched
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Research positions, hackathons, and projects matched against your skills and academic schedule.
          </p>
        </div>

        {/* Skills & Availability Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingOppId(null);
                setOppTitle("");
                setOppOrg("");
                setOppCategory("project");
                setOppRoleType("internship");
                setOppLocation("Patiala, Punjab");
                setOppStipend("₹15,000 / month");
                setOppHours(10);
                setOppDeadline(new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
                setOppSkills("Python, FastAPI, Next.js");
                setOppMinCgpa(7.5);
                setOppBranches("COE, CSE, ENC");
                setOppMaxBacklogs(0);
                setOppMinAttendance(75);
                setOppPreferred("");
                setOppDesc("");
                setPreviewData(null);
                setCreateOppOpen(true);
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Post Opportunity (Admin)
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditModalOpen(true)}
            leftIcon={<Sliders className="w-3.5 h-3.5 text-[var(--action-primary)]" />}
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
                className="px-2 py-0.5 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-[11px]"
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
              <strong className={profile.opt_in_matching ? "text-[var(--action-primary)]" : "text-amber-400"}>
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
                ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
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
                ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
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
                ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
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
                ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
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
                ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            Saved ({savedOpportunities.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "admin"
                  ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Management ({allOpportunities.length})
            </button>
          )}
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
                className="pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)] w-44"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
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
                  ? "bg-[var(--nav-selected-bg)] text-[var(--nav-selected-text)] border-[var(--border-color)]"
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
                            ? "bg-[var(--surface-secondary)] text-[var(--action-primary)] border border-[var(--border-color)]"
                            : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700"
                        }`}
                        title={isSaved ? "Saved" : "Save opportunity"}
                      >
                        <Bookmark className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>

                    {/* Title & Organization */}
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-100 hover:text-[var(--action-primary)] transition-colors">
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
                      <div className="flex items-center gap-1.5 text-xs text-[var(--action-primary)] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--action-primary)]" />
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
                                  ? "bg-[var(--surface-secondary)] text-[var(--text-primary)] border-[var(--border-color)] font-semibold"
                                  : "bg-slate-800/60 text-slate-400 border-slate-700"
                              }`}
                            >
                              {isMatched && <Check className="w-3 h-3 text-[var(--action-primary)]" />}
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
                          className="text-xs px-3 py-1 bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] font-semibold"
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
                          className="p-1 text-slate-400 hover:text-[var(--action-primary)] transition-colors"
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
                            ? "bg-[var(--surface-secondary)] text-[var(--action-primary)] border border-[var(--border-color)]"
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
                          className="text-xs px-3 py-1 bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] font-semibold"
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
                          className="p-1 text-slate-400 hover:text-[var(--action-primary)] transition-colors"
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
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-color)] space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] text-[var(--action-primary)] border border-[var(--border-color)] flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Student Experience &amp; Verified Credentials</h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
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
                  <span className="font-mono text-base font-bold text-[var(--action-primary)]">
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
              <Info className="w-3.5 h-3.5 text-[var(--action-primary)] shrink-0 mt-0.5" />
              <span>
                Official CGPA and branch records are synchronized directly from institute records. Students cannot manually alter verified academic metrics.
              </span>
            </div>
          </Card>

          {/* 2. Resume Section */}
          <Card className="p-5 bg-slate-900/70 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--action-primary)]" />
                <h3 className="text-sm font-bold text-slate-200">Official Resume</h3>
              </div>
              <span className="text-[11px] text-slate-400">PDF up to 10MB</span>
            </div>

            {experienceProfile?.resume_file_name || experienceProfile?.resume_filename ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--action-primary)] flex items-center justify-center shrink-0">
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
                    <Download className="w-3.5 h-3.5 text-[var(--action-primary)]" />
                    Download / Preview
                  </a>
                  <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-[var(--action-primary)]" />
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
                  <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] cursor-pointer font-bold shadow transition-all">
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
                <Sparkles className="w-4 h-4 text-[var(--action-primary)]" />
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
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
              />
              <Button size="sm" onClick={handleAddExpSkill} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add Skill
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(experienceProfile?.skills || []).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-xs"
                >
                  {skill}
                  <button
                    onClick={() => handleRemoveExpSkill(skill)}
                    aria-label={`Remove ${skill}`}
                    className="text-[var(--action-primary)] hover:text-red-400 transition-colors"
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
                <Briefcase className="w-4 h-4 text-[var(--action-primary)]" />
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
                      <div className="text-[11px] text-[var(--action-primary)] font-medium">Role: {proj.role}</div>
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
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--action-primary)] hover:text-[var(--action-primary)]"
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
                <Briefcase className="w-4 h-4 text-[var(--action-primary)]" />
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
                <Award className="w-4 h-4 text-[var(--action-primary)]" />
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
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--action-primary)] hover:text-[var(--action-primary)] pt-1"
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
                <Award className="w-4 h-4 text-[var(--action-primary)]" />
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
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
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
                    <CheckCircle className="w-3.5 h-3.5 text-[var(--action-primary)] shrink-0" />
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
                          ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] border-[var(--action-primary)] font-bold"
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
                className="w-4 h-4 rounded text-[var(--action-primary)] focus:ring-[var(--focus-ring)] bg-slate-900 border-slate-700 cursor-pointer"
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
                        className="p-1.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--action-primary)] border border-[var(--border-color)]"
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
                          className="text-xs px-3 py-1 bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] font-semibold"
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
                          className="p-1 text-slate-400 hover:text-[var(--action-primary)] transition-colors"
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
      ) : activeTab === "admin" && isAdmin ? (
        <div className="space-y-6">
          {/* Admin Header & Action */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--action-primary)]" />
                Administrator Opportunity Control Center
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage campus opportunities, set mandatory criteria, preview live student matching, and invite candidates.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingOppId(null);
                setOppTitle("");
                setOppOrg("");
                setOppCategory("project");
                setOppRoleType("internship");
                setOppLocation("Patiala, Punjab");
                setOppStipend("₹15,000 / month");
                setOppHours(10);
                setOppDeadline(new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
                setOppSkills("Python, FastAPI, Next.js");
                setOppMinCgpa(7.5);
                setOppBranches("COE, CSE, ENC");
                setOppMaxBacklogs(0);
                setOppMinAttendance(75);
                setOppPreferred("");
                setOppDesc("");
                setPreviewData(null);
                setCreateOppOpen(true);
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs shrink-0"
            >
              Create New Opportunity
            </Button>
          </div>

          {/* Admin Opportunities List */}
          <div className="grid grid-cols-1 gap-4">
            {allOpportunities.map((opp) => (
              <Card key={opp.id} className="p-5 bg-slate-900/90 border-slate-800 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-100">{opp.title}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider ${
                          opp.status === "open"
                            ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                            : opp.status === "draft"
                            ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {opp.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {opp.organization} · Category: <span className="capitalize">{opp.category}</span> · Role: <span className="capitalize">{opp.role_type}</span> · Stipend: {opp.stipend || "Unpaid"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleOpenCandidateDiscovery(opp)}
                      leftIcon={<Users className="w-3.5 h-3.5" />}
                      className="text-xs"
                    >
                      Candidate Discovery
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingOppId(opp.id);
                        setOppTitle(opp.title);
                        setOppOrg(opp.organization);
                        setOppCategory(opp.category);
                        setOppRoleType(opp.role_type || "internship");
                        setOppLocation(opp.location);
                        setOppStipend(opp.stipend || "");
                        setOppHours(opp.time_commitment_hrs_week);
                        setOppDeadline(opp.application_deadline || opp.deadline || new Date().toISOString().split("T")[0]);
                        setOppSkills((opp.required_skills || []).join(", "));
                        setOppMinCgpa(opp.criteria?.min_cgpa ?? 7.5);
                        setOppBranches((opp.criteria?.allowed_branches || ["COE", "CSE"]).join(", "));
                        setOppMaxBacklogs(opp.criteria?.max_active_backlogs ?? 0);
                        setOppMinAttendance(opp.criteria?.min_attendance_percentage ?? 75);
                        setOppPreferred((opp.preferred_qualifications || []).join(", "));
                        setOppDesc(opp.description);
                        setPreviewData(null);
                        setCreateOppOpen(true);
                      }}
                      className="text-xs"
                    >
                      Edit
                    </Button>
                    {opp.status !== "open" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOppStatusChange(opp.id, "publish")}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Publish
                      </Button>
                    )}
                    {opp.status === "open" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOppStatusChange(opp.id, "close")}
                        className="text-xs text-amber-400 hover:text-amber-300"
                      >
                        Close
                      </Button>
                    )}
                    {opp.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOppStatusChange(opp.id, "archive")}
                        className="text-xs text-slate-400 hover:text-rose-400"
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>

                {/* Criteria strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Min Verified CGPA</span>
                    <span className="font-semibold text-[var(--action-primary)]">
                      {opp.criteria?.min_cgpa ? `${opp.criteria.min_cgpa.toFixed(2)}` : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Allowed Branches</span>
                    <span className="font-semibold text-slate-200">
                      {opp.criteria?.allowed_branches?.join(", ") || "All Branches"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Max Backlogs</span>
                    <span className="font-semibold text-slate-200">
                      {opp.criteria?.max_active_backlogs ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Min Attendance</span>
                    <span className="font-semibold text-slate-200">
                      {opp.criteria?.min_attendance_percentage ? `${opp.criteria.min_attendance_percentage}%` : "75%"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[11px]">Required Skills:</span>
                  {(opp.required_skills || []).map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* ========================================================
          ADMIN MODAL: CREATE / EDIT OPPORTUNITY WITH LIVE MATCHING PREVIEW
      ======================================================== */}
      {createOppOpen && (
        <Modal
          isOpen={createOppOpen}
          onClose={() => {
            setCreateOppOpen(false);
            setEditingOppId(null);
            setPreviewData(null);
          }}
          title={editingOppId ? "Edit Opportunity" : "Create Opportunity with Live Matching"}
          size="lg"
        >
          <div className="space-y-4 text-xs text-slate-300 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Opportunity Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. LLM Systems Research Fellow"
                  value={oppTitle}
                  onChange={(e) => setOppTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Organization / Lab *
                </label>
                <input
                  type="text"
                  placeholder="e.g. TIET Center for AI and Data Science"
                  value={oppOrg}
                  onChange={(e) => setOppOrg(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={oppCategory}
                  onChange={(e) => setOppCategory(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                >
                  <option value="project">Project</option>
                  <option value="research">Research</option>
                  <option value="internship">Internship</option>
                  <option value="hackathon">Hackathon</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Role Type</label>
                <select
                  value={oppRoleType}
                  onChange={(e) => setOppRoleType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                >
                  <option value="internship">Internship</option>
                  <option value="research_assistant">Research Assistant</option>
                  <option value="fellowship">Fellowship</option>
                  <option value="competition">Competition</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Stipend</label>
                <input
                  type="text"
                  placeholder="₹15,000 / month"
                  value={oppStipend}
                  onChange={(e) => setOppStipend(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Deadline</label>
                <input
                  type="date"
                  value={oppDeadline}
                  onChange={(e) => setOppDeadline(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Required Skills (comma separated)
              </label>
              <input
                type="text"
                placeholder="Python, PyTorch, Next.js, FastAPI"
                value={oppSkills}
                onChange={(e) => setOppSkills(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono"
              />
            </div>

            {/* Mandatory Criteria Section */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--action-primary)]">
                <ShieldCheck className="w-4 h-4" />
                Mandatory Eligibility Criteria (Rule-Engine Enforced)
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Min Verified CGPA</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={oppMinCgpa ?? ""}
                    onChange={(e) => setOppMinCgpa(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Allowed Branches</label>
                  <input
                    type="text"
                    placeholder="COE, CSE, ENC"
                    value={oppBranches}
                    onChange={(e) => setOppBranches(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Max Active Backlogs</label>
                  <input
                    type="number"
                    min="0"
                    value={oppMaxBacklogs}
                    onChange={(e) => setOppMaxBacklogs(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Min Attendance %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={oppMinAttendance}
                    onChange={(e) => setOppMinAttendance(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Description &amp; Deliverables
              </label>
              <textarea
                rows={3}
                placeholder="Describe project responsibilities, expected timeline, and learning outcomes..."
                value={oppDesc}
                onChange={(e) => setOppDesc(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
              />
            </div>

            {/* LIVE MATCHING PREVIEW PANEL */}
            <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--action-primary)] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[var(--action-primary)]" />
                    Live Matching Preview (Pre-Publication Simulation)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Evaluates criteria against verified student pool before saving.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleLiveMatchingPreview}
                  disabled={previewLoading}
                  className="text-xs border-[var(--border-color)] text-[var(--action-primary)] hover:bg-[var(--surface-secondary)]"
                >
                  {previewLoading ? "Simulating..." : "Run Matching Preview"}
                </Button>
              </div>

              {previewData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--border-color)] text-center">
                  <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80">
                    <div className="text-[10px] uppercase font-bold text-emerald-300">Eligible</div>
                    <div className="text-lg font-bold text-emerald-200">
                      {previewData.total_eligible_candidates}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80">
                    <div className="text-[10px] uppercase font-bold text-rose-300">Not Eligible</div>
                    <div className="text-lg font-bold text-rose-200">
                      {previewData.not_eligible_count ?? 0}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/80">
                    <div className="text-[10px] uppercase font-bold text-amber-300">Incomplete Profile</div>
                    <div className="text-lg font-bold text-amber-200">
                      {previewData.incomplete_profile_count ?? 0}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Total Scanned</div>
                    <div className="text-lg font-bold text-slate-200">
                      {previewData.total_opted_in_students}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCreateOppOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={savingOpp}
                onClick={() => handleSaveOpportunity(false)}
              >
                Save as Draft
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={savingOpp}
                onClick={() => handleSaveOpportunity(true)}
              >
                {savingOpp ? "Publishing..." : "Publish Opportunity"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================
          ADMIN MODAL: CANDIDATE DISCOVERY INSPECTOR
      ======================================================== */}
      {selectedOppForCandidates && (
        <Modal
          isOpen={candidateModalOpen}
          onClose={() => {
            setCandidateModalOpen(false);
            setSelectedOppForCandidates(null);
          }}
          title={`Candidate Discovery: ${selectedOppForCandidates.title}`}
          size="lg"
        >
          <div className="space-y-4 text-xs text-slate-300 max-h-[75vh] overflow-y-auto pr-1">
            {/* Criteria context summary */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-slate-400">Required Skills: </span>
                <span className="text-slate-200 font-mono">
                  {(selectedOppForCandidates.required_skills || []).join(", ")}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                  {candidateStats?.eligible ?? 0} Eligible
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-bold">
                  {candidateStats?.not_eligible ?? 0} Ineligible
                </span>
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Search candidate name, roll, skill..."
                value={candidateSearch}
                onChange={(e) => {
                  setCandidateSearch(e.target.value);
                  handleFilterCandidates(undefined, undefined, e.target.value);
                }}
                className="text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
              />
              <select
                value={candidateFilterStatus}
                onChange={(e) => {
                  setCandidateFilterStatus(e.target.value);
                  handleFilterCandidates(e.target.value, undefined, undefined);
                }}
                className="text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
              >
                <option value="all">All Statuses</option>
                <option value="ELIGIBLE">Eligible Only</option>
                <option value="NOT_ELIGIBLE">Not Eligible</option>
                <option value="INCOMPLETE_PROFILE">Incomplete Profile</option>
              </select>
              <select
                value={candidateFilterBranch}
                onChange={(e) => {
                  setCandidateFilterBranch(e.target.value);
                  handleFilterCandidates(undefined, e.target.value, undefined);
                }}
                className="text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
              >
                <option value="all">All Branches</option>
                <option value="COE">COE</option>
                <option value="CSE">CSE</option>
                <option value="ENC">ENC</option>
                <option value="ECE">ECE</option>
              </select>
            </div>

            {/* Candidates list */}
            {loadingCandidates ? (
              <div className="py-8 text-center text-slate-400">Loading candidate pool...</div>
            ) : candidatesList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 rounded-xl bg-slate-950/40 border border-slate-800">
                No candidates match the specified filter criteria.
              </div>
            ) : (
              <div className="space-y-2">
                {candidatesList.map((cand) => {
                  const isInvited = invitedCandidateIds.has(cand.student_id);
                  const isEligible = cand.eligibility?.status === "ELIGIBLE";

                  return (
                    <div
                      key={cand.student_id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 text-xs">
                            {cand.student_name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            ({cand.student_roll_no})
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              isEligible
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : cand.eligibility?.status === "INCOMPLETE_PROFILE"
                                ? "bg-amber-950 text-amber-300 border border-amber-800"
                                : "bg-rose-950 text-rose-300 border border-rose-800"
                            }`}
                          >
                            {cand.eligibility?.status || "PENDING"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Branch: {cand.student_branch} · Verified CGPA:{" "}
                          <strong className="text-[var(--action-primary)]">{cand.verified_cgpa?.toFixed(2) || "N/A"}</strong> · Match:{" "}
                          <strong className="text-[var(--action-primary)]">{cand.match_score}%</strong>
                        </p>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {(cand.skills || []).map((sk: string) => (
                            <span key={sk} className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isInvited ? (
                          <span className="px-2.5 py-1 rounded bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-semibold text-[11px] flex items-center gap-1">
                            <Check className="w-3 h-3" /> Invited
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleSendCandidateInvitation(cand.student_id)}
                            leftIcon={<Send className="w-3 h-3" />}
                            className="text-xs"
                          >
                            Send In-App Invite
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

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
            <div className="p-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-color)] space-y-1">
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
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)] leading-relaxed resize-none"
              />
            </div>

            {/* Weekly Commitment Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="apply-hrs" className="font-semibold text-slate-200">
                  Weekly Available Hours
                </label>
                <span className="font-mono text-[var(--action-primary)] font-bold">{commitmentInput} hrs/wk</span>
              </div>
              <input
                id="apply-hrs"
                type="range"
                min={2}
                max={25}
                step={1}
                value={commitmentInput}
                onChange={(e) => setCommitmentInput(Number(e.target.value))}
                className="w-full accent-[var(--action-primary)] bg-slate-800 h-1.5 rounded-lg cursor-pointer"
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
                className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] font-semibold"
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
              className="w-4 h-4 rounded text-[var(--action-primary)] focus:ring-[var(--focus-ring)] bg-slate-900 border-slate-700"
            />
          </div>

          {/* Availability hours slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="avail-hours-slider" className="font-semibold text-slate-200">Available Time Commitment</label>
              <span className="font-mono text-[var(--action-primary)] font-bold">{editHours} hours / week</span>
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
              className="w-full accent-[var(--action-primary)] bg-slate-800 h-1.5 rounded-lg cursor-pointer"
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
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
              />
              <Button size="sm" variant="secondary" onClick={handleAddSkill}>
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {editSkills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-[11px]"
                >
                  {s}
                  <button
                    onClick={() => handleRemoveSkill(s)}
                    aria-label={`Remove skill ${s}`}
                    className="text-[var(--action-primary)] hover:text-red-400 transition-colors ml-0.5"
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
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Your Role</label>
            <input
              type="text"
              placeholder="e.g. Backend Lead, Full Stack Developer"
              value={projRole}
              onChange={(e) => setProjRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Technologies (comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. Python, Redis, Docker, FastAPI"
              value={projTech}
              onChange={(e) => setProjTech(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Project or Repository URL (optional)</label>
            <input
              type="url"
              placeholder="https://github.com/username/project"
              value={projLink}
              onChange={(e) => setProjLink(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Description</label>
            <textarea
              rows={3}
              placeholder="What did you build, what challenges did you solve, and what was the impact?"
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)] leading-relaxed resize-none"
            />
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddProjectOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddProject} className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] font-semibold">
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
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">Company / Organization *</label>
              <input
                type="text"
                placeholder="e.g. TIET Research Lab, Microsoft"
                value={workCompany}
                onChange={(e) => setWorkCompany(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
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
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
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
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">End Date (leave blank if current)</label>
              <input
                type="text"
                placeholder="YYYY-MM or Present"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
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
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)] leading-relaxed resize-none"
            />
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddWorkOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddWork} className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] font-semibold">
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
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Issuing Organization *</label>
            <input
              type="text"
              placeholder="e.g. Amazon Web Services, Google Cloud, DeepLearning.AI"
              value={certIssuer}
              onChange={(e) => setCertIssuer(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Issue Date</label>
            <input
              type="text"
              placeholder="YYYY-MM (e.g. 2024-03)"
              value={certDate}
              onChange={(e) => setCertDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Credential URL (optional)</label>
            <input
              type="url"
              placeholder="https://www.credly.com/badges/..."
              value={certUrl}
              onChange={(e) => setCertUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--action-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddCertOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCert} className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] font-semibold">
              Save Certification
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
