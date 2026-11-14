"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  Plus,
  Tag,
  MapPin,
  Calendar,
  CheckCircle2,
  Archive,
  AlertTriangle,
  Lock,
  Shield,
  Eye,
  FileQuestion,
  Upload,
  Loader2,
  X,
  MessageSquare,
  KeyRound,
  FileCheck,
  Smartphone,
  Book,
  Shirt,
  Briefcase,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getLostAndFoundReports,
  getLostAndFoundItem,
  createLostAndFoundReport,
  updateLostAndFoundReport,
  resolveLostAndFoundReport,
  archiveLostAndFoundReport,
  submitLostAndFoundClaim,
  getLostAndFoundItemClaims,
  verifyLostAndFoundClaim,
  uploadLostAndFoundImage,
} from "../../lib/api";
import { LostAndFoundItem, LostAndFoundClaim } from "../../types";
import { Badge, Button } from "../../components/ui";

const CATEGORIES = [
  { value: "all", label: "All Categories", icon: Tag },
  { value: "electronics", label: "Electronics (Laptops, Phones)", icon: Smartphone },
  { value: "documents", label: "Documents & Cards", icon: FileQuestion },
  { value: "books", label: "Books & Notes", icon: Book },
  { value: "keys", label: "Keys & ID Cards", icon: KeyRound },
  { value: "clothing", label: "Clothing & Lab Coats", icon: Shirt },
  { value: "accessories", label: "Bags & Accessories", icon: Briefcase },
  { value: "other", label: "Other Items", icon: Tag },
];

