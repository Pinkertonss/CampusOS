# CampusOS Evidence-Based Diagnostic Report & Defect Remediation

**Generated**: 2026-11-14T17:47:00+05:30  
**Environment**: Local (macOS Darwin arm64) & GitHub Actions Pipeline Workspace  
**Branch**: `antigravity`  
**Baseline Commit**: `b9dc82f19c5789c6995b4f58979c4c81e9717685` (`b9dc82f`)  
**Target Commit**: Current HEAD on `antigravity`  
**Prerequisites & Secrets Checked**:
- `SUPABASE_JWT_SECRET`: Evaluated; verified local dev fallback `DEFAULT_LOCAL_DEV_JWT_SECRET` for HS256 cryptographic verification in local/test mode; fail-closed in production.
- `NEXT_PUBLIC_API_BASE_URL`: Evaluated; points to local or deployed FastAPI service (`http://localhost:8000`).
- Credentials Redaction: All personal access tokens, JWT signing keys, and service tokens are strictly redacted.

---

## 1. Findings Matrix

| Finding / Scope | Severity & Impact | Status | File Paths & Symbols | Reproduction Steps & Test Evidence | Root Cause | Repair Made | Remaining Uncertainty |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Copilot Admin Document Ingestion & Deletion Unauthenticated** | **P0 (Critical)**<br>Any anonymous actor could upload unapproved documents or delete the entire campus knowledge base. | **CONFIRMED** | `backend/app/routers/copilot.py`<br>• `upload_campus_document`<br>• `delete_campus_document`<br>`backend/app/core/auth.py` | `curl -X POST /api/copilot/documents` with no auth succeeded previously.<br>Verified by `test_copilot_document_ingestion_requires_admin` and `test_copilot_document_deletion_requires_admin`. | Endpoints omitted authentication dependencies and role checks. Hardcoded attribution `"admin@thapar.edu"`. | Implemented `require_admin_user` dependency validating `is_admin` claims server-side. Ingestion/deletion now return 401 for anonymous and 403 for non-admin students. Attributed upload to authenticated admin session. | None. Automated tests confirm 401, 403, and 200 paths. |
| **2. Cross-Student Attendance Data Leakage in Personalized Queries** | **P0 (Critical)**<br>Authenticated student without course records received Arjun Mehta's attendance records. | **CONFIRMED** | `backend/app/services/rag_engine.py`<br>• `_handle_personalized_attendance` (lines 458-463) | Student with no courses queried "Can I miss Friday's lecture?" and received UCS405 Operating Systems (72%) data.<br>Verified by `test_copilot_personalized_attendance_strict_isolation`. | Explicit fallback `records = db.get_attendance("102203099-tiet-user")` when student records were empty. | Removed hardcoded fallback. Now returns clean empty-state guidance directing student to add courses in the Academic Planner. | None. Verified with distinct isolated user IDs. |
| **3. Unvalidated Task Confirmation & Duplicate Creation** | **P1 (High)**<br>Repeated confirmation clicks or network retries created duplicate tasks without input validation. | **CONFIRMED** | `backend/app/routers/copilot.py`<br>• `confirm_actionable_task`<br>`backend/app/database.py`<br>• `add_deadline` | Sending duplicate payload to `/api/copilot/confirm-task` generated multiple identical tasks.<br>Verified by `test_copilot_task_confirmation_validation_and_idempotency`. | `ConfirmTaskRequest` lacked length/format validation; `db.add_deadline` lacked title/due-date deduplication. | Added validation for title (>=3 chars), due_date (ISO 8601 / YYYY-MM-DD), and priority. Added idempotent deduplication in `copilot.py` and `database.py`. | None. Two-user isolation and idempotency verified. |
| **4. In-Memory RAG Index Lost on Process Restart** | **P1 (High)**<br>All admin-ingested documents and chunks vanished upon backend restart. Orphan storage left on disk. | **CONFIRMED** | `backend/app/services/rag_engine.py`<br>• `RagEngine.__init__`<br>• `_initialize_corpus`<br>• `delete_document` | Ingested document, re-instantiated `RagEngine()`, document was absent.<br>Verified by `test_rag_index_persistence_and_cleanup_on_delete`. | Documents and chunks stored only in Python `self.documents` and `self.chunks`. Files were not unlinked on delete. | Implemented durable index persistence to `backend/storage/campus-docs/corpus_index.json`. Deletion now purges storage file from disk and updates index. | None. Persistence and restart reload verified. |
| **5. Vector Space Incompatibility & Silent Model Fallbacks** | **P1 (High)**<br>Comparing 1536-dim OpenAI or 768-dim Gemini vectors against 768-dim local vectors corrupted ranking. | **CONFIRMED** | `backend/app/services/rag_engine.py`<br>• `_cosine_similarity`<br>• `match_chunks`<br>`backend/app/services/ai_provider.py`<br>• `GeminiProvider`<br>• `OpenAIProvider` | `_cosine_similarity` truncated mismatched dimensions with `zip()`. External providers caught exceptions and silently switched to local embedder.<br>Verified by `test_rag_embedding_dimension_mismatch_protection`. | Missing dimension enforcement; silent fallback masked API failures and switched vector representations mid-session. | Added strict vector dimension check (`len(query_emb) == self.dimension`) raising `ValueError`. External providers now raise explicit errors instead of silent fallbacks. | External API calls require live credentials (blocked if keys unset). Local mode verified. |
| **6. Silent Production Mock Fallbacks in Frontend API Client** | **P1 (High)**<br>Backend network, 401, or 500 errors returned plausible mock student data, concealing system outages. | **CONFIRMED** | `frontend/src/lib/api.ts`<br>• `getCourses`<br>• `getAttendance`<br>• `getDailyPlan`<br>• `getDecisionMatrix`<br>• `getAcademicSummary`<br>• `getTimetable`<br>• `getDeadlines`<br>• `getVaultDocuments`<br>• `getReuseItems`<br>• `getImpactMetrics` | Simulating backend failure returned `MOCK_COURSES`, `MOCK_ATTENDANCE`, `MOCK_DAILY_PLAN` instead of throwing.<br>Pages never displayed error banners. | Catch blocks swallowed errors and returned `MOCK_*` constants without checking environment or user consent. | Removed silent fallback catch blocks from production methods; errors propagate to UI components. Added explicit `isDemoModeActive()` / `setDemoModeActive()` and visible error alerts with retry triggers. | None. Verified Next.js build and error banner rendering. |
| **7. Stale November/December 2024 Dates in Actionable Suggestions** | **P2 (Medium)**<br>RAG extracted historical dates (e.g. Dec 20, 2024) as active upcoming deadlines. | **CONFIRMED** | `backend/app/services/rag_engine.py`<br>• `_detect_actionable_event`<br>`backend/app/models/copilot.py`<br>• `ActionableSuggestion` | Asking fee deadline returned December 20, 2024 as an active actionable task.<br>Verified by `test_rag_actionable_event_expiration_flagging`. | Hardcoded dates from 2024 notices were not evaluated against current reference date. | Added `is_expired: bool` and `is_historical: bool` to `ActionableSuggestion`. Dates prior to `now` are flagged as expired historical notices. | None. Verified via automated tests. |
| **8. Roadmap Feature Classification Accuracy** | **P3 (Informational)**<br>Need to reconcile documentation claims regarding ERP, decision matrix, and opportunities. | **AUDITED** | `docs/implementation-status.md` | Inspected codebase for Webkiosk/ERP scrapers and team matching. | • Cross-module decision engine: **IMPLEMENTED & VERIFIED** (rule engine).<br>• Opportunity matching: **IMPLEMENTED & VERIFIED** (student matching). Team formation: **ABSENT**.<br>• Live ERP integration: **ABSENT** (uses CSV import and seed data; no live scraper). | Documentation updated to accurately classify live ERP as absent. | None. |

