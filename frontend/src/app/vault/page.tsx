"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  UploadCloud,
  FileText,
  FileImage,
  Presentation,
  FileCode,
  File,
  Download,
  Trash2,
  Edit3,
  Eye,
  Search,
  LayoutGrid,
  List as ListIcon,
  Lock,
  ShieldCheck,
  HardDrive,
  FolderLock,
  BookOpen,
  Award,
  GraduationCap,
  Folder,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
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
  getVaultItems,
  uploadVaultFile,
  getVaultDownloadUrl,
  renameVaultItem,
  deleteVaultItem,
} from "../../lib/api";
import { VaultItem, VaultCategory, VaultListResponse } from "../../types";

const CATEGORIES: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "All Items", icon: FolderLock },
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "certificate", label: "Certificates", icon: Award },
  { id: "academic", label: "Academic", icon: GraduationCap },
  { id: "other", label: "Other", icon: Folder },
];

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function getFileCategoryLabel(cat: string): string {
  switch (cat.toLowerCase()) {
    case "notes":
      return "Notes";
    case "certificate":
    case "certificates":
      return "Certificate";
    case "academic":
    case "marksheets":
    case "receipts":
      return "Academic";
    default:
      return "Other";
  }
}

function getFileTypeMeta(item: { title: string; mime_type: string }) {
  const ext = item.title.split(".").pop()?.toLowerCase() || "";
  const mime = item.mime_type.toLowerCase();

  if (mime.includes("pdf") || ext === "pdf") {
    return {
      type: "pdf",
      label: "PDF Document",
      icon: FileText,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-900/40",
      badgeVariant: "danger" as const,
    };
  }
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) {
    return {
      type: "image",
      label: "Image",
      icon: FileImage,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900/40",
      badgeVariant: "primary" as const,
    };
  }
  if (["ppt", "pptx"].includes(ext) || mime.includes("presentation")) {
    return {
      type: "pptx",
      label: "Presentation",
      icon: Presentation,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-900/40",
      badgeVariant: "warning" as const,
    };
  }
  if (["doc", "docx"].includes(ext) || mime.includes("word") || mime.includes("document")) {
    return {
      type: "docx",
      label: "Word Document",
      icon: FileText,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-950/40 border-sky-200/60 dark:border-sky-900/40",
      badgeVariant: "primary" as const,
    };
  }
  if (["txt", "md", "csv"].includes(ext) || mime.includes("text")) {
    return {
      type: "txt",
      label: "Text File",
      icon: FileCode,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/40",
      badgeVariant: "success" as const,
    };
  }
  return {
    type: "other",
    label: "File",
    icon: File,
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    badgeVariant: "default" as const,
  };
}

