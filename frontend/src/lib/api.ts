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
} from "../types";
import {
  MOCK_COURSES,
  MOCK_ATTENDANCE,
  MOCK_TIMETABLE,
  MOCK_DEADLINES,
  MOCK_VAULT_DOCS,
  MOCK_REUSE_ITEMS,
  MOCK_IMPACT,
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
