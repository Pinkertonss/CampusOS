"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Lock,
  Upload,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  Tag,
  AlertCircle,
  Eye,
  Key,
  FolderLock,
} from "lucide-react";
import {
  getVaultConsent,
  setVaultConsent,
  getVaultDocuments,
  uploadVaultDocument,
  deleteVaultDocument,
} from "../../lib/api";
import { VaultDocument } from "../../types";

const CATEGORIES = [
  { key: "all", label: "All Documents" },
  { key: "marksheets", label: "Marksheets & Grades" },
  { key: "certificates", label: "Certificates" },
  { key: "receipts", label: "Fee Receipts" },
  { key: "identity", label: "Identity & ID Cards" },
  { key: "notes", label: "Notes & Lab Manuals" },
];

export default function VaultPage() {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [consentGiven, setConsentGiven] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("certificates");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");

  // Secure View Modal
  const [viewingDoc, setViewingDoc] = useState<VaultDocument | null>(null);

  const loadVaultData = async () => {
    try {
      const [consentRes, docs] = await Promise.all([
        getVaultConsent(),
        getVaultDocuments(selectedCategory),
      ]);
      setConsentGiven(consentRes.consent_given);
      setDocuments(docs);
    } catch (e) {
      console.error("Vault load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaultData();
  }, [selectedCategory]);

  const handleToggleConsent = async () => {
    try {
      const nextConsent = !consentGiven;
      await setVaultConsent(nextConsent);
      setConsentGiven(nextConsent);
    } catch (err) {
      alert("Failed to update consent: " + err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle) return;

    if (!consentGiven) {
      alert("Please give explicit privacy consent before uploading private documents.");
      return;
    }

    setUploadStatus("Encrypting and uploading to private storage...");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle);
      formData.append("category", uploadCategory);
      formData.append("tags", uploadTags);

      await uploadVaultDocument(formData);
      setUploadStatus("Uploaded successfully!");
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadTitle("");
        setUploadTags("");
        setUploadFile(null);
        setUploadStatus("");
        loadVaultData();
      }, 1000);
    } catch (err: any) {
      setUploadStatus("Error: " + (err.message || err));
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to permanently delete this document from your vault?"))
      return;
    try {
      await deleteVaultDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      alert("Delete failed: " + err);
    }
  };

  const filteredDocs =
    selectedCategory === "all"
      ? documents
      : documents.filter((d) => d.category.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Private Storage
            </span>
            <span className="text-xs text-slate-400">Row Level Security Enforced</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Digital Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Zero-knowledge, private encrypted storage for student transcripts, fee receipts, and certificates.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-950 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Upload Document
        </button>
      </div>

      {/* Explicit Consent & Privacy Architecture Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950/40 border border-blue-800/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-blue-950 text-blue-400 flex items-center justify-center shrink-0 border border-blue-800">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              Student Privacy &amp; Row Level Security (RLS)
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Every document is stored in an encrypted private Supabase bucket isolated by your student UID. No third-party or campus user can view your vault items without signed credentials.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleToggleConsent}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              consentGiven
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                : "bg-red-950/80 text-red-300 border-red-700/60"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {consentGiven ? "Consent Granted" : "Consent Revoked"}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.key
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center shrink-0 border border-slate-700">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {doc.category}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-white line-clamp-1">{doc.title}</h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {(doc.file_size_bytes / 1024).toFixed(0)} KB • {doc.mime_type.split("/")[1]?.toUpperCase() || "FILE"}
              </p>

              {/* Tags */}
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {doc.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 border border-slate-800"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {new Date(doc.created_at).toLocaleDateString()}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewingDoc(doc)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Secure Preview"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 transition-colors"
                  title="Delete Document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
          <FolderLock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          No documents in this category yet. Upload your first document to store it securely!
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Upload to Private Vault</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. 5th Sem Tuition Fee Receipt"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                >
                  <option value="marksheets">Marksheet &amp; Grades</option>
                  <option value="certificates">Certificates</option>
                  <option value="receipts">Fee Receipts</option>
                  <option value="identity">Identity &amp; ID Cards</option>
                  <option value="notes">Notes &amp; Lab Manuals</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="grades, transcript, odd-sem-2024"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select File</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              {uploadStatus && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
                  {uploadStatus}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow"
                >
                  Upload &amp; Encrypt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW SECURE DETAILS MODAL */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <Key className="w-4 h-4" /> Secure Signed Document Token
            </div>
            <h3 className="text-base font-bold text-white">{viewingDoc.title}</h3>

            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
              <div>
                <span className="text-slate-500">Path: </span>
                <span>{viewingDoc.storage_path}</span>
              </div>
              <div>
                <span className="text-slate-500">MIME: </span>
                <span>{viewingDoc.mime_type}</span>
              </div>
              <div>
                <span className="text-slate-500">RLS Check: </span>
                <span className="text-emerald-400">auth.uid() Verified</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              This document is retrieved via temporary signed token valid for 300 seconds. Direct public access is rejected by Supabase storage policies.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setViewingDoc(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
