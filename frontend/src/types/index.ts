export interface Course {
  id: string;
  course_code: string;
  course_name: string;
  credits: number;
  grade?: string | null;
  target_grade?: string;
  semester: number;
}

export interface AttendanceRecord {
  id: string;
  course_code: string;
  course_name: string;
  attended_classes: number;
  total_classes: number;
  percentage: number;
  status: "safe" | "warning" | "critical";
  safe_bunks: number;
  classes_needed_for_75: number;
}

export interface WhatIfAttendanceRequest {
  course_code: string;
  attended_classes: number;
  total_classes: number;
  upcoming_classes_to_attend: number;
  total_upcoming_classes: number;
}

export interface WhatIfAttendanceResponse {
  course_code: string;
  current_percentage: number;
  simulated_percentage: number;
  safe_bunks_allowed: number;
  classes_needed_for_75: number;
  status_assessment: "safe" | "warning" | "critical";
  advice: string;
}

export interface CourseGradeScenario {
  course_code: string;
  credits: number;
  target_grade: string;
}

export interface WhatIfGradeRequest {
  current_cgpa: number;
  completed_credits: number;
  target_cgpa: number;
  current_semester_courses: CourseGradeScenario[];
}

export interface WhatIfGradeResponse {
  target_cgpa: number;
  predicted_sgpa: number;
  predicted_cgpa: number;
  required_sgpa_for_target: number;
  is_feasible: boolean;
  summary: string;
}

export interface TimetableSlot {
  id: string;
  course_code: string;
  course_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  venue: string;
  slot_type: string;
}

export interface DeadlineTask {
  id: string;
  title: string;
  course_code?: string;
  due_date: string;
  status: "pending" | "completed";
  priority: "low" | "medium" | "high";
  source: "manual" | "copilot_action" | "syllabus";
}

export interface Citation {
  document_title: string;
  section_title: string;
  page_number: number;
  source_ref: string;
  excerpt: string;
}

export interface ActionableSuggestion {
  has_action: boolean;
  title: string;
  due_date: string;
  priority: "low" | "medium" | "high";
  course_code?: string;
  reason: string;
}

export interface CopilotQueryResponse {
  query: string;
  answered: boolean;
  answer: string;
  citations: Citation[];
  actionable_suggestion?: ActionableSuggestion | null;
}

export interface VaultDocument {
  id: string;
  title: string;
  category: "marksheets" | "certificates" | "receipts" | "identity" | "notes";
  tags: string[];
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  download_url?: string;
  created_at: string;
}

export interface ReuseItem {
  id: string;
  user_name: string;
  title: string;
  description: string;
  category: "books" | "electronics" | "lab_gear" | "hostel_essentials";
  listing_type: "donate" | "exchange" | "borrow";
  condition: "like_new" | "good" | "fair";
  estimated_retail_price: number;
  estimated_weight_kg: number;
  contact_info: string;
  status: "available" | "requested" | "completed";
  image_url?: string;
  completed_at?: string;
  created_at: string;
}

export interface CategoryImpact {
  count: number;
  money_saved_inr: number;
  weight_kg: number;
}

export interface ImpactMetrics {
  total_exchanges_completed: number;
  total_money_saved_inr: number;
  total_waste_diverted_kg: number;
  co2_avoided_kg: number;
  active_listings_count: number;
  categories: Record<string, CategoryImpact>;
}
