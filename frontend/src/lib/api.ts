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
  Listing,
  ListingCreate,
  ExchangeRequest,
  MyListingItem,
  ReuseImpactResponse,
  NotificationsResponse,
  ReuseNotification,
  CampusDocument,
  DocumentUploadResponse,
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
    body: JSON.stringify({ question: query }),
  });
  if (!res.ok) throw new Error("Failed to get response from Campus Copilot");
  return await res.json();
}

export async function askCopilotStream(
  query: string,
  callbacks: {
    onToken: (token: string) => void;
    onCitations?: (citations: any[]) => void;
    onRefusal?: (answer: string) => void;
    onDone?: () => void;
  }
): Promise<void> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/copilot/ask/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question: query }),
  });

  if (!res.ok || !res.body) {
    // Fall back to non-streaming endpoint
    const staticRes = await askCopilot(query);
    if (!staticRes.grounded && callbacks.onRefusal) {
      callbacks.onRefusal(staticRes.answer);
    } else {
      if (callbacks.onCitations && staticRes.citations) {
        callbacks.onCitations(staticRes.citations);
      }
      callbacks.onToken(staticRes.answer);
    }
    if (callbacks.onDone) callbacks.onDone();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const jsonStr = trimmed.slice(6);
      try {
        const payload = JSON.parse(jsonStr);
        if (payload.event === "token") {
          callbacks.onToken(payload.text);
        } else if (payload.event === "citations" && callbacks.onCitations) {
          callbacks.onCitations(payload.citations);
        } else if (payload.event === "refusal" && callbacks.onRefusal) {
          callbacks.onRefusal(payload.answer);
        } else if (payload.event === "done" && callbacks.onDone) {
          callbacks.onDone();
        }
      } catch (err) {
        console.error("Error parsing SSE JSON payload:", err);
      }
    }
  }

  if (callbacks.onDone) callbacks.onDone();
}

export async function getCampusDocuments(): Promise<CampusDocument[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/copilot/documents`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch campus documents");
    return await res.json();
  } catch (err) {
    console.warn("Failed fetching campus documents from server:", err);
    return [];
  }
}

export async function uploadCampusDocument(
  file: File,
  title: string,
  sourceLabel: string
): Promise<DocumentUploadResponse> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  formData.append("source_label", sourceLabel);

  const res = await fetch(`${API_BASE}/api/copilot/documents`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to upload and ingest document");
  }
  return await res.json();
}

export async function deleteCampusDocument(documentId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/copilot/documents/${documentId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete document");
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
      const data: DownloadUrlResponse = await res.json();
      let url = data.download_url;
      if (url.includes("mock-storage.supabase.co") || url.startsWith("/")) {
        url = `${API_BASE}/api/vault/raw/${itemId}`;
      }
      return {
        ...data,
        download_url: url,
      };
    }
  } catch (err) {
    console.warn("Backend download url failed, checking local items:", err);
  }

  // Fallback for local / demo items
  const local = getLocalVaultItems().find((i) => i.id === itemId);
  if (local && local.download_url && local.download_url !== "#" && !local.download_url.includes("mock-storage")) {
    return {
      download_url: local.download_url,
      expires_in_seconds: 3600,
      title: local.title,
    };
  }

  return {
    download_url: `${API_BASE}/api/vault/raw/${itemId}`,
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

// ============================================================
// --- Campus Reuse End-to-End API (Listings, Requests, Impact)
// ============================================================

export async function getReuseListings(params?: {
  q?: string;
  category?: string;
  mode?: string;
  status?: string;
}): Promise<Listing[]> {
  try {
    const headers = await getAuthHeaders();
    const query = new URLSearchParams();
    if (params?.q && params.q.trim()) query.set("q", params.q.trim());
    if (params?.category && params.category !== "all") query.set("category", params.category);
    if (params?.mode && params.mode !== "all") query.set("mode", params.mode);
    if (params?.status && params.status !== "all") query.set("status", params.status);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const res = await fetch(`${API_BASE}/reuse/listings${queryString}`, { headers, cache: "no-store" });
    if (!res.ok) {
      const res2 = await fetch(`${API_BASE}/api/reuse/listings${queryString}`, { headers, cache: "no-store" });
      if (!res2.ok) throw new Error("Failed to fetch listings");
      return await res2.json();
    }
    return await res.json();
  } catch (e) {
    console.warn("Fallback to mock reuse listings:", e);
    return getFallbackListings(params);
  }
}

export async function getReuseListing(id: string): Promise<Listing> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/reuse/listings/${id}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch listing detail");
  return await res.json();
}

export async function createReuseListing(data: ListingCreate): Promise<Listing> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/reuse/listings`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create listing");
  }
  return await res.json();
}

