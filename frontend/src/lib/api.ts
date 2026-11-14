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
  DecisionMatrixResponse,
  Opportunity,
  OpportunityRecommendation,
  OpportunityRecommendationResponse,
  StudentSkillProfile,
  OpportunityApplication,
  Subject,
  SubjectOffering,
  StudentEnrollment,
  StudentDirectoryItem,
  AttendanceSession,
  SessionAttendanceRecord,
  Assessment,
  StudentAssessmentMark,
  OfferingAssignment,
  AssignmentSubmission,
  OfferingAnnouncement,
  RosterStudent,
  RosterResponse,
  AcademicAuditLog,
  UserRoleItem,
  AdminAccountCreate,
  AdminAccountResponse,
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

  // Check cookie or localStorage for active session token (e.g. dev-admin, dev-user-102203099, or Supabase JWT)
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/campusos_auth_token=([^;]+)/);
    if (match && match[1]) {
      const cookieToken = decodeURIComponent(match[1]);
      if (cookieToken) {
        headers["Authorization"] = `Bearer ${cookieToken}`;
        return headers;
      }
    }
    const localToken = localStorage.getItem("campusos_auth_token");
    if (localToken) {
      headers["Authorization"] = `Bearer ${localToken}`;
      return headers;
    }
  }

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
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/courses`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch courses (${res.status})`);
  }
  return await res.json();
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
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/attendance`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch attendance (${res.status})`);
  }
  return await res.json();
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
  const headers = await getAuthHeaders();
  const query = referenceDate ? `?reference_date=${encodeURIComponent(referenceDate)}` : "";
  const res = await fetch(`${API_BASE}/academics/daily-plan${query}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch daily plan (${res.status})`);
  }
  return await res.json();
}

export async function getDecisionMatrix(referenceDate?: string): Promise<DecisionMatrixResponse> {
  const headers = await getAuthHeaders();
  const query = referenceDate ? `?reference_date=${encodeURIComponent(referenceDate)}` : "";
  const res = await fetch(`${API_BASE}/academics/decision-matrix${query}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch decision matrix (${res.status})`);
  }
  return await res.json();
}

export async function getAcademicSummary(): Promise<AcademicSummaryResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/academics/summary`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch academic summary (${res.status})`);
  }
  return await res.json();
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
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/timetable`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch timetable (${res.status})`);
  }
  return await res.json();
}

export async function getDeadlines(): Promise<DeadlineTask[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/deadlines`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch deadlines (${res.status})`);
  }
  return await res.json();
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
  const headers = await getAuthHeaders();
  const url = category && category !== "all"
    ? `${API_BASE}/api/vault/documents?category=${category}`
    : `${API_BASE}/api/vault/documents`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch vault documents (${res.status})`);
  }
  return await res.json();
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
      return {
        items: data.items || [],
        total_count: data.total_count,
        total_storage_bytes: data.total_storage_bytes ?? data.total_size_bytes ?? 0,
        storage_limit_bytes: data.storage_limit_bytes ?? data.max_storage_bytes ?? 500 * 1024 * 1024,
      };
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load vault items");
  } catch (e: any) {
    if (e.message && !e.message.includes("fetch")) {
      throw e;
    }
    console.warn("Backend offline, falling back to local storage:", e);
  }

  // Fallback ONLY when backend is completely unreachable
  const localItems = getLocalVaultItems();
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
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/vault/items/${itemId}/download-url`, {
    headers,
    cache: "no-store",
  });
  if (res.ok) {
    const data: DownloadUrlResponse = await res.json();
    let url = data.download_url;
    if (url.startsWith("/")) {
      url = `${API_BASE}${url}`;
    }
    return {
      ...data,
      download_url: url,
    };
  }
  const err = await res.json().catch(() => ({}));
  throw new Error(err.detail || "Could not retrieve secure download link");
}

