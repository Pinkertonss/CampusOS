import {
  Course,
  AttendanceRecord,
  WhatIfAttendanceRequest,
  WhatIfAttendanceResponse,
  WhatIfGradeRequest,
  WhatIfGradeResponse,
  TimetableSlot,
  DeadlineTask,
  CopilotQueryResponse,
  VaultDocument,
  ReuseItem,
  ImpactMetrics,
  DailyPlanResponse,
  AcademicSummaryResponse,
  AttendanceWhatIfPlannerRequest,
  AttendanceWhatIfPlannerResponse,
  GradeWhatIfPlannerRequest,
  GradeWhatIfPlannerResponse,
  VaultItem,
  VaultListResponse,
  UploadUrlRequest,
  UploadUrlResponse,
  VaultItemCreate,
  VaultItemUpdate,
  DownloadUrlResponse,
  VaultCategory,
} from "../types";
import {
  MOCK_COURSES,
  MOCK_ATTENDANCE,
  MOCK_TIMETABLE,
  MOCK_DEADLINES,
  MOCK_VAULT_DOCS,
  MOCK_REUSE_ITEMS,
  MOCK_IMPACT,
  MOCK_DAILY_PLAN,
  MOCK_ACADEMIC_SUMMARY,
} from "./mockData";
import { supabase } from "./supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Attaches the Supabase session token to backend requests.
 * Falls back to dev credentials if operating in local dev mode.
 */
async function getAuthHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    ...customHeaders,
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
      return headers;
    }
  } catch (err) {
    // Session retrieval error
  }

  // Fallback for development & demo environment
  if (process.env.NODE_ENV !== "production") {
    headers["Authorization"] = "Bearer dev-user-102203099";
  }

  return headers;
}

// --- Health Check API ---

export async function checkHealth(): Promise<{ status: string; app?: string; campus?: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/health`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Health check failed");
  return await res.json();
}

// --- Academic API ---

export async function getCourses(): Promise<Course[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/academic/courses`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch courses");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback courses data:", e);
    return MOCK_COURSES;
  }
}

export async function addCourse(course: {
  course_code: string;
  course_name: string;
  credits: number;
  grade?: string;
  target_grade?: string;
}): Promise<Course> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/academic/courses`, {
    method: "POST",
    headers,
    body: JSON.stringify(course),
  });
  if (!res.ok) throw new Error("Failed to add course");
  return await res.json();
}

export async function deleteCourse(courseId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/courses/${courseId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete course");
}

export async function getAttendance(): Promise<AttendanceRecord[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/academic/attendance`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch attendance");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback attendance data:", e);
    return MOCK_ATTENDANCE;
  }
}

export async function updateAttendance(
  courseCode: string,
  attended: number,
  total: number
): Promise<AttendanceRecord> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/attendance/update?course_code=${encodeURIComponent(
      courseCode
    )}&attended_classes=${attended}&total_classes=${total}`,
    { method: "POST", headers }
  );
  if (!res.ok) throw new Error("Failed to update attendance");
  return await res.json();
}

export async function simulateAttendance(
  req: WhatIfAttendanceRequest
): Promise<WhatIfAttendanceResponse> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/academic/what-if/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to simulate attendance");
  return await res.json();
}

export async function simulateGrades(
  req: WhatIfGradeRequest
): Promise<WhatIfGradeResponse> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/academic/what-if/grades`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to simulate grades");
  return await res.json();
}

// --- Official Academic Planning Engine API ---

export async function getDailyPlan(referenceDate?: string): Promise<DailyPlanResponse> {
  try {
    const headers = await getAuthHeaders();
    const query = referenceDate ? `?reference_date=${encodeURIComponent(referenceDate)}` : "";
    const res = await fetch(`${API_BASE}/academics/daily-plan${query}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch daily plan");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback daily plan:", e);
    return MOCK_DAILY_PLAN as DailyPlanResponse;
  }
}

export async function getAcademicSummary(): Promise<AcademicSummaryResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/academics/summary`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch academic summary");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback academic summary:", e);
    return MOCK_ACADEMIC_SUMMARY as AcademicSummaryResponse;
  }
}

export async function postAttendanceWhatIf(
  req: AttendanceWhatIfPlannerRequest
): Promise<AttendanceWhatIfPlannerResponse> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/academics/attendance/what-if`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to calculate attendance what-if");
  return await res.json();
}

export async function postGradeWhatIf(
  req: GradeWhatIfPlannerRequest
): Promise<GradeWhatIfPlannerResponse> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/academics/grades/what-if`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to calculate grade what-if");
  return await res.json();
}

