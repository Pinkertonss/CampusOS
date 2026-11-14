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
  page_ref?: string;
  snippet?: string;
  section_title?: string;
  page_number?: number;
  source_ref?: string;
  excerpt?: string;
  issuing_body?: string;
  official_reference?: string;
  effective_date?: string;
  publication_date?: string;
  review_status?: string;
  is_archived?: boolean;
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
  confidence?: number;
  grounded?: boolean;
  actionable_suggestion?: ActionableSuggestion | null;
}

export interface CampusDocument {
  id: string;
  title: string;
  source_label: string;
  storage_path: string;
  uploaded_by: string;
  is_approved: boolean;
  chunk_count: number;
  file_size_bytes: number;
  issuing_body?: string;
  official_reference?: string;
  publication_date?: string;
  effective_date?: string;
  review_status?: string;
  approval_reviewer?: string;
  version?: string;
  is_archived?: boolean;
  created_at: string;
}

export interface DocumentUploadResponse {
  document: CampusDocument;
  chunks_created: number;
  message: string;
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


// ============================================================
// Academic Planner & Dashboard Types
// ============================================================

export interface DailyActionItem {
  id: string;
  category: "attendance" | "deadline" | "task" | "conflict" | string;
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  course_code?: string;
  current_percent?: number;
  due_date?: string;
  schedule_info?: string;
  conflict_warning?: string;
  risk_score?: number;
  reason: string;
  action_required?: string;
}

export interface DailyPlanResponse {
  date: string;
  total_actions: number;
  urgent_count: number;
  high_count: number;
  conflicts_count?: number;
  recommended_focus?: string;
  actions: DailyActionItem[];
}

export interface ScheduleSlot {
  course_code: string;
  course_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  venue: string;
  slot_type: string;
  current_attendance_percent: number;
  attendance_status: string;
  is_attendance_mandatory: boolean;
}

export interface DecisionMatrixResponse {
  date: string;
  recommended_focus: string;
  conflicts: DailyActionItem[];
  today_schedule: ScheduleSlot[];
  priorities: DailyActionItem[];
  academic_standing_summary: {
    safe: number;
    warning: number;
    critical: number;
  };
}

// ============================================================
// Opportunity Matching & Recommendations Types
// ============================================================

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  mentor_name?: string;
  category: "research" | "hackathon" | "project" | "club" | "tutoring" | string;
  description: string;
  required_skills: string[];
  preferred_branches: string[];
  min_cgpa?: number;
  time_commitment_hrs_week: number;
  location: string;
  schedule_requirement?: string;
  deadline?: string;
  status: "open" | "closed";
  application_link?: string;
  contact_email?: string;
  created_at: string;
}

export interface OpportunityRecommendation {
  opportunity: Opportunity;
  match_score: number;
  skill_match_percent: number;
  matched_skills: string[];
  missing_skills: string[];
  schedule_compatible: boolean;
  schedule_collision_warning?: string;
  academic_advisory?: string;
  recommendation_reason: string;
}

export interface OpportunityRecommendationResponse {
  student_id: string;
  total_evaluated: number;
  recommendations: OpportunityRecommendation[];
  student_skills: string[];
  opt_in_matching: boolean;
}

export interface StudentSkillProfile {
  user_id: string;
  skills: string[];
  interests: string[];
  opt_in_matching: boolean;
  available_hours_per_week: number;
  preferred_categories: string[];
}

export interface AcademicSummaryCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  attended: number;
  total_held: number;
  percentage: number;
  status: "safe" | "warning" | "critical";
  safe_bunks_remaining: number;
  classes_needed_for_75: number | null;
}

export interface AcademicSummaryResponse {
  student_name: string;
  roll_no: string;
  branch: string;
  semester: number;
  overall_attendance_percent: number;
  courses_at_risk_count: number;
  total_courses: number;
  courses: AcademicSummaryCourse[];
  assessments_summary: {
    current_weighted_score: number;
    completed_weight: number;
    remaining_weight: number;
    total_planned_weight: number;
  };
}

export interface AttendanceWhatIfPlannerRequest {
  course_code?: string;
  attended: number;
  total_held: number;
  attend_next_n: number;
  skip_next_m: number;
  target_percent?: number;
}