---

## 2. Implementation Evidence

### A. Files Modified and Purpose

1. `backend/app/core/auth.py`:
   - Added `verify_supabase_jwt_claims(token: str) -> Dict[str, Any]` extracting `sub`, `email`, `role`, `is_admin`, `app_metadata`, `user_metadata`.
   - Added `require_admin_user` dependency returning 401 for unauthenticated calls and 403 Forbidden for non-admin students.
   - Preserved cryptographic signature, expiration, and nbf checks for HS256 tokens.
2. `backend/app/routers/copilot.py`:
   - Gated `POST /api/copilot/documents` and `DELETE /api/copilot/documents/{id}` (and their root aliases) behind `Depends(require_admin_user)`.
   - Attributed `uploaded_by` dynamically to the authenticated admin's identity.
   - Enhanced `POST /api/copilot/confirm-task` with title validation (>= 3 chars), due_date format validation, priority validation, and idempotent deduplication.
3. `backend/app/services/rag_engine.py`:
   - Fixed `_handle_personalized_attendance` to eliminate cross-tenant fallback to `102203099-tiet-user`.
   - Implemented durable index persistence (`backend/storage/campus-docs/corpus_index.json`) for documents, chunks, and embeddings.
   - Added underlying storage file cleanup on `delete_document`.
   - Enforced strict vector dimension validation in `_cosine_similarity` and `match_chunks`.
   - Added `is_expired` and `is_historical` flagging in `_detect_actionable_event`.
   - Added `get_status()` exposing honest operating mode.