export async function getTimetable(): Promise<TimetableSlot[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/academic/timetable`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch timetable");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback timetable data:", e);
    return MOCK_TIMETABLE;
  }
}

export async function getDeadlines(): Promise<DeadlineTask[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/academic/deadlines`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch deadlines");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback deadlines data:", e);
    return MOCK_DEADLINES;
  }
}

export async function createDeadline(task: {
  title: string;
  course_code?: string;
  due_date: string;
  priority: string;
}): Promise<DeadlineTask> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/academic/deadlines`, {
    method: "POST",
    headers,
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error("Failed to create deadline");
  return await res.json();
}

export async function toggleDeadline(taskId: string): Promise<DeadlineTask> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/deadlines/${taskId}/toggle`, {
    method: "PATCH",
    headers,
  });
  if (!res.ok) throw new Error("Failed to toggle deadline status");
  return await res.json();
}

export async function uploadCSV(file: File, importType: "attendance" | "courses") {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_type", importType);

  const res = await fetch(`${API_BASE}/api/academic/import-csv`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error("CSV upload failed");
  return await res.json();
}

// --- Campus Copilot API ---

export async function askCopilot(query: string): Promise<CopilotQueryResponse> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/copilot/ask`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error("Failed to get response from Campus Copilot");
  return await res.json();
}

export async function confirmCopilotTask(suggestion: {
  title: string;
  due_date: string;
  priority: string;
  course_code?: string;
}): Promise<DeadlineTask> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/copilot/confirm-task`, {
    method: "POST",
    headers,
    body: JSON.stringify(suggestion),
  });
  if (!res.ok) throw new Error("Failed to confirm actionable task");
  return await res.json();
}

// --- Digital Vault API ---

export async function getVaultConsent(): Promise<{ consent_given: boolean; policy: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/vault/consent`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to get consent status");
    return await res.json();
  } catch (e) {
    return { consent_given: true, policy: "Local fallback policy" };
  }
}

export async function setVaultConsent(consentGiven: boolean) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/vault/consent`, {
    method: "POST",
    headers,
    body: JSON.stringify({ consent_given: consentGiven }),
  });
  if (!res.ok) throw new Error("Failed to update vault consent");
  return await res.json();
}

export async function getVaultDocuments(category?: string): Promise<VaultDocument[]> {
  try {
    const headers = await getAuthHeaders();
    const url = category && category !== "all"
      ? `${API_BASE}/api/vault/documents?category=${category}`
      : `${API_BASE}/api/vault/documents`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch vault documents");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback vault documents:", e);
    return MOCK_VAULT_DOCS;
  }
}

export async function uploadVaultDocument(formData: FormData): Promise<VaultDocument> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/vault/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload document to vault");
  }
  return await res.json();
}

export async function deleteVaultDocument(docId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/vault/documents/${docId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete vault document");
}

// --- Digital Vault End-to-End API ---

const LOCAL_VAULT_KEY = "campusos_vault_user_items";

export function getLocalVaultItems(): VaultItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_VAULT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalVaultItem(item: VaultItem) {
  if (typeof window === "undefined") return;
  try {
    const items = getLocalVaultItems();
    const filtered = items.filter((i) => i.id !== item.id);
    localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify([item, ...filtered]));
  } catch {}
}

export function removeLocalVaultItem(id: string) {
  if (typeof window === "undefined") return;
  try {
    const items = getLocalVaultItems();
    localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(items.filter((i) => i.id !== id)));
  } catch {}
}