export async function deleteReuseListing(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/reuse/listings/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete listing");
}

export async function requestReuseListing(
  listingId: string,
  message?: string,
  contactInfo?: string
): Promise<ExchangeRequest> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/reuse/listings/${listingId}/request`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, contact_info: contactInfo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to submit exchange request");
  }
  return await res.json();
}

export async function acceptReuseRequest(requestId: string): Promise<ExchangeRequest> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/reuse/requests/${requestId}/accept`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error("Failed to accept request");
  return await res.json();
}

export async function declineReuseRequest(requestId: string): Promise<ExchangeRequest> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/reuse/requests/${requestId}/decline`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error("Failed to decline request");
  return await res.json();
}

export async function confirmReuseCompletion(requestId: string): Promise<ExchangeRequest> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/reuse/requests/${requestId}/confirm`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error("Failed to confirm completion");
  return await res.json();
}

export async function getMyReuseListings(): Promise<MyListingItem[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/reuse/my-listings`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch my listings");
    return await res.json();
  } catch (e) {
    console.warn("Fallback to local my listings:", e);
    return [];
  }
}

export async function getMyReuseRequests(): Promise<ExchangeRequest[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/reuse/my-requests`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch my requests");
    return await res.json();
  } catch (e) {
    console.warn("Fallback to local my requests:", e);
    return [];
  }
}

export async function getReuseNotifications(): Promise<NotificationsResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/reuse/notifications`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return await res.json();
  } catch (e) {
    return { unread_count: 0, notifications: [] };
  }
}

export async function markReuseNotificationsRead(): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_BASE}/reuse/notifications/mark-read`, { method: "POST", headers });
  } catch {}
}