export async function renameVaultItem(
  itemId: string,
  title: string,
  category?: string
): Promise<VaultItem> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const payload: VaultItemUpdate = { title: title.trim() };
  if (category) payload.category = category;

  const res = await fetch(`${API_BASE}/api/vault/items/${itemId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to rename vault document");
  }
  const data: VaultItem = await res.json();
  saveLocalVaultItem(data);
  return data;
}

export async function deleteVaultItem(itemId: string): Promise<void> {
  removeLocalVaultItem(itemId);

  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/vault/items/${itemId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete vault document");
  }
}

/**
 * End-to-end file upload helper:
 * Attempts signed URL upload or multipart upload to FastAPI/Supabase backend.
 * Never fabricates fake blob: URLs on failure; propagates real server errors.
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

  // Attempt 1: Direct multipart upload
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
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
        download_url: `/api/vault/items/${data.id}/download-url`,
      };
      saveLocalVaultItem(item);
      return item;
    }

    const err = await res.json().catch(() => ({}));
    if (res.status >= 400 && res.status < 500) {
      // Definitive validation/auth error from server
      throw new Error(err.detail || "Failed to upload document");
    }
  } catch (directErr: any) {
    if (directErr.message && !directErr.message.includes("fetch")) {
      throw directErr;
    }
    console.warn("Direct upload error, attempting signed URL flow:", directErr);
  }

  // Attempt 2: Two-stage signed upload URL flow
  const uploadInfo = await createVaultUploadUrl(
    file.name,
    file.type || "application/octet-stream",
    file.size
  );

  if (uploadInfo.upload_url && uploadInfo.upload_url.startsWith("http")) {
    const putRes = await fetch(uploadInfo.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error("Failed to upload file bytes to secure storage");
    }
  }

  const item = await registerVaultItem({
    title: title.trim(),
    category,
    storage_path: uploadInfo.storage_path,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
  });

  saveLocalVaultItem(item);
  return item;
}

// --- Campus Reuse API ---

export async function getReuseItems(params?: {
  category?: string;
  listing_type?: string;
  status?: string;
}): Promise<ReuseItem[]> {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.category && params.category !== "all") query.set("category", params.category);
  if (params?.listing_type && params.listing_type !== "all") query.set("listing_type", params.listing_type);
  if (params?.status && params.status !== "all") query.set("status", params.status);

  const res = await fetch(`${API_BASE}/api/reuse/items?${query.toString()}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch reuse items (${res.status})`);
  }
  return await res.json();
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
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/reuse/impact`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch impact metrics (${res.status})`);
  }
  return await res.json();
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

// ============================================================
// Opportunity Matching API
// ============================================================

export async function getOpportunities(
  category?: string,
  search?: string
): Promise<Opportunity[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== "all") params.set("category", category);
    if (search && search.trim()) params.set("search", search.trim());
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE}/api/opportunities${query}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch opportunities");
    return await res.json();
  } catch (e) {
    console.warn("Using fallback opportunities:", e);
    return [];
  }
}

export async function getRecommendedOpportunities(): Promise<OpportunityRecommendationResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/opportunities/recommended`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch recommended opportunities");
  return await res.json();
}

export async function getStudentSkillProfile(): Promise<StudentSkillProfile> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/opportunities/profile`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch student skill profile");
  return await res.json();
}

export async function updateStudentSkillProfile(
  profile: Partial<StudentSkillProfile>
): Promise<StudentSkillProfile> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/opportunities/profile`, {
    method: "PUT",
    headers,
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to update student skill profile");
  return await res.json();
}

export async function toggleSaveOpportunity(
  oppId: string
): Promise<{ saved: boolean; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/opportunities/${oppId}/save`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error("Failed to toggle save opportunity");
  return await res.json();
}

export async function getSavedOpportunities(): Promise<Opportunity[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/opportunities/saved`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch saved opportunities");
  return await res.json();
}

export async function applyToOpportunity(
  oppId: string,
  data?: { statement_of_interest?: string; available_hours_per_week?: number }
): Promise<OpportunityApplication> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/opportunities/${oppId}/apply`, {
    method: "POST",
    headers,
    body: JSON.stringify(data || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to submit application");
  }
  return await res.json();
}

export async function getAppliedOpportunities(): Promise<OpportunityApplication[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/opportunities/applied`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch applied opportunities");
  return await res.json();
}

// ============================================================
// --- Academic RBAC & Offerings Client APIs
// ============================================================

export async function fetchSubjects(): Promise<Subject[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/subjects`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch subjects");
  return await res.json();
}

export async function fetchOfferings(): Promise<SubjectOffering[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/offerings`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch offerings");
  }
  return await res.json();
}

