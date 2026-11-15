"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Search,
  Filter,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  Tag,
  ExternalLink,
  ShieldCheck,
  Eye,
  Bell,
  Trash2,
  Layers,
  ArrowRightLeft,
  Send,
  MessageSquare,
  Check,
  X,
  Share2,
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
  EmptyState,
} from "../../components/ui";
import { useToast } from "../../components/ui/Toast";
import {
  getReuseListings,
  getReuseListing,
  createReuseListing,
  deleteReuseListing,
  requestReuseListing,
  acceptReuseRequest,
  declineReuseRequest,
  confirmReuseCompletion,
  getMyReuseListings,
  getMyReuseRequests,
  getReuseNotifications,
  markReuseNotificationsRead,
  getCampusReuseImpact,
} from "../../lib/api";
import {
  Listing,
  ListingCreate,
  ExchangeRequest,
  MyListingItem,
  ReuseImpactResponse,
  ReuseNotification,
} from "../../types";

const CATEGORIES = [
  { id: "all", label: "All Items", icon: Layers },
  { id: "book", label: "Books", icon: BookOpen },
  { id: "calculator", label: "Calculators", icon: Package },
  { id: "labcoat", label: "Lab Coats & Gear", icon: ShieldCheck },
  { id: "other", label: "Other Essentials", icon: Tag },
];

const MODES = [
  { id: "all", label: "All Modes" },
  { id: "exchange", label: "Exchange", badgeVariant: "primary" as const },
  { id: "donate", label: "Donate (Free)", badgeVariant: "success" as const },
  { id: "borrow", label: "Borrow", badgeVariant: "warning" as const },
];