export async function getCampusReuseImpact(): Promise<ReuseImpactResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/reuse/impact`, { headers, cache: "no-store" });
    if (!res.ok) {
      const res2 = await fetch(`${API_BASE}/api/reuse/impact`, { headers, cache: "no-store" });
      if (!res2.ok) throw new Error("Failed to fetch reuse impact");
      return await res2.json();
    }
    return await res.json();
  } catch (e) {
    console.warn("Using fallback campus reuse impact:", e);
    return getFallbackReuseImpact();
  }
}

function getFallbackListings(params?: { q?: string; category?: string; mode?: string; status?: string }): Listing[] {
  const base: Listing[] = [
    {
      id: "list-1",
      owner_id: "00000000-0000-0000-0000-000102203088",
      owner_name: "Aman Sharma (Hostel J)",
      title: "Casio FX-991EX ClassWiz Scientific Calculator",
      description: "Essential for Mathematics-III (UMA010) and Electrical Engineering exams. Solar + battery working perfectly.",
      category: "calculator",
      mode: "donate",
      condition: "good",
      status: "available",
      image_url: "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=600&auto=format&fit=crop&q=80",
      contact_info: "Hostel J, Room 312 | WhatsApp: 9876543210",
      estimated_retail_price: 1450.0,
      estimated_weight_kg: 0.25,
      created_at: "2024-11-08T10:00:00Z",
      requests_count: 1,
    },
    {
      id: "list-2",
      owner_id: "00000000-0000-0000-0000-000102203088",
      owner_name: "Simran Kaur (Hostel PG)",
      title: "Engineering Chemistry White Lab Coat (Size M)",
      description: "Clean, washed, no chemical stains. Required for 1st & 2nd year Environmental Science and Chemistry labs.",
      category: "labcoat",
      mode: "donate",
      condition: "like_new",
      status: "available",
      image_url: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=600&auto=format&fit=crop&q=80",
      contact_info: "Hostel PG, Room 108",
      estimated_retail_price: 450.0,
      estimated_weight_kg: 0.40,
      created_at: "2024-11-09T14:30:00Z",
      requests_count: 0,
    },
    {
      id: "list-3",
      owner_id: "00000000-0000-0000-0000-000102203099",
      owner_name: "Arjun Mehta (You)",
      title: "Operating System Concepts (Silberschatz & Galvin, 10th Ed)",
      description: "Official textbook for UCS405. Contains handwritten notes on virtual memory, paging algorithms, and deadlocks.",
      category: "book",
      mode: "exchange",
      condition: "good",
      status: "available",
      image_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
      contact_info: "Hostel B, Room 415 | Looking for Cormen CLRS DSA in exchange",
      estimated_retail_price: 950.0,
      estimated_weight_kg: 1.40,
      created_at: "2024-11-10T09:15:00Z",
      requests_count: 1,
    },
    {
      id: "list-4",
      owner_id: "00000000-0000-0000-0000-000102203088",
      owner_name: "Rohan Verma (Hostel M)",
      title: "Bajaj 1.2L Electric Kettle for Hostel Rooms",
      description: "Auto cut-off certified with hostel warden permission sticker. Ideal for exam week late night tea/coffee.",
      category: "other",
      mode: "borrow",
      condition: "good",
      status: "available",
      image_url: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
      contact_info: "Hostel M, Room 120 | For borrow during MST/EST week",
      estimated_retail_price: 1200.0,
      estimated_weight_kg: 0.90,
      created_at: "2024-11-11T12:00:00Z",
      requests_count: 0,
    },
  ];

  let filtered = base;
  if (params?.category && params.category !== "all") {
    filtered = filtered.filter((i) => i.category === params.category);
  }
  if (params?.mode && params.mode !== "all") {
    filtered = filtered.filter((i) => i.mode === params.mode);
  }
  if (params?.status && params.status !== "all") {
    filtered = filtered.filter((i) => i.status === params.status);
  }
  if (params?.q && params.q.trim()) {
    const q = params.q.trim().toLowerCase();
    filtered = filtered.filter((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }
  return filtered;
}

function getFallbackReuseImpact(): ReuseImpactResponse {
  return {
    exchanges_completed: 23,
    donations_completed: 39,
    loans_completed: 16,
    total_completed: 78,
    items_kept_in_use: 54,
    total_money_saved_inr: 58600.0,
    total_waste_diverted_kg: 72.8,
    co2_avoided_kg: 178.4,
    sdg_framework: "SDG 12: Responsible Consumption and Production",
    per_month_series: [
      { month: "Aug 2024", exchanges: 2, donations: 5, loans: 1, total: 8, co2_kg: 19.6, waste_kg: 8.0, money_saved_inr: 7200.0 },
      { month: "Sep 2024", exchanges: 6, donations: 9, loans: 4, total: 19, co2_kg: 46.5, waste_kg: 19.0, money_saved_inr: 17100.0 },
      { month: "Oct 2024", exchanges: 9, donations: 14, loans: 6, total: 29, co2_kg: 71.0, waste_kg: 29.0, money_saved_inr: 26100.0 },
      { month: "Nov 2024", exchanges: 6, donations: 11, loans: 5, total: 22, co2_kg: 41.3, waste_kg: 16.8, money_saved_inr: 8200.0 },
    ],
  };
}