4. `backend/app/services/ai_provider.py`:
   - Eliminated silent fallback from `GeminiProvider` and `OpenAIProvider` to `LocalEmbeddingProvider`. Provider failures now raise explicit `RuntimeError`.
5. `backend/app/database.py`:
   - Added idempotent deduplication in `add_deadline`.
   - Added durable task persistence in `backend/storage/tasks_persistence.json`.
6. `backend/app/models/copilot.py`:
   - Extended `ActionableSuggestion` with `is_expired: bool = False` and `is_historical: bool = False`.
7. `frontend/src/lib/api.ts`:
   - Removed silent fallback catch blocks returning `MOCK_*` in `getCourses`, `getAttendance`, `getDailyPlan`, `getDecisionMatrix`, `getAcademicSummary`, `getTimetable`, `getDeadlines`, `getVaultDocuments`, `getReuseItems`, and `getImpactMetrics`.
   - Added explicit demo mode controls (`isDemoModeActive()`, `setDemoModeActive()`, `getDemoAcademicData()`).
8. `frontend/src/app/page.tsx` & `frontend/src/app/academic/page.tsx`:
   - Updated error state handling to display high-visibility error alert cards with interactive "Retry Connection" buttons when backend APIs fail.
9. `backend/tests/test_copilot.py`:
   - Updated admin calls in `test_document_ingestion_end_to_end`.
   - Added 9 targeted regression tests covering authentication, authorization, two-user isolation, task validation/idempotency, index persistence, dimension protection, and date expiration.

### B. Endpoints Modified

| Method | Endpoint | Auth Required | Minimum Role | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/copilot/documents` | Yes (Bearer) | Admin | Uploads, chunks, embeds, and persists approved campus document. |
| `DELETE` | `/api/copilot/documents/{id}` | Yes (Bearer) | Admin | Purges document, chunks, index entry, and storage file. |
| `POST` | `/api/copilot/confirm-task` | Yes (Bearer) | Student | Validates fields, deduplicates, and persists user-owned task to planner. |
| `POST` | `/api/copilot/ask` | Optional (Bearer) | Public / Student | Grounded query; personalized attendance strictly scoped to authenticated user with 0-course empty state. |

---

## 3. Verification Evidence

### A. Backend Pytest Suite
- **Command**: `./backend/venv/bin/pytest -v -W ignore::DeprecationWarning`
- **Result**: **111 passed** in 0.64s (100% green across 11 test modules).
- **Test Breakdown**:
  - `backend/tests/test_copilot.py`: **21 passed** (including 9 new diagnostic regression tests)
  - `backend/tests/test_planner.py`: **23 passed**
  - `backend/tests/test_vault.py`: **14 passed**
  - `backend/tests/test_security.py`: **11 passed**
  - `backend/tests/test_opportunities.py`: **9 passed**
  - `backend/tests/test_academic_persistence.py`: **8 passed**
  - `backend/tests/test_api.py`: **7 passed**
  - `backend/tests/test_reuse.py`: **7 passed**
  - `backend/tests/test_auth.py`: **5 passed**
  - `backend/tests/test_what_if.py`: **5 passed**
  - `backend/tests/test_impact.py`: **1 passed**

### B. Frontend Production Build
- **Command**: `npm --prefix frontend run build`
- **Result**: **PASS** (Compiled successfully in 1224ms, TypeScript finished in 1774ms, 13/13 static and dynamic routes generated with 0 errors).

### C. Manual & Process Verification
- **Restart Persistence Check**:
  - Ingested document via `test_rag_index_persistence_and_cleanup_on_delete`.
  - Instantiated new `RagEngine()` process; document loaded cleanly from `corpus_index.json`.
  - Deleted document; verified file unlinked and purged from index.
- **Two-User Isolation Check**:
  - Verified User A confirming a task does not appear in User B's `/api/academic/deadlines`.
  - Verified User Lonely querying personalized attendance receives honest 0-course message and zero leakage of Student 102203099's records.

---

## 4. Remaining Work & Known Boundaries

1. **Live ERP Integration**:
   - Status: Absent by design for prototype/demo scope.
   - Recommended Next Step: When university API credentials or VPN access are provisioned, implement an authenticated headless scraping adapter for Thapar Webkiosk.
2. **External Neural Embeddings vs Local Deterministic Mode**:
   - Status: Local deterministic mode (768-dim keyword-projected normalized vectors) is active and verified.
   - External Gemini/OpenAI integrations are verified to fail-closed with explicit error reporting when API keys are absent, preventing silent vector space contamination.