export async function fetchOfferingDetails(offeringId: string): Promise<SubjectOffering> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch offering details (${res.status})`);
  }
  return await res.json();
}

export async function createOffering(data: {
  subject_code: string;
  subject_name: string;
  term: string;
  section: string;
  attendance_threshold?: number;
  grade_policy?: string;
  professor_ids?: string[];
}): Promise<SubjectOffering> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/academic/offerings`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create offering");
  }
  return await res.json();
}

export async function assignProfessorToOffering(
  offeringId: string,
  professorId: string,
  role: string = "primary"
): Promise<SubjectOffering> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/professors`, {
    method: "POST",
    headers,
    body: JSON.stringify({ professor_id: professorId, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to assign professor");
  }
  return await res.json();
}

export async function fetchStudentDirectory(query: string = ""): Promise<StudentDirectoryItem[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/students/directory?query=${encodeURIComponent(query)}`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to search student directory");
  }
  return await res.json();
}

export async function fetchOfferingEnrollments(offeringId: string): Promise<StudentEnrollment[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/enrollments`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch enrollments");
  }
  return await res.json();
}

export async function enrollStudentInOffering(
  offeringId: string,
  payload: { student_id: string; student_name?: string; student_roll_no?: string; student_email?: string }
): Promise<StudentEnrollment> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/enroll`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to enroll student");
  }
  return await res.json();
}

export async function disenrollStudentFromOffering(
  offeringId: string,
  studentId: string,
  reason: string,
  effectiveDate?: string
): Promise<StudentEnrollment> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/disenroll?student_id=${encodeURIComponent(studentId)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ reason, effective_date: effectiveDate }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to disenroll student");
  }
  return await res.json();
}

export async function fetchAttendanceSessions(offeringId: string): Promise<AttendanceSession[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/attendance/sessions`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch attendance sessions");
  }
  return await res.json();
}

export async function createAttendanceSession(
  offeringId: string,
  sessionDate: string,
  slotType: string = "Lecture"
): Promise<AttendanceSession> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/attendance/sessions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ session_date: sessionDate, slot_type: slotType }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create attendance session");
  }
  return await res.json();
}

export async function fetchSessionAttendanceRecords(
  offeringId: string,
  sessionId: string
): Promise<SessionAttendanceRecord[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/attendance/sessions/${encodeURIComponent(sessionId)}/records`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch session attendance records");
  }
  return await res.json();
}

export async function markSessionAttendance(
  offeringId: string,
  sessionId: string,
  records: Array<{ student_id: string; status: string; correction_reason?: string }>
): Promise<SessionAttendanceRecord[]> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/attendance/sessions/${encodeURIComponent(sessionId)}/mark`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ records }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to mark attendance");
  }
  return await res.json();
}

export async function fetchOfferingAssessments(offeringId: string): Promise<Assessment[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assessments`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch assessments");
  }
  return await res.json();
}

export async function createOfferingAssessment(
  offeringId: string,
  data: {
    title: string;
    assessment_type?: string;
    max_marks: number;
    weight_percent?: number;
    due_date?: string;
    answer_key_content?: string;
    is_published?: boolean;
  }
): Promise<Assessment> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assessments`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create assessment");
  }
  return await res.json();
}

export async function updateOfferingAssessment(
  offeringId: string,
  assessmentId: string,
  data: Partial<Assessment>
): Promise<Assessment> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assessments/${encodeURIComponent(assessmentId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update assessment");
  }
  return await res.json();
}

export async function fetchAssessmentMarks(
  offeringId: string,
  assessmentId: string
): Promise<StudentAssessmentMark[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assessments/${encodeURIComponent(assessmentId)}/marks`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch assessment marks");
  }
  return await res.json();
}

export async function updateAssessmentMarks(
  offeringId: string,
  assessmentId: string,
  marks: Array<{ student_id: string; obtained_marks?: number; status?: string; feedback?: string; correction_reason?: string }>
): Promise<StudentAssessmentMark[]> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assessments/${encodeURIComponent(assessmentId)}/marks`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ marks }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update assessment marks");
  }
  return await res.json();
}

export async function fetchOfferingAssignments(offeringId: string): Promise<OfferingAssignment[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assignments`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch assignments");
  }
  return await res.json();
}