export async function getVaultItems(
  category?: string,
  query?: string
): Promise<VaultListResponse> {
  const localItems = getLocalVaultItems();

  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (category && category !== "all") params.set("category", category);
    if (query && query.trim()) params.set("q", query.trim());

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE}/api/vault/items${queryString}`, {
      headers,
      cache: "no-store",
    });

    if (res.ok) {
      const data: VaultListResponse = await res.json();
      // Merge server items with any locally cached items that may not be on the server yet
      const serverIds = new Set((data.items || []).map((i) => i.id));
      const combined = [...(data.items || [])];

      for (const loc of localItems) {
        if (!serverIds.has(loc.id)) {
          if (category && category !== "all" && loc.category.toLowerCase() !== category.toLowerCase()) {
            continue;
          }
          if (query && query.trim() && !loc.title.toLowerCase().includes(query.trim().toLowerCase())) {
            continue;
          }
          combined.push(loc);
        }
      }

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const totalBytes = combined.reduce((acc, i) => acc + (i.size_bytes || 0), 0);

      return {
        items: combined,
        total_count: combined.length,
        total_storage_bytes: totalBytes,
        storage_limit_bytes: data.storage_limit_bytes || 500 * 1024 * 1024,
      };
    }
  } catch (e) {
    console.warn("Backend offline, loading local vault cache:", e);
  }

  // Fallback when backend is unreachable or not started:
  const mockBase: VaultItem[] = [
    {
      id: "v-seed-1",
      title: "DAA Lecture Notes — Week 1 to 4",
      category: "notes",
      storage_path: "102203099-tiet-user/daa_notes.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048576,
      created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    },
    {
      id: "v-seed-2",
      title: "Class 12 Marksheet & Pass Certificate",
      category: "academic",
      storage_path: "102203099-tiet-user/class12_marksheet.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024000,
      created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    },
    {
      id: "v-seed-3",
      title: "HackThapar 2024 Finalist Certificate",
      category: "certificate",
      storage_path: "102203099-tiet-user/hackthapar_cert.png",
      mime_type: "image/png",
      size_bytes: 612000,
      created_at: new Date(Date.now() - 3600000 * 24 * 25).toISOString(),
    },
    {
      id: "v-seed-4",
      title: "OS Lab Manual (UCS405)",
      category: "notes",
      storage_path: "102203099-tiet-user/os_lab_manual.pdf",
      mime_type: "application/pdf",
      size_bytes: 3145728,
      created_at: new Date(Date.now() - 3600000 * 24 * 40).toISOString(),
    },
  ];

  const merged = [...localItems, ...mockBase.filter((m) => !localItems.some((l) => l.id === m.id))];
  let filtered = merged;
  if (category && category !== "all") {
    filtered = filtered.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  }
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((i) => i.title.toLowerCase().includes(q));
  }

  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const totalBytes = filtered.reduce((acc, i) => acc + (i.size_bytes || 0), 0);

  return {
    items: filtered,
    total_count: filtered.length,
    total_storage_bytes: totalBytes,
    storage_limit_bytes: 500 * 1024 * 1024,
  };
}

export async function createVaultUploadUrl(
  filename: string,
  mimeType: string,
  sizeBytes: number
): Promise<UploadUrlResponse> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/vault/upload-url`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to generate upload URL");
  }
  return await res.json();
}

export async function registerVaultItem(
  item: VaultItemCreate
): Promise<VaultItem> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/vault/items`, {
    method: "POST",
    headers,
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to register vault item");
  }
  return await res.json();
}

export async function getVaultDownloadUrl(
  itemId: string
): Promise<DownloadUrlResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/vault/items/${itemId}/download-url`, {
      headers,
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Backend download url failed, checking local items:", err);
  }

  // Fallback for local / demo items
  const local = getLocalVaultItems().find((i) => i.id === itemId);
  if (local && local.download_url && local.download_url !== "#") {
    return {
      download_url: local.download_url,
      expires_in_seconds: 3600,
      title: local.title,
    };
  }

  return {
    download_url: "#",
    expires_in_seconds: 300,
    title: local?.title || "Document",
  };
}