export default function DigitalVaultPage() {
  const { toast } = useToast();

  // State
  const [items, setItems] = useState<VaultItem[]>([]);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);
  const [storageLimitBytes, setStorageLimitBytes] = useState(500 * 1024 * 1024);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<VaultCategory>("notes");
  const [isUploading, setIsUploading] = useState(false);

  // Preview modal state
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Rename modal state
  const [renameItem, setRenameItem] = useState<VaultItem | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete modal state
  const [deleteItem, setDeleteItem] = useState<VaultItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Items
  const loadVaultItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data: VaultListResponse = await getVaultItems(activeCategory, searchQuery);
      setItems(data.items || []);
      setTotalStorageBytes(data.total_storage_bytes || 0);
      if (data.storage_limit_bytes) {
        setStorageLimitBytes(data.storage_limit_bytes);
      }
    } catch (err: any) {
      console.error("Error loading vault items:", err);
      toast.error(err.message || "Failed to load vault documents.");
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, searchQuery, toast]);

  useEffect(() => {
    loadVaultItems();
  }, [loadVaultItems]);

  // Stage File for Upload
  const handleStageFile = (file: File) => {
    // Client-side file validation (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10 MB limit. Please select a smaller file.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = [
      "pdf", "png", "jpg", "jpeg", "webp", "svg", "gif",
      "docx", "doc", "pptx", "ppt", "txt", "md", "csv"
    ];
    if (!allowed.includes(ext) && !file.type.startsWith("image/") && !file.type.includes("pdf")) {
      toast.error("Unsupported file type. Allowed formats: PDF, Images, DOCX, PPTX, TXT.");
      return;
    }

    setStagedFile(file);
    // Remove extension from default title
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    setUploadTitle(nameWithoutExt);

    // Auto-detect category from name if possible
    const lowerName = file.name.toLowerCase();
    if (lowerName.includes("cert") || lowerName.includes("award")) {
      setUploadCategory("certificate");
    } else if (lowerName.includes("transcript") || lowerName.includes("grade") || lowerName.includes("fee") || lowerName.includes("receipt")) {
      setUploadCategory("academic");
    } else if (lowerName.includes("note") || lowerName.includes("lecture") || lowerName.includes("syllabus")) {
      setUploadCategory("notes");
    } else {
      setUploadCategory("notes");
    }

    setIsUploadModalOpen(true);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleStageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleStageFile(e.target.files[0]);
      e.target.value = ""; // Reset
    }
  };

  // Execute Upload
  const handleConfirmUpload = async () => {
    if (!stagedFile) return;
    if (!uploadTitle.trim()) {
      toast.warning("Please provide a title for this file.");
      return;
    }

    setIsUploading(true);
    try {
      await uploadVaultFile(stagedFile, uploadTitle.trim(), uploadCategory);
      toast.success("File uploaded securely to your private vault.");
      setIsUploadModalOpen(false);
      setStagedFile(null);
      setUploadTitle("");
      if (activeCategory !== "all" && activeCategory !== uploadCategory) {
        setActiveCategory("all");
      }
      setSearchQuery("");
      await loadVaultItems();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  // Download Handler
  const handleDownload = async (item: VaultItem) => {
    try {
      toast.info(`Preparing secure download for ${item.title}...`);
      const { download_url } = await getVaultDownloadUrl(item.id);
      
      const link = document.createElement("a");
      link.href = download_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = item.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error(err.message || "Could not retrieve download link.");
    }
  };

  // Preview Handler
  const handleOpenPreview = async (item: VaultItem) => {
    setPreviewItem(item);
    setIsLoadingPreview(true);
    try {
      const { download_url } = await getVaultDownloadUrl(item.id);
      setPreviewUrl(download_url);
    } catch (err: any) {
      console.error("Preview load error:", err);
      toast.error("Could not load preview.");
      setPreviewUrl(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Rename Handler
  const handleStartRename = (item: VaultItem) => {
    setRenameItem(item);
    setNewTitle(item.title);
    setNewCategory(item.category);
  };

  const handleConfirmRename = async () => {
    if (!renameItem || !newTitle.trim()) return;
    setIsRenaming(true);
    try {
      await renameVaultItem(renameItem.id, newTitle.trim(), newCategory);
      toast.success("Document updated successfully.");
      setRenameItem(null);
      await loadVaultItems();
    } catch (err: any) {
      console.error("Rename error:", err);
      toast.error(err.message || "Failed to rename document.");
    } finally {
      setIsRenaming(false);
    }
  };

  // Delete Handler
  const handleStartDelete = (item: VaultItem) => {
    setDeleteItem(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      await deleteVaultItem(deleteItem.id);
      toast.success(`"${deleteItem.title}" has been deleted.`);
      setDeleteItem(null);
      await loadVaultItems();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete item.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Storage calculation
  const usedPercent = Math.min(100, Math.round((totalStorageBytes / storageLimitBytes) * 100));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Digital Vault
            </h1>
            <Badge variant="primary" size="md">
              Private Access-Controlled Storage
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Private access-controlled, user-scoped cloud storage for your lecture notes, grade cards, certificates, and academic credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadVaultItems}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<UploadCloud className="w-4 h-4" />}
            className="bg-teal-600 hover:bg-teal-500 text-white shadow-sm"
          >
            Upload File
          </Button>
        </div>
      </div>

      {/* Top Banner: Drag & Drop Zone + Storage Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Drop Zone */}
        <div className="lg:col-span-2">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-6 sm:p-8 transition-all flex flex-col items-center justify-center text-center ${
              isDragging
                ? "border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-4 ring-teal-500/20"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-teal-500 hover:bg-teal-50/30 dark:hover:bg-teal-950/20"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInputChange}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.gif,.docx,.doc,.pptx,.ppt,.txt,.md,.csv"
            />
            <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Drag and drop your file here, or{" "}
              <span className="text-teal-600 dark:text-teal-400 underline underline-offset-2">
                browse
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Supports PDF, PNG, JPG, DOCX, PPTX, and TXT (Max 10 MB).
            </p>

            {/* MANDATORY USER NOTICE */}
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              Files are private and visible only to you.
            </p>
          </div>
        </div>

        {/* Storage Quota Card */}
        <Card className="flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Vault Storage
                </span>
              </div>
              <Badge variant={usedPercent > 85 ? "danger" : "primary"} size="sm">
                {usedPercent}% Used
              </Badge>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Your CampusOS vault is isolated with row-level encryption in Supabase Storage.
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-700 dark:text-slate-300">
                  {formatBytes(totalStorageBytes)} used
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatBytes(storageLimitBytes)} total
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usedPercent > 85
                      ? "bg-rose-500"
                      : usedPercent > 60
                      ? "bg-amber-500"
                      : "bg-teal-600 dark:bg-teal-400"
                  }`}
                  style={{ width: `${Math.max(3, usedPercent)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{items.length} document{items.length === 1 ? "" : "s"} indexed</span>
            <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> Scoped RLS
            </span>
          </div>
        </Card>
      </div>

      {/* Controls Bar: Category Tabs, Search, and Grid/List Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition shrink-0 ${
                  isActive
                    ? "bg-teal-600 text-white shadow-sm font-semibold"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & View Mode */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Grid / List Toggle */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Switch to grid view"
              title="Grid View"
              className={`p-1.5 rounded-lg text-xs transition ${
                viewMode === "grid"
                  ? "bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 font-medium"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              aria-label="Switch to list view"
              title="List View"
              className={`p-1.5 rounded-lg text-xs transition ${
                viewMode === "list"
                  ? "bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 font-medium"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Items Section: Loading, Empty, or Display List/Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<FolderLock className="w-12 h-12 text-teal-600 dark:text-teal-400" />}
            title={searchQuery ? "No matching documents" : "Your Vault is Empty"}
            description={
              searchQuery
                ? `No documents matching "${searchQuery}" were found. Try another search or clear the filter.`
                : "Upload lecture notes, exam answer keys, grade cards, or fee receipts. All files are private and encrypted."
            }
            action={
              searchQuery
                ? {
                    label: "Clear Search",
                    variant: "secondary",
                    onClick: () => setSearchQuery(""),
                  }
                : {
                    label: "Upload Document",
                    variant: "primary",
                    icon: <UploadCloud className="w-4 h-4" />,
                    onClick: () => fileInputRef.current?.click(),
                  }
            }
          />
        </Card>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const meta = getFileTypeMeta(item);
            const Icon = meta.icon;
            const isPreviewable = meta.type === "pdf" || meta.type === "image";

            return (
              <Card
                key={item.id}
                className="group relative flex flex-col justify-between hover:shadow-md transition-all border border-slate-200/80 dark:border-slate-700/80"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg}`}
                    >
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge variant={meta.badgeVariant} size="sm">
                        {getFileCategoryLabel(item.category)}
                      </Badge>
                    </div>
                  </div>

                  <h3
                    className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2 mb-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors"
                    title={item.title}
                  >
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-2">
                    <span>{formatBytes(item.size_bytes)}</span>
                    <span>•</span>
                    <span>
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {isPreviewable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPreview(item)}
                        className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400"
                        title="Preview Document"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Preview
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(item)}
                      className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400"
                      title="Download File"
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                    >
                      Download
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartRename(item)}
                      title="Rename Document"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleStartDelete(item)}
                      title="Delete Document"
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-700/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200/80 dark:border-slate-700/80">
                <tr>
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Date Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => {
                  const meta = getFileTypeMeta(item);
                  const Icon = meta.icon;
                  const isPreviewable = meta.type === "pdf" || meta.type === "image";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.bg}`}
                        >
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <span className="truncate max-w-xs sm:max-w-md">{item.title}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={meta.badgeVariant} size="sm">
                          {getFileCategoryLabel(item.category)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {formatBytes(item.size_bytes)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPreviewable && (
                            <button
                              onClick={() => handleOpenPreview(item)}
                              aria-label={`Preview ${item.title}`}
                              title="Preview"
                              className="p-1.5 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDownload(item)}
                            aria-label={`Download ${item.title}`}
                            title="Download"
                            className="p-1.5 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStartRename(item)}
                            aria-label={`Rename ${item.title}`}
                            title="Rename"
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStartDelete(item)}
                            aria-label={`Delete ${item.title}`}
                            title="Delete"
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ============================================================
          UPLOAD MODAL
         ============================================================ */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => {
          if (!isUploading) {
            setIsUploadModalOpen(false);
            setStagedFile(null);
          }
        }}
        title="Upload to Private Vault"
        description="Encrypted and isolated in your private Supabase Storage directory."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsUploadModalOpen(false);
                setStagedFile(null);
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmUpload}
              isLoading={isUploading}
              className="bg-teal-600 hover:bg-teal-500 text-white"
              leftIcon={<UploadCloud className="w-4 h-4" />}
            >
              Upload Document
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {stagedFile && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {stagedFile.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatBytes(stagedFile.size)} • {stagedFile.type || "Document"}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Document Title
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. Operating Systems MST Answer Key"
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Vault Category
            </label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as VaultCategory)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            >
              <option value="notes">Notes (Lecture slides, summaries, notes)</option>
              <option value="certificate">Certificates (Hackathons, courses, sports)</option>
              <option value="academic">Academic (Transcripts, fee receipts, grade cards)</option>
              <option value="other">Other (ID cards, personal campus records)</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40 text-teal-900 dark:text-teal-200 text-xs flex items-start gap-2">
            <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <span>
              <strong>Private & Scoped:</strong> Files are saved to your authenticated user folder in the storage bucket. No other student can view or search them.
            </span>
          </div>
        </div>
      </Modal>

      {/* ============================================================
          PREVIEW MODAL (PDFs & IMAGES)
         ============================================================ */}
      <Modal
        isOpen={!!previewItem}
        onClose={() => {
          setPreviewItem(null);
          setPreviewUrl(null);
        }}
        size="full"
        title={
          <div className="flex items-center gap-2 max-w-lg truncate">
            <span>{previewItem?.title}</span>
            {previewItem && (
              <Badge variant="primary" size="sm">
                {getFileCategoryLabel(previewItem.category)}
              </Badge>
            )}
          </div>
        }
        description={
          previewItem ? `${formatBytes(previewItem.size_bytes)} • Private Encrypted Storage` : undefined
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Files are private and visible only to you.
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPreviewItem(null);
                  setPreviewUrl(null);
                }}
              >
                Close
              </Button>
              {previewItem && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleDownload(previewItem)}
                  className="bg-teal-600 hover:bg-teal-500 text-white"
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  Download
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="py-2">
          {isLoadingPreview ? (
            <div className="h-[450px] flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading secure preview...</p>
            </div>
          ) : previewUrl ? (
            previewItem && getFileTypeMeta(previewItem).type === "image" ? (
              <div className="flex items-center justify-center bg-slate-950/5 dark:bg-slate-900/40 rounded-xl p-4 min-h-[400px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={previewItem?.title}
                  className="max-h-[500px] max-w-full rounded-lg object-contain shadow-sm"
                />
              </div>
            ) : previewItem && getFileTypeMeta(previewItem).type === "pdf" ? (
              <div className="w-full h-[550px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
                <iframe
                  src={previewUrl}
                  title={previewItem.title}
                  className="w-full h-full border-none"
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Preview not available for this file type
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                  In-browser previews are supported for PDFs and image formats. Please download the file to view its full contents.
                </p>
                {previewItem && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDownload(previewItem)}
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    Download File ({formatBytes(previewItem.size_bytes)})
                  </Button>
                )}
              </div>
            )
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Failed to load preview. Please use the download action.
            </div>
          )}
        </div>
      </Modal>

      {/* ============================================================
          RENAME MODAL
         ============================================================ */}
      <Modal
        isOpen={!!renameItem}
        onClose={() => {
          if (!isRenaming) setRenameItem(null);
        }}
        title="Rename Document"
        description="Update the title and category of this vault item."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRenameItem(null)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmRename}
              isLoading={isRenaming}
              className="bg-teal-600 hover:bg-teal-500 text-white"
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Category
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            >
              <option value="notes">Notes</option>
              <option value="certificate">Certificates</option>
              <option value="academic">Academic</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ============================================================
          DELETE CONFIRMATION MODAL
         ============================================================ */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => {
          if (!isDeleting) setDeleteItem(null);
        }}
        title="Delete Vault Item"
        description="This action cannot be undone."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteItem(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Delete Permanently
            </Button>
          </div>
        }
      >
        <div className="py-2 text-xs text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            Are you sure you want to permanently delete{" "}
            <strong className="text-slate-900 dark:text-white font-semibold">
              &quot;{deleteItem?.title}&quot;
            </strong>
            ?
          </p>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-900 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>
              The file object will be permanently purged from your isolated Supabase Storage bucket and metadata registry.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