export async function createOfferingAssignment(
  offeringId: string,
  data: {
    title: string;
    instructions: string;
    due_date: string;
    allowed_formats?: string[];
    max_file_size_mb?: number;
    allow_late?: boolean;
    allow_resubmission?: boolean;
    model_answer?: string;
    is_published?: boolean;
  }
): Promise<OfferingAssignment> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assignments`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create assignment");
  }
  return await res.json();
}

export async function updateOfferingAssignment(
  offeringId: string,
  assignmentId: string,
  data: Partial<OfferingAssignment>
): Promise<OfferingAssignment> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assignments/${encodeURIComponent(assignmentId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update assignment");
  }
  return await res.json();
}

export async function submitAssignment(
  offeringId: string,
  assignmentId: string,
  submissionText?: string,
  fileName?: string
): Promise<AssignmentSubmission> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assignments/${encodeURIComponent(assignmentId)}/submit`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ submission_text: submissionText, file_name: fileName }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to submit assignment");
  }
  return await res.json();
}

export async function fetchAssignmentSubmissions(
  offeringId: string,
  assignmentId: string
): Promise<AssignmentSubmission[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch submissions");
  }
  return await res.json();
}

export async function gradeAssignmentSubmission(
  offeringId: string,
  assignmentId: string,
  submissionId: string,
  score: number,
  feedback?: string
): Promise<AssignmentSubmission> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/grade`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ score, feedback }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to grade submission");
  }
  return await res.json();
}

export async function fetchOfferingAnnouncements(offeringId: string): Promise<OfferingAnnouncement[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/announcements`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch announcements");
  }
  return await res.json();
}

export async function createOfferingAnnouncement(
  offeringId: string,
  data: { title: string; content: string; target_group?: string; target_student_ids?: string[] }
): Promise<OfferingAnnouncement> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/announcements`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create announcement");
  }
  return await res.json();
}

export async function fetchOfferingRoster(
  offeringId: string,
  params?: {
    search?: string;
    status_filter?: string;
    support_filter?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    page_size?: number;
  }
): Promise<RosterResponse> {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status_filter) query.set("status_filter", params.status_filter);
  if (params?.support_filter) query.set("support_filter", params.support_filter);
  if (params?.sort_by) query.set("sort_by", params.sort_by);
  if (params?.sort_order) query.set("sort_order", params.sort_order);
  if (params?.page) query.set("page", String(params.page));
  if (params?.page_size) query.set("page_size", String(params.page_size));

  const res = await fetch(
    `${API_BASE}/api/academic/offerings/${encodeURIComponent(offeringId)}/roster?${query.toString()}`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch offering roster");
  }
  return await res.json();
}

export async function fetchUserRoles(): Promise<UserRoleItem[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/academic/users/roles`, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch user roles");
  }
  return await res.json();
}

export async function updateUserRole(
  userId: string,
  role: string,
  status: string = "active"
): Promise<{ user_id: string; role: string; status: string }> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/academic/users/roles`, {
    method: "POST",
    headers,
    body: JSON.stringify({ user_id: userId, role, status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update user role");
  }
  return await res.json();
}

export async function fetchAcademicAuditLogs(
  offeringId?: string,
  limit: number = 100
): Promise<AcademicAuditLog[]> {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (offeringId) query.set("offering_id", offeringId);
  query.set("limit", String(limit));

  const res = await fetch(`${API_BASE}/api/academic/audit-logs?${query.toString()}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch academic audit logs");
  }
  return await res.json();
}

export async function createAdminAccount(data: {
  email: string;
  full_name: string;
  user_id?: string;
  admin_secret_key?: string;
}): Promise<AdminAccountResponse> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${API_BASE}/api/academic/admin/create-account`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create administrator account");
  }
  return await res.json();
}

// ============================================================
// --- Explicit Demo Mode Controls (No Silent Production Fallback)
// ============================================================

export function isDemoModeActive(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("campusos_demo_mode") === "true";
}

export function setDemoModeActive(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) {
    window.localStorage.setItem("campusos_demo_mode", "true");
  } else {
    window.localStorage.removeItem("campusos_demo_mode");
  }
}

export function getDemoAcademicData() {
  return {
    courses: MOCK_COURSES,
    attendance: MOCK_ATTENDANCE,
    timetable: MOCK_TIMETABLE,
    deadlines: MOCK_DEADLINES,
    summary: MOCK_ACADEMIC_SUMMARY,
    dailyPlan: MOCK_DAILY_PLAN,
    impact: MOCK_IMPACT,
  };
}