export interface AttendanceWhatIfPlannerResponse {
  course_code?: string;
  current_attended: number;
  current_total_held: number;
  current_percent: number;
  current_status: string;
  current_safe_bunks: number;
  current_classes_needed: number | null;
  attend_next_n: number;
  skip_next_m: number;
  projected_attended: number;
  projected_total_held: number;
  projected_percent: number;
  projected_status: string;
  projected_safe_bunks: number;
  projected_classes_needed: number | null;
  target_percent: number;
  message: string;
}

export interface AssessmentItem {
  id?: string;
  name: string;
  weight_percent: number;
  max_marks: number;
  obtained_marks?: number | null;
  due_date?: string;
}

export interface GradeWhatIfPlannerRequest {
  course_code?: string;
  assessments?: AssessmentItem[];
  target_total_percent?: number;
  hypothetical_scores?: Record<string, number>;
}

export interface GradeWhatIfPlannerResponse {
  current_weighted_score: number;
  completed_weight: number;
  remaining_weight: number;
  target_total_percent?: number;
  required_percent_on_remaining?: number | null;
  is_achievable?: boolean | null;
  projected_total_score?: number | null;
  projected_letter_grade?: string | null;
  message: string;
}

// --- Digital Vault End-to-End API Types ---

export type VaultCategory = "notes" | "certificate" | "academic" | "other";

export interface VaultItem {
  id: string;
  user_id?: string;
  title: string;
  category: VaultCategory | string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  download_url?: string;
}

export interface VaultListResponse {
  items: VaultItem[];
  total_count: number;
  total_storage_bytes: number;
  total_size_bytes?: number;
  storage_limit_bytes: number;
  max_storage_bytes?: number;
}

export interface UploadUrlRequest {
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface UploadUrlResponse {
  upload_url: string;
  storage_path: string;
  expires_in_seconds: number;
}

export interface VaultItemCreate {
  title: string;
  category: VaultCategory | string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}

export interface VaultItemUpdate {
  title?: string;
  category?: VaultCategory | string;
}

export interface DownloadUrlResponse {
  download_url: string;
  expires_in_seconds: number;
  title: string;
}

// --- Campus Reuse End-to-End Types ---

export type ListingCategory = "book" | "calculator" | "labcoat" | "other";
export type ListingMode = "exchange" | "donate" | "borrow";
export type ListingStatus = "available" | "reserved" | "completed";
export type ItemCondition = "like_new" | "good" | "fair";

export interface Listing {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  description: string;
  category: ListingCategory | string;
  mode: ListingMode | string;
  condition: ItemCondition | string;
  status: ListingStatus | string;
  image_url?: string | null;
  contact_info?: string | null;
  estimated_retail_price?: number;
  estimated_weight_kg?: number;
  created_at: string;
  requests_count?: number;
  user_has_requested?: boolean;
  active_request_id?: string | null;
}

export interface ListingCreate {
  title: string;
  description?: string;
  category: string;
  mode: string;
  condition: string;
  image_url?: string | null;
  contact_info?: string | null;
  estimated_retail_price?: number;
  estimated_weight_kg?: number;
}

export interface ExchangeRequest {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_mode: string;
  listing_category: string;
  requester_id: string;
  requester_name: string;
  requester_contact?: string | null;
  message?: string | null;
  owner_id: string;
  owner_name: string;
  status: "pending" | "accepted" | "declined" | "completed" | string;
  owner_confirmed: boolean;
  requester_confirmed: boolean;
  created_at: string;
  completed_at?: string | null;
}

export interface MyListingItem {
  listing: Listing;
  requests: ExchangeRequest[];
}

export interface MonthlyImpactSeries {
  month: string;
  exchanges: number;
  donations: number;
  loans: number;
  total: number;
  co2_kg: number;
  waste_kg: number;
  money_saved_inr: number;
}

export interface ReuseImpactResponse {
  exchanges_completed: number;
  donations_completed: number;
  loans_completed: number;
  total_completed: number;
  items_kept_in_use: number;
  total_money_saved_inr: number;
  total_waste_diverted_kg: number;
  co2_avoided_kg: number;
  sdg_framework: string;
  per_month_series: MonthlyImpactSeries[];
}

export interface ReuseNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  listing_id: string;
  request_id?: string | null;
  created_at: string;
  read: boolean;
}

export interface NotificationsResponse {
  unread_count: number;
  notifications: ReuseNotification[];
}