export default function LostAndFoundPage() {
  const { user, profile, isAdmin } = useAuth();

  const [reports, setReports] = useState<LostAndFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "lost" | "found" | "mine">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");

  // Create report modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<"lost" | "found">("lost");
  const [createTitle, setCreateTitle] = useState("");
  const [createCategory, setCreateCategory] = useState("electronics");
  const [createLocation, setCreateLocation] = useState("");
  const [createEventDate, setCreateEventDate] = useState("2026-11-14");
  const [createDescription, setCreateDescription] = useState("");
  const [createImageUrls, setCreateImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail / Claim modal
  const [selectedItem, setSelectedItem] = useState<LostAndFoundItem | null>(null);
  const [itemClaims, setItemClaims] = useState<LostAndFoundClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimProof, setClaimProof] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Resolution notes
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolvingItem, setResolvingItem] = useState(false);

  useEffect(() => {
    loadReports();
  }, [activeTab, categoryFilter, statusFilter, searchQuery]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await getLostAndFoundReports({
        report_type: activeTab === "mine" ? undefined : activeTab,
        category: categoryFilter,
        status: statusFilter,
        query: searchQuery.trim() || undefined,
        my_reports: activeTab === "mine",
      });
      setReports(data);
    } catch (err) {
      console.error("Failed to load Lost & Found items", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (item: LostAndFoundItem) => {
    setSelectedItem(item);
    setClaimProof("");
    setClaimSuccess(false);
    setClaimError(null);
    setResolutionNotes("");

    // If user is owner or admin, fetch claims with private proofs
    const isOwner = user?.id === item.reporter_id;
    if (isOwner || isAdmin) {
      setLoadingClaims(true);
      try {
        const claims = await getLostAndFoundItemClaims(item.id);
        setItemClaims(claims);
      } catch {
        setItemClaims([]);
      } finally {
        setLoadingClaims(false);
      }
    } else {
      setItemClaims([]);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadingImage(true);
      try {
        const res = await uploadLostAndFoundImage(e.target.files[0]);
        setCreateImageUrls((prev) => [...prev, res.image_url]);
      } catch (err: any) {
        setCreateError(err.message || "Failed to upload image");
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createLocation.trim() || !createDescription.trim()) {
      setCreateError("Please fill out all required fields.");
      return;
    }
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      await createLostAndFoundReport({
        report_type: createType,
        title: createTitle.trim(),
        category: createCategory,
        location: createLocation.trim(),
        event_date: createEventDate,
        description: createDescription.trim(),
        image_urls: createImageUrls,
      });

      setCreateModalOpen(false);
      // Reset form
      setCreateTitle("");
      setCreateLocation("");
      setCreateDescription("");
      setCreateImageUrls([]);
      await loadReports();
    } catch (err: any) {
      setCreateError(err.message || "Failed to post report.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !claimProof.trim()) {
      setClaimError("Please describe your distinguishing ownership proof.");
      return;
    }
    setSubmittingClaim(true);
    setClaimError(null);
    try {
      await submitLostAndFoundClaim(selectedItem.id, claimProof.trim());
      setClaimSuccess(true);
      setClaimProof("");
      await loadReports();
    } catch (err: any) {
      setClaimError(err.message || "Failed to submit ownership claim.");
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleResolveItem = async (itemId: string) => {
    setResolvingItem(true);
    try {
      await resolveLostAndFoundReport(itemId, resolutionNotes.trim() || undefined);
      setSelectedItem(null);
      await loadReports();
    } catch (err: any) {
      alert(err.message || "Failed to resolve item");
    } finally {
      setResolvingItem(false);
    }
  };

  const handleArchiveItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to archive this report?")) return;
    try {
      await archiveLostAndFoundReport(itemId);
      setSelectedItem(null);
      await loadReports();
    } catch (err: any) {
      alert(err.message || "Failed to archive item");
    }
  };

  const handleVerifyClaim = async (claimId: string, action: "verify" | "reject") => {
    if (!selectedItem) return;
    try {
      await verifyLostAndFoundClaim(selectedItem.id, claimId, action);
      const claims = await getLostAndFoundItemClaims(selectedItem.id);
      setItemClaims(claims);
      await loadReports();
    } catch (err: any) {
      alert(err.message || "Failed to process claim verification");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Campus Lost & Found
            </h1>
            <Badge variant="primary" size="sm" className="font-mono text-xs">
              TIET Secure
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Report misplaced or recovered campus items with authenticated private proof. Phone numbers and sensitive personal contact details are kept strictly protected.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setCreateModalOpen(true);
              setCreateError(null);
            }}
            className="flex items-center gap-2 text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Report an Item
          </Button>
        </div>
      </div>

      {/* Navigation Tabs & Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Main Tabs */}
        <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            All Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lost")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "lost"
                ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            🔍 Lost Items
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("found")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "found"
                ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            📦 Found Items
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mine")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "mine"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            My Reports
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search keyword or place..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="open">Open Reports</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-teal-600" />
          Loading reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-2">
          <FileQuestion className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No matching reports found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try adjusting your search filters or click &apos;Report an Item&apos; to submit a new lost or found notice.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((item) => {
            const isLost = item.report_type === "lost";
            const isResolved = item.status === "resolved";
            const isOwner = user?.id === item.reporter_id;

            return (
              <div
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className="group relative cursor-pointer flex flex-col justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500/50 hover:shadow-md transition-all space-y-3"
              >
                <div>
                  {/* Image or Category placeholder */}
                  <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    {item.image_urls && item.image_urls.length > 0 ? (
                      <img
                        src={item.image_urls[0]}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <Tag className="w-8 h-8 stroke-[1.5]" />
                        <span className="text-[10px] uppercase font-bold mt-1 tracking-wider">
                          {item.category}
                        </span>
                      </div>
                    )}

                    {/* Report Type Badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm ${
                          isLost
                            ? "bg-rose-500 text-white"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        {isLost ? "Lost Item" : "Found Item"}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm ${
                          isResolved
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "bg-teal-600 text-white"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Footer details */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 truncate max-w-[65%]">
                      <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {item.event_date}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Contact via In-App Claim
                    </span>
                    {isOwner && (
                      <Badge variant="primary" size="sm" className="text-[9px] px-1 py-0">
                        My Report
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          CREATE REPORT MODAL
      ======================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Report Lost or Found Item
              </h2>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="p-6 overflow-y-auto space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Lost vs Found toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Report Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateType("lost")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      createType === "lost"
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    🔍 I Lost Something
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateType("found")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      createType === "found"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    📦 I Found Something
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Item Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Blue Dell Inspiron Laptop with sticker"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={createEventDate}
                    onChange={(e) => setCreateEventDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Approximate Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Central Library 2nd Floor, or TAN Audi"
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Public Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe general appearance. Do NOT include secret identifying details (such as serial numbers or passwords) so claimants can verify."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Upload Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 transition">
                    <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    {uploadingImage ? "Uploading..." : "Choose Image"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                  {createImageUrls.length > 0 && (
                    <span className="text-xs text-teal-600 font-semibold">
                      {createImageUrls.length} photo attached
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? "Publishing..." : "Publish Report"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          ITEM DETAIL & CLAIM MODAL
      ======================================================== */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    selectedItem.report_type === "lost"
                      ? "bg-rose-500 text-white"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {selectedItem.report_type}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white truncate max-w-md">
                  {selectedItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Image banner if present */}
              {selectedItem.image_urls && selectedItem.image_urls.length > 0 && (
                <div className="w-full h-52 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={selectedItem.image_urls[0]}
                    alt={selectedItem.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Attributes row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                    {selectedItem.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Location</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedItem.location}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Event Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedItem.event_date}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-semibold text-teal-600 dark:text-teal-400 capitalize">
                    {selectedItem.status}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  Item Description
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedItem.description}
                </p>
              </div>

              {/* Privacy protection notice */}
              <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-900/60 flex items-start gap-3 text-xs text-teal-900 dark:text-teal-200">
                <Lock className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold">Privacy Protected:</span> Direct contact numbers are not publicly exposed. Submit distinguishing identifying proof below to verify ownership securely.
                </div>
              </div>

              {/* SECTION: OWNER / ADMIN CLAIMS INSPECTOR */}
              {(user?.id === selectedItem.reporter_id || isAdmin) ? (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-teal-600" />
                      Submitted Ownership Claims ({itemClaims.length})
                    </h4>
                    {selectedItem.status === "open" && (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleArchiveItem(selectedItem.id)}
                        >
                          Archive
                        </Button>
                      </div>
                    )}
                  </div>

                  {loadingClaims ? (
                    <div className="py-4 text-center text-xs text-slate-400">Loading claims...</div>
                  ) : itemClaims.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                      No claims received yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {itemClaims.map((claim) => (
                        <div
                          key={claim.id}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">
                              Claimant: {claim.claimant_email || "Student"}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                claim.status === "verified"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : claim.status === "rejected"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                            >
                              {claim.status}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Private Identifying Proof
                            </span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {claim.distinguishing_proof}
                            </p>
                          </div>

                          {claim.status === "pending" && (
                            <div className="flex justify-end gap-2 pt-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleVerifyClaim(claim.id, "reject")}
                              >
                                Reject
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleVerifyClaim(claim.id, "verify")}
                              >
                                Verify & Accept
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resolution control */}
                  {selectedItem.status === "open" && (
                    <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                      <label className="block text-xs font-bold text-slate-900 dark:text-white">
                        Mark Item as Resolved
                      </label>
                      <input
                        type="text"
                        placeholder="Resolution notes (e.g. Handed over at Library Desk)"
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={resolvingItem}
                          onClick={() => handleResolveItem(selectedItem.id)}
                        >
                          {resolvingItem ? "Resolving..." : "Confirm Item Resolved"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* SECTION: CLAIM SUBMISSION FOR NON-OWNERS */
                selectedItem.status === "open" && (
                  <form onSubmit={handleSubmitClaim} className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-teal-600" />
                      Claim This Item
                    </h4>

                    {claimSuccess ? (
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-5 h-5 inline mr-1.5 text-emerald-600" />
                        Ownership claim submitted! The reporter has been notified to inspect your proof.
                      </div>
                    ) : (
                      <>
                        {claimError && (
                          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">
                            {claimError}
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Distinguishing Ownership Proof
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Provide details that only the true owner would know: e.g. serial number, lockscreen wallpaper, stickers, scratches, or contents inside..."
                            value={claimProof}
                            onChange={(e) => setClaimProof(e.target.value)}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={submittingClaim}
                          >
                            {submittingClaim ? "Submitting..." : "Submit Claim for Review"}
                          </Button>
                        </div>
                      </>
                    )}
                  </form>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