export default function CampusReusePage() {
  const { toast } = useToast();

  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<"marketplace" | "my-listings" | "my-requests" | "impact">("marketplace");

  // Filter & Search State
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeMode, setActiveMode] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data State
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<MyListingItem[]>([]);
  const [myRequests, setMyRequests] = useState<ExchangeRequest[]>([]);
  const [impactData, setImpactData] = useState<ReuseImpactResponse | null>(null);
  const [notifications, setNotifications] = useState<ReuseNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

  // Post Listing Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("book");
  const [newMode, setNewMode] = useState("exchange");
  const [newCondition, setNewCondition] = useState("good");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newContact, setNewContact] = useState("Hostel B, Room 415");
  const [newPrice, setNewPrice] = useState<number>(0);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  // Request Form State
  const [requestMessage, setRequestMessage] = useState("Hi! I would like to request this item for my upcoming semester.");
  const [requestContact, setRequestContact] = useState("Hostel B, Room 415 | WhatsApp: 9876543210");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Fetch Marketplace Data
  const loadMarketplaceData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allListings, myL, myR, impact, notifs] = await Promise.all([
        getReuseListings({
          category: activeCategory,
          mode: activeMode,
          q: searchQuery,
        }),
        getMyReuseListings(),
        getMyReuseRequests(),
        getCampusReuseImpact(),
        getReuseNotifications(),
      ]);

      setListings(allListings);
      setMyListings(myL);
      setMyRequests(myR);
      setImpactData(impact);
      setNotifications(notifs.notifications || []);
      setUnreadCount(notifs.unread_count || 0);
    } catch (err: any) {
      console.error("Failed to load reuse data:", err);
      toast.error(err.message || "Failed to load marketplace items.");
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, activeMode, searchQuery, toast]);

  useEffect(() => {
    loadMarketplaceData();
  }, [loadMarketplaceData]);

  // Handle Post Listing
  const handleCreateListing = async () => {
    if (!newTitle.trim()) {
      toast.warning("Please provide an item title.");
      return;
    }

    setIsSubmittingPost(true);
    try {
      await createReuseListing({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        mode: newMode,
        condition: newCondition,
        image_url: newImageUrl.trim() || undefined,
        contact_info: newContact.trim(),
        estimated_retail_price: Number(newPrice) || 0,
      });

      toast.success("Listing posted successfully to Campus Reuse!");
      setIsPostModalOpen(false);
      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewImageUrl("");
      setNewPrice(0);
      await loadMarketplaceData();
    } catch (err: any) {
      console.error("Create listing error:", err);
      toast.error(err.message || "Could not create listing.");
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // Handle Request Submission
  const handleSendRequest = async () => {
    if (!selectedListing) return;

    setIsSubmittingRequest(true);
    try {
      await requestReuseListing(
        selectedListing.id,
        requestMessage.trim(),
        requestContact.trim()
      );
      toast.success(`Request sent to ${selectedListing.owner_name}!`);
      setIsRequestModalOpen(false);
      setSelectedListing(null);
      await loadMarketplaceData();
    } catch (err: any) {
      console.error("Request error:", err);
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Request Lifecycle Actions
  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptReuseRequest(requestId);
      toast.success("Request accepted! Item marked as reserved.");
      await loadMarketplaceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept request.");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await declineReuseRequest(requestId);
      toast.info("Request was declined.");
      await loadMarketplaceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to decline request.");
    }
  };

  const handleConfirmCompletion = async (requestId: string) => {
    try {
      await confirmReuseCompletion(requestId);
      toast.success("Exchange marked completed! Contributed to SDG 12 campus impact.");
      await loadMarketplaceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm completion.");
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    try {
      await deleteReuseListing(listingId);
      toast.success("Listing deleted.");
      await loadMarketplaceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete listing.");
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await markReuseNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  // Helper Badge Colors
  const getModeBadge = (mode: string) => {
    switch (mode.toLowerCase()) {
      case "donate":
        return <Badge variant="success" size="sm">Donate (Free)</Badge>;
      case "borrow":
        return <Badge variant="warning" size="sm">Borrow</Badge>;
      default:
        return <Badge variant="primary" size="sm">Exchange</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge variant="default" size="sm">Completed</Badge>;
      case "reserved":
        return <Badge variant="warning" size="sm">Reserved</Badge>;
      default:
        return <Badge variant="success" size="sm">Available</Badge>;
    }
  };

  const getConditionLabel = (cond: string) => {
    switch (cond.toLowerCase()) {
      case "like_new":
        return "Like New";
      case "fair":
        return "Fair";
      default:
        return "Good Condition";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Campus Reuse
            </h1>
            <Badge variant="primary" size="md">
              SDG 12 Circularity
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Peer-to-peer exchange, donation, and borrowing of academic textbooks, calculators, and lab coats across TIET hostels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Notifications Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsNotificationsModalOpen(true);
              handleMarkNotificationsRead();
            }}
            className="relative"
            leftIcon={<Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
          >
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-[var(--action-primary)] text-[var(--action-primary-text)] text-[10px] font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPostModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] shadow-xs"
          >
            Post a Listing
          </Button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("marketplace")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
            activeTab === "marketplace"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Marketplace</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white">
            {listings.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("my-listings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
            activeTab === "my-listings"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Listings</span>
          {myListings.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
              {myListings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("my-requests")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
            activeTab === "my-requests"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>My Requests</span>
          {myRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
              {myRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("impact")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
            activeTab === "impact"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Leaf className="w-4 h-4 text-emerald-500" />
          <span>SDG 12 Impact</span>
        </button>
      </div>

      {/* ============================================================
          TAB 1: MARKETPLACE
         ============================================================ */}
      {activeTab === "marketplace" && (
        <div className="space-y-5">
          {/* Controls: Search, Mode, and Category Filters */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Mode Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              {MODES.map((m) => {
                const isActive = activeMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveMode(m.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium transition shrink-0 ${
                      isActive
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-[var(--border-color)] hover:bg-slate-50"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Search Box */}
            <div className="relative w-full lg:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search calculator, book, coat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] focus:border-[var(--action-primary)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                    isActive
                      ? "bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Listings Card Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton variant="card" />
              <Skeleton variant="card" />
              <Skeleton variant="card" />
            </div>
          ) : listings.length === 0 ? (
            <Card className="p-10">
              <EmptyState
                icon={<Repeat className="w-12 h-12 text-[var(--action-primary)]" />}
                title={searchQuery ? "No items matching your search" : "No items listed yet"}
                description="Be the first to list a textbook, Drafter, or Casio calculator for your fellow batchmates."
                action={{
                  label: "Post an Item",
                  variant: "primary",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => setIsPostModalOpen(true),
                }}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {listings.map((item) => (
                <Card
                  key={item.id}
                  className="flex flex-col justify-between overflow-hidden border border-[var(--border-color)] hover:shadow-md transition group"
                >
                  {/* Image or Category Visual Header */}
                  {item.image_url ? (
                    <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        {getModeBadge(item.mode)}
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 shadow-sm">
                          {getConditionLabel(item.condition)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-32 w-full bg-[var(--surface-secondary)] p-4 flex flex-col justify-between border-b border-[var(--border-color)]">
                      <div className="flex items-center justify-between">
                        {getModeBadge(item.mode)}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                          {getConditionLabel(item.condition)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-primary)] font-medium capitalize">
                        {item.category}
                      </div>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3
                        className="font-semibold text-sm text-[var(--text-primary)] line-clamp-1 group-hover:text-[var(--action-primary)] transition"
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {item.description || "No extra description provided."}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px]">
                          <User className="w-3 h-3 text-slate-400" />
                          {item.owner_name}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--action-primary)]">
                      {item.mode === "donate"
                        ? "Free Handover"
                        : item.mode === "borrow"
                        ? "Peer Loan"
                        : "Direct Exchange"}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedListing(item)}
                      className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-xs text-[var(--action-primary-text)]"
                    >
                      View & Request
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 2: MY LISTINGS
         ============================================================ */}
      {activeTab === "my-listings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Items You Posted ({myListings.length})
            </h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsPostModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add New Listing
            </Button>
          </div>

          {myListings.length === 0 ? (
            <Card className="p-10">
              <EmptyState
                icon={<Package className="w-12 h-12 text-[var(--action-primary)]" />}
                title="You haven't listed any items"
                description="Put your old semester textbooks or calculator back into campus circulation."
                action={{
                  label: "Post a Listing",
                  variant: "primary",
                  onClick: () => setIsPostModalOpen(true),
                }}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {myListings.map(({ listing, requests }) => (
                <Card key={listing.id} className="p-5 border border-[var(--border-color)]">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        {getModeBadge(listing.mode)}
                        {getStatusBadge(listing.status)}
                        <span className="text-xs text-slate-400">
                          {new Date(listing.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        {listing.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {listing.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeleteListing(listing.id)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Incoming Requests on This Listing */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Incoming Requests ({requests.length})
                    </h4>

                    {requests.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No student has requested this item yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {requests.map((req) => (
                          <div
                            key={req.id}
                            className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                                <span>{req.requester_name}</span>
                                <Badge
                                  variant={
                                    req.status === "completed"
                                      ? "default"
                                      : req.status === "accepted"
                                      ? "success"
                                      : req.status === "declined"
                                      ? "danger"
                                      : "warning"
                                  }
                                  size="sm"
                                >
                                  {req.status}
                                </Badge>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                                &quot;{req.message}&quot;
                              </p>
                              {req.requester_contact && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Contact: {req.requester_contact}
                                </p>
                              )}
                            </div>

                            {/* Request Actions for Owner */}
                            <div className="flex items-center gap-2 shrink-0">
                              {req.status === "pending" && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleAcceptRequest(req.id)}
                                    className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)]"
                                    leftIcon={<Check className="w-3.5 h-3.5" />}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleDeclineRequest(req.id)}
                                    leftIcon={<X className="w-3.5 h-3.5" />}
                                  >
                                    Decline
                                  </Button>
                                </>
                              )}

                              {req.status === "accepted" && (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                  {req.owner_confirmed ? (
                                    <Badge variant="warning" size="sm">
                                      Handover Confirmed · Awaiting Student
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleConfirmCompletion(req.id)}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                    >
                                      Confirm Handover Complete
                                    </Button>
                                  )}
                                  {req.requester_confirmed && !req.owner_confirmed && (
                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                      Student confirmed receipt!
                                    </span>
                                  )}
                                </div>
                              )}

                              {req.status === "completed" && (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                                  <CheckCircle2 className="w-4 h-4" /> Exchange Complete
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 3: MY REQUESTS
         ============================================================ */}
      {activeTab === "my-requests" && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Items You Requested ({myRequests.length})
          </h2>

          {myRequests.length === 0 ? (
            <Card className="p-10">
              <EmptyState
                icon={<ArrowRightLeft className="w-12 h-12 text-[var(--action-primary)]" />}
                title="No active requests"
                description="Browse the marketplace to find engineering calculators, lab gear, or course textbooks."
                action={{
                  label: "Browse Marketplace",
                  variant: "primary",
                  onClick: () => setActiveTab("marketplace"),
                }}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <Card key={req.id} className="p-4 border border-[var(--border-color)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getModeBadge(req.listing_mode)}
                        <Badge
                          variant={
                            req.status === "completed"
                              ? "default"
                              : req.status === "accepted"
                              ? "success"
                              : req.status === "declined"
                              ? "danger"
                              : "warning"
                          }
                          size="sm"
                        >
                          {req.status === "accepted"
                            ? "Accepted • Ready for Pickup"
                            : req.status === "completed"
                            ? "Handover Completed"
                            : req.status === "declined"
                            ? "Declined"
                            : "Pending Owner Approval"}
                        </Badge>
                      </div>

                      <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                        {req.listing_title}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Owner: <strong className="text-slate-700 dark:text-slate-300">{req.owner_name}</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 italic mt-1">
                        &quot;{req.message}&quot;
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {req.status === "accepted" && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          {req.requester_confirmed ? (
                            <Badge variant="warning" size="sm">
                              Receipt Confirmed · Awaiting Owner
                            </Badge>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleConfirmCompletion(req.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white"
                              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            >
                              Confirm Received / Complete
                            </Button>
                          )}
                          {req.owner_confirmed && !req.requester_confirmed && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Owner confirmed handover!
                            </span>
                          )}
                        </div>
                      )}

                      {req.status === "completed" && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4" /> Received & Completed
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 4: SDG 12 IMPACT DASHBOARD
         ============================================================ */}
      {activeTab === "impact" && impactData && (
        <div className="space-y-6">
          {/* SDG 12 Banner */}
          <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-1">
                <Leaf className="w-4 h-4" />
                <span>UN Sustainable Development Goal 12</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Responsible Consumption & Production
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xl leading-relaxed">
                CampusOS circular economy reduces student expenditure, prevents electronic and paper waste from entering Patiala landfills, and avoids carbon footprint of new manufacturing.
              </p>
            </div>
            <div className="text-right shrink-0 bg-[var(--surface-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">
                {impactData.items_kept_in_use}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">Items Kept in Circulation</div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Total Completed Handouts
                </span>
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] text-[var(--action-primary)] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {impactData.total_completed}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                <span>{impactData.donations_completed} Free</span>
                <span>•</span>
                <span>{impactData.exchanges_completed} Swaps</span>
                <span>•</span>
                <span>{impactData.loans_completed} Loans</span>
              </div>
            </Card>

            <Card className="p-4 border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Student Money Saved
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ₹{impactData.total_money_saved_inr.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Direct savings on textbooks & calculators</p>
            </Card>

            <Card className="p-4 border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Landfill Waste Diverted
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {impactData.total_waste_diverted_kg} kg
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Paper, plastics & electronics recycled</p>
            </Card>

            <Card className="p-4 border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  CO2 Emissions Avoided
                </span>
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] text-[var(--action-primary)] flex items-center justify-center">
                  <Leaf className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {impactData.co2_avoided_kg} kg
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Manufacturing & freight offset</p>
            </Card>
          </div>

          {/* Simple Activity Chart Over Time */}
          <Card className="p-5 border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Monthly Campus Reuse Activity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Completed handovers per month across Thapar hostels
                </p>
              </div>
              <Badge variant="primary" size="sm">
                Fall 2024 Pilot
              </Badge>
            </div>

            {/* SVG Histogram Chart */}
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 h-48 items-end pt-8 pb-2 border-b border-[var(--border-color)]">
                {impactData.per_month_series.map((pt, idx) => {
                  const maxVal = Math.max(...impactData.per_month_series.map((p) => p.total), 30);
                  const heightPercent = Math.round((pt.total / maxVal) * 100);

                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition">
                        {pt.total} items
                      </div>
                      <div className="w-full max-w-[50px] bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex flex-col justify-end h-full">
                        <div
                          className="w-full bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] rounded-t-lg transition-all duration-300"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[var(--text-secondary)] font-medium">{pt.month}</span>
                    </div>
                  );
                })}
              </div>

              {/* Legend & Summary */}
              <div className="flex flex-wrap items-center justify-between text-xs text-[var(--text-secondary)] pt-1">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[var(--action-primary)]" /> Total Completed Cycles
                  </span>
                </div>
                <span>Refreshed in real-time from Supabase impact_events</span>
              </div>
            </div>
          </Card>

          {/* Environmental Estimation Transparency Note */}
          <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Environmental & Economic Estimation Model</span>
            </div>
            <p>
              Metrics are calculated strictly from verified completed bilateral exchanges. Savings reflect regional second-hand campus market values (₹450–₹1,450/item). Carbon and solid waste diversion metrics are modeled estimates benchmarked to standard life-cycle assessment factors (1.4 kg paper/book, 0.25 kg e-waste/calculator, 2.45 kg CO₂e offset per kg diverted materials).
            </p>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: POST A LISTING
         ============================================================ */}
      <Modal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        title="Post an Item on Campus Reuse"
        description="Share course books, calculators, or lab coats with other TIET students."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="secondary" size="sm" onClick={() => setIsPostModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateListing}
              isLoading={isSubmittingPost}
              className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)]"
            >
              Publish Listing
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Item Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Casio FX-991EX ClassWiz or CLRS Algorithms"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] focus:border-[var(--action-primary)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
              >
                <option value="book">Book / Textbook</option>
                <option value="calculator">Scientific Calculator</option>
                <option value="labcoat">Lab Coat & Gear</option>
                <option value="other">Other Hostel Essential</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Listing Mode
              </label>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
              >
                <option value="exchange">Exchange (Swap for another item)</option>
                <option value="donate">Donate (Give away for free)</option>
                <option value="borrow">Borrow (Lend during exam week)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Condition
              </label>
              <select
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
              >
                <option value="like_new">Like New (Mint)</option>
                <option value="good">Good (Fully functional)</option>
                <option value="fair">Fair (Usable with signs of wear)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estimated Price (₹)
              </label>
              <input
                type="number"
                value={newPrice || ""}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                placeholder="e.g. 950"
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Notes
            </label>
            <textarea
              rows={2}
              placeholder="Mention semester relevance, chapters highlighted, or items you want in exchange..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Image URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://... (or leave empty for category banner)"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Your Hostel Contact Info
            </label>
            <input
              type="text"
              placeholder="e.g. Hostel B, Room 415 | WhatsApp: 9876543210"
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      </Modal>

      {/* ============================================================
          MODAL: VIEW DETAILS & REQUEST ITEM
         ============================================================ */}
      <Modal
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        title={selectedListing?.title}
        description={selectedListing ? `${selectedListing.owner_name} • ${getConditionLabel(selectedListing.condition)}` : ""}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500">
              {selectedListing?.mode === "donate"
                ? "Free donation • No money charged"
                : selectedListing?.mode === "borrow"
                ? "Borrow for study/exam period"
                : "Exchange for another peer item"}
            </span>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedListing(null)}>
                Close
              </Button>

              {/* Prevent users from requesting their own listing */}
              {selectedListing?.owner_name.includes("You") ? (
                <Button variant="secondary" size="sm" disabled className="opacity-60 cursor-not-allowed">
                  Your Listing
                </Button>
              ) : selectedListing?.user_has_requested ? (
                <Button variant="secondary" size="sm" disabled className="opacity-60 cursor-not-allowed">
                  Already Requested
                </Button>
              ) : selectedListing?.status === "completed" ? (
                <Button variant="secondary" size="sm" disabled className="opacity-60 cursor-not-allowed">
                  Completed
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsRequestModalOpen(true)}
                  className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)]"
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Request Item
                </Button>
              )}
            </div>
          </div>
        }
      >
        {selectedListing && (
          <div className="space-y-4 py-2 text-xs">
            {selectedListing.image_url && (
              <div className="h-56 w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedListing.image_url}
                  alt={selectedListing.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              {getModeBadge(selectedListing.mode)}
              {getStatusBadge(selectedListing.status)}
              <span className="text-slate-400 capitalize">• Category: {selectedListing.category}</span>
            </div>

            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Description
              </h4>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedListing.description || "No specific details provided."}
              </p>
            </div>

            {selectedListing.contact_info ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--border-color)] space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Campus Location & Handover Note
                </span>
                <p className="text-slate-500 dark:text-slate-400">
                  {selectedListing.contact_info}
                </p>
              </div>
            ) : !selectedListing.owner_name.includes("You") ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border-color)] text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-[var(--action-primary)]" />
                <span>Hostel room & contact details are shielded until your exchange request is accepted by the owner.</span>
              </div>
            ) : null}

            {selectedListing.owner_name.includes("You") && (
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[var(--action-primary)]" />
                <span>You are the owner of this listing. You cannot request your own item.</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ============================================================
          MODAL: SUBMIT REQUEST
         ============================================================ */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title={`Request "${selectedListing?.title}"`}
        description={`Send a direct note to ${selectedListing?.owner_name}.`}
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="secondary" size="sm" onClick={() => setIsRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendRequest}
              isLoading={isSubmittingRequest}
              className="bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)]"
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Send Request
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Message to Owner
            </label>
            <textarea
              rows={3}
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Explain why you need this item or what you can offer in exchange..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Your Hostel / Contact Details
            </label>
            <input
              type="text"
              value={requestContact}
              onChange={(e) => setRequestContact(e.target.value)}
              placeholder="e.g. Hostel B, Room 415 | WhatsApp: 9812345678"
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      </Modal>

      {/* ============================================================
          MODAL: IN-APP NOTIFICATIONS
         ============================================================ */}
      <Modal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        title="Campus Reuse Notifications"
        description="Updates on your listings and submitted requests."
        footer={
          <Button variant="secondary" size="sm" onClick={() => setIsNotificationsModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-2 py-2">
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No notifications right now.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--border-color)] text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-primary)]">{n.title}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