export async function renameVaultItem(
  itemId: string,
  title: string,
  category?: string
): Promise<VaultItem> {
  // Update in local storage
  const localItems = getLocalVaultItems();
  const existing = localItems.find((i) => i.id === itemId);
  if (existing) {
    const updated: VaultItem = {
      ...existing,
      title: title.trim(),
      category: category || existing.category,
    };
    saveLocalVaultItem(updated);
  }

  try {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const payload: VaultItemUpdate = { title };
    if (category) payload.category = category;

    const res = await fetch(`${API_BASE}/api/vault/items/${itemId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data: VaultItem = await res.json();
      saveLocalVaultItem(data);
      return data;
    }
  } catch (err) {
    console.warn("Backend rename failed, saved locally:", err);
  }

  if (existing) {
    return { ...existing, title: title.trim(), category: category || existing.category };
  }

  return {
    id: itemId,
    title,
    category: category || "other",
    storage_path: `102203099-tiet-user/${itemId}`,
    mime_type: "application/pdf",
    size_bytes: 1024,
    created_at: new Date().toISOString(),
  };
}

export async function deleteVaultItem(itemId: string): Promise<void> {
  // Always remove from local cache immediately
  removeLocalVaultItem(itemId);

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/vault/items/${itemId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      await fetch(`${API_BASE}/vault/items/${itemId}`, { method: "DELETE", headers });
    }
  } catch (err) {
    console.warn("Backend delete request failed (removed from local cache):", err);
  }
}

/**
 * End-to-end file upload helper:
 * Attempts signed URL upload or multipart upload to FastAPI/Supabase backend.
 * Falls back to offline browser storage if backend is temporarily disconnected.
 */
export async function uploadVaultFile(
  file: File,
  title: string,
  category: string
): Promise<VaultItem> {
  // Client-side file size validation (max 10 MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File size exceeds 10 MB limit.");
  }

  let localPreviewUrl: string | undefined;
  if (typeof window !== "undefined") {
    try {
      localPreviewUrl = URL.createObjectURL(file);
    } catch {}
  }

  // Attempt 1: Direct multipart upload
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("category", category);

    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/vault/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      const item: VaultItem = {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        category: data.category,
        storage_path: data.storage_path,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes || file.size,
        created_at: data.created_at,
        download_url: localPreviewUrl || `/api/vault/items/${data.id}/download-url`,
      };
      saveLocalVaultItem(item);
      return item;
    }
  } catch (directErr) {
    console.warn("Direct upload failed, trying signed URL flow:", directErr);
  }

  // Attempt 2: Signed upload URL flow
  try {
    const uploadInfo = await createVaultUploadUrl(
      file.name,
      file.type || "application/octet-stream",
      file.size
    );

    if (uploadInfo.upload_url && uploadInfo.upload_url.startsWith("http")) {
      try {
        await fetch(uploadInfo.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
      } catch (putErr) {
        console.warn("Signed URL put error:", putErr);
      }
    }

    const item = await registerVaultItem({
      title,
      category,
      storage_path: uploadInfo.storage_path,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    });
    if (localPreviewUrl) {
      item.download_url = localPreviewUrl;
    }
    saveLocalVaultItem(item);
    return item;
  } catch (flowErr) {
    console.warn("Signed URL flow failed, using client-side offline storage:", flowErr);
  }

  // Attempt 3: Client-side offline fallback
  const offlineItem: VaultItem = {
    id: `v-local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: "102203099-tiet-user",
    title: title.trim(),
    category,
    storage_path: `102203099-tiet-user/local_${file.name}`,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    created_at: new Date().toISOString(),
    download_url: localPreviewUrl || "#",
  };
  saveLocalVaultItem(offlineItem);
  return offlineItem;
}

// --- Campus Reuse API ---

export async function getReuseItems(params?: {
  category?: string;
  listing_type?: string;
  status?: string;
}): Promise<ReuseItem[]> {
  try {
    const headers = await getAuthHeaders();
    const query = new URLSearchParams();
    if (params?.category && params.category !== "all") query.set("category", params.category);
    if (params?.listing_type && params.listing_type !== "all") query.set("listing_type", params.listing_type);
    if (params?.status && params.status !== "all") query.set("status", params.status);

    const res = await fetch(`${API_BASE}/api/reuse/items?${query.toString()}`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch reuse items");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback reuse items:", e);
    return MOCK_REUSE_ITEMS;
  }
}

export async function createReuseItem(item: {
  title: string;
  description: string;
  category: string;
  listing_type: string;
  condition: string;
  estimated_retail_price: number;
  estimated_weight_kg: number;
  contact_info: string;
}): Promise<ReuseItem> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/reuse/items`, {
    method: "POST",
    headers,
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error("Failed to create reuse item");
  return await res.json();
}

export async function claimReuseItem(itemId: string, info: { requester_name: string; requester_contact: string }) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/reuse/items/${itemId}/claim`, {
    method: "POST",
    headers,
    body: JSON.stringify(info),
  });
  if (!res.ok) throw new Error("Failed to claim reuse item");
  return await res.json();
}

export async function completeReuseItem(itemId: string): Promise<ReuseItem> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/reuse/items/${itemId}/complete`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error("Failed to mark exchange complete");
  return await res.json();
}

export async function getImpactMetrics(): Promise<ImpactMetrics> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/reuse/impact`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch impact metrics");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback impact metrics:", e);
    return MOCK_IMPACT;
  }
}
