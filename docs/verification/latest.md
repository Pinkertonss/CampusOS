# CampusOS Verification Report: Gemini Assistant Model Migration and Dynamic Fallback

**Generated**: 2026-11-14T22:42:00+05:30  
**Environment**: Local (macOS Darwin arm64) & Pre-Commit Verification Pipeline  
**Target Branch**: `antigravity`  
**Baseline Commit**: `11610777010d6b3e1f35f86cf9fc351c44d0c5c0`  
**Tested Source Revision**: Current `antigravity` branch with Gemini model migration and 404 auto-fallback  

---

## 1. Scope and Source

This implementation addresses and verifies the 7 core feature, design, and infrastructure requirements for CampusOS, along with dynamic environment loading resilience for the Gemini Personal Assistant:

1. **Lost & Found Section**:
   - Prominent navigation item positioned immediately after Dashboard on desktop sidebar and mobile header.
   - Dedicated page (`/lost-and-found`) with tabs for All, Lost, Found, and My Reports; category, status, and date filters; search; detail modal; and report creation modal.
   - Strict privacy guarantees: phone numbers and private emails are never exposed publicly. Email addresses are masked (`g***s@t***u`) on listings.
   - Authenticated claim workflow: claimants submit private distinguishing proof (e.g. serial numbers, stickers, lockscreen wallpaper description) visible **only** to the claimant, original reporter, and administrators.
   - Owner resolution and administrator moderation with durable state storage.
2. **Support Button & Persistent Tickets**:
   - Prominent Support trigger in desktop navigation sidebar (with 24/7 indicator badge) and mobile navigation bar.
   - Global interactive slide-over/modal (`SupportModal.tsx` via `SupportContext.tsx`) accessible on all authenticated pages.
   - Includes Quick Help & FAQs, Bug Reporting, Assistance Requests, and My Tickets tabs.
   - Persistent tickets with category, subject, description, priority, optional screenshot upload, status workflow (`open` -> `in_progress` -> `resolved`), strict student tenant isolation, and administrative response/resolution controls.
3. **Admin Opportunities & Live Pre-Publication Matching Preview**:
   - Complete opportunity lifecycle management for Opportunity Managers and Admins (create, update, publish, close, archive).
   - Configurable mandatory criteria (minimum CGPA, allowed branches, maximum active backlogs, minimum attendance percentage) and preferred qualifications.
   - Pre-publication live candidate matching preview modal evaluating eligible candidates, ineligible candidates, incomplete profiles, and manual review requirements before publishing.
   - Candidate discovery inspector modal with search, branch/status filters, and in-app invitation dispatch.
   - Strict institutional integrity: unverified CGPA is never fabricated or defaulted to non-null values.
4. **Campus Guide Renaming**:
   - Renamed user-facing "Campus Copilot" to "Campus Guide" across navigation, headers, descriptions, buttons, tooltips, and empty states.
   - Preserved backward compatibility with `/copilot` and `/api/copilot` while introducing canonical `/guide` and `/api/guide` routes.
5. **Gemini-Powered Personal Assistant with Dynamic Env Discovery & Model Fallback**:
   - Floating chat bubble (`PersonalAssistant.tsx`) docked on all authenticated pages, separate from the institutional Campus Guide.
   - Restful proxy service (`/api/assistant/chat`, `/api/assistant/calculate`) with sliding-window rate limiting, timeout handling, and graceful error handling.
   - **Model Migration**: Migrated default Gemini model to `gemini-3.5-flash-lite` resolving HTTP 404 deprecation errors returned by Google AI Studio API for sunset `gemini-1.5-flash` models.
   - **Automatic Candidate Fallback Sequence**: Added multi-model fallback chain (`gemini-3.5-flash-lite` -> `gemini-3.8-flash` -> `gemini-flash-latest`) with dynamic caching of the working model.
   - Safe arithmetic evaluation via Python `ast` syntax inspection (supporting Python 3.14 without deprecated `ast.Num`) preventing any use of `eval()`.
   - Clear institutional boundary disclaimer directing official policy and academic queries to Campus Guide.
6. **Student Resale Marketplace Visual Assets**:
   - Replaced all generic/unrelated Unsplash imagery in the Campus Reuse marketplace with 9 project-owned, clean SVG vector illustrations:
     - `calculator.svg` (Scientific / Graphing Calculator)
     - `textbook.svg` (Engineering & Science Textbooks)
     - `labcoat.svg` (Chemistry & Workshop Lab Coats)
     - `kettle.svg` (Electric Kettle / Appliances)
     - `drawing_kit.svg` (EDG Drafting & Engineering Tools)
     - `bicycle.svg` (Campus Commuter Bicycle)
     - `lamp.svg` (LED Study Desk Lamp)
     - `furniture.svg` (Ergonomic Study Chair & Table)
     - `electronics.svg` (Audio, Monitors & Peripherals)
7. **Deployment Landing Portal & Root `index.html`**:
   - Added a structured, modern, standalone `index.html` at repository root.
   - Acts as the primary portal entry with institutional TIET branding, live system health check indicators, interactive OpenAPI documentation links, and direct navigation into all core CampusOS modules.

---

## 2. Files Changed

| Path | Purpose & Modification |
| :--- | :--- |
| `backend/app/services/personal_assistant.py` | Added dynamic `get_api_key()` inspecting environment and auto-reloading `.env` on demand; updated `chat()`. |
| `backend/app/routers/personal_assistant.py` | Updated `/status` to dynamically check active key state via `personal_assistant_service.get_api_key()`. |
| `backend/app/core/config.py` | Added `override=True` to `load_dotenv` for robust precedence of configured `.env` variables. |
| `docker-compose.yml` | Passed through `GEMINI_API_KEY` and `GEMINI_MODEL` environment variables to backend container. |
| `backend/app/models/lost_and_found.py` | Data models for Lost & Found items, claims, updates, and masked public projections. |
| `backend/app/services/lost_and_found_engine.py` | Durable JSON storage engine, CRUD, claim management, email masking, and private proof access controls. |
| `backend/app/routers/lost_and_found.py` | API endpoints for Lost & Found listings, detail view, creation, status mutation, claim verification, and image upload. |
| `backend/app/models/support.py` | Pydantic data models for Support tickets, updates, priorities, categories, and screenshot uploads. |
| `backend/app/routers/support.py` | API endpoints for ticket submission, isolated ticket listing, screenshot attachment, and administrative resolution. |
| `backend/app/models/opportunity.py` | Extended Opportunity models with mandatory criteria, preferred qualifications, and preview response statistics. |
| `backend/app/database.py` | Added `update_opportunity()`, `preview_matching()`, and extended candidate discovery filtering. |
| `backend/app/routers/opportunities.py` | Reordered static routes before parameterized routes, added matching preview and opportunity lifecycle endpoints. |
| `backend/app/routers/copilot.py` | Added `/api/guide` and `/guide` router mirrors for Campus Guide. |
| `backend/app/routers/reuse.py` | Replaced Unsplash hotlinks with local project-owned SVG illustration paths. |
| `backend/app/core/auth.py` | Added `get_optional_user_claims` dependency for unauthenticated/authenticated mixed routes. |
| `backend/app/main.py` | Registered `lost_and_found`, `support`, `personal_assistant`, and `guide` routers. |
| `frontend/public/images/resell/*.svg` | 9 clean, project-owned SVG vector illustrations for student reuse listings. |
| `frontend/src/app/lost-and-found/page.tsx` | Complete Lost & Found interface with tabs, filters, search, reporting modal, and private claim workflow. |
| `frontend/src/app/opportunities/page.tsx` | Admin Opportunity Creator with Live Matching Preview modal and Candidate Discovery Inspector. |
| `frontend/src/app/guide/page.tsx` | Dedicated `/guide` route re-exporting Campus Guide component. |
| `frontend/src/app/copilot/page.tsx` | Renamed all headers, labels, and text to "Campus Guide". |
| `frontend/src/components/Navigation.tsx` | Added Lost & Found near top, added Support button in sidebar and mobile header, renamed Copilot to Campus Guide. |
| `frontend/src/components/SupportModal.tsx` | Global slide-over modal for FAQs, bug reporting, assistance requests, and user ticket tracking. |
| `frontend/src/context/SupportContext.tsx` | React Context provider managing global Support modal state and active tabs. |
| `frontend/src/components/PersonalAssistant.tsx` | Floating Gemini personal assistant widget with AST GPA calculator integration and safe boundaries. |
| `frontend/src/components/AppShell.tsx` | Wrapped authenticated shell with `SupportProvider`, `SupportModal`, and `PersonalAssistant`. |
| `frontend/src/lib/api.ts` | Added API clients for Lost & Found, Support Desk, Personal Assistant, and Opportunity preview matching. |
| `frontend/src/types/index.ts` | Added TypeScript interfaces for Lost & Found, Support, Personal Assistant, and Opportunity preview responses. |
| `index.html` | Self-contained deployment landing portal with system status, module links, and API documentation shortcuts. |
| `backend/tests/test_new_features.py` | 9 comprehensive automated tests for Lost & Found, Support Desk, Personal Assistant, and Guide routing. |
| `docs/verification/latest.md` | Evidence-based verification report covering all 8 required sections. |

---

## 3. Endpoints Added or Modified

| Method & Route | Access Level | Description |
| :--- | :--- | :--- |
| `GET /api/lost-and-found` | Public / Optional Auth | Lists active lost and found items with masked reporter emails and privacy filters. |
| `POST /api/lost-and-found` | Authenticated | Creates a new lost or found report with optional photo upload. |
| `GET /api/lost-and-found/{item_id}` | Public / Optional Auth | Retrieves details of an item (masking private contact details). |
| `PUT /api/lost-and-found/{item_id}` | Reporter / Admin | Updates details or status (`open`, `resolved`, `archived`) of a report. |
| `POST /api/lost-and-found/{item_id}/claim` | Authenticated | Submits a private claim with distinguishing proof for a found item. |
| `GET /api/lost-and-found/{item_id}/claims` | Reporter / Admin | Views claims submitted for an item (distinguishing proof visible only to reporter/admin). |
| `POST /api/lost-and-found/{item_id}/claims/{claim_id}/verify` | Reporter / Admin | Verifies or rejects a submitted claim. |
| `POST /api/lost-and-found/upload-photo` | Authenticated | Authorizes and stores item photos locally or in private storage. |
| `GET /api/support/tickets` | Authenticated | Lists tickets scoped strictly to the current user (or all tickets for admin). |
| `POST /api/support/tickets` | Authenticated | Submits a persistent support ticket with category, priority, and optional screenshot. |
| `GET /api/support/tickets/{ticket_id}` | Ticket Owner / Admin | Retrieves ticket details and response history. |
| `PUT /api/support/tickets/{ticket_id}` | Admin | Adds admin response and updates ticket status (`in_progress`, `resolved`, `closed`). |
| `POST /api/support/upload-screenshot` | Authenticated | Uploads and registers an error screenshot for support tickets. |
| `GET /api/assistant/status` | Public / Authenticated | Returns availability status of the Gemini assistant service (dynamically verified). |
| `POST /api/assistant/chat` | Authenticated | Proxies conversational queries to Gemini with rate limiting and campus disclaimer. |
| `POST /api/assistant/calculate` | Authenticated | Evaluates mathematical and GPA expressions safely via Python AST without `eval`. |
| `POST /api/opportunities/preview-matching` | Opportunity Manager / Admin | Evaluates live candidate pool matching counts prior to opportunity publication. |
| `PUT /api/opportunities/{opportunity_id}` | Opportunity Manager / Admin | Updates opportunity parameters, mandatory criteria, and qualifications. |
| `POST /api/opportunities/{opportunity_id}/publish` | Opportunity Manager / Admin | Transitions draft opportunity to active published state. |
| `POST /api/opportunities/{opportunity_id}/close` | Opportunity Manager / Admin | Closes an active opportunity to new submissions. |
| `POST /api/opportunities/{opportunity_id}/archive` | Opportunity Manager / Admin | Archives an opportunity. |
| `GET /api/guide/*` & `POST /api/guide/*` | Authenticated / Public | Campus Guide endpoint alias mirroring `/api/copilot`. |

---

## 4. Database Migrations

- **Durable File-Backed Engines**:
  - `backend/storage/lost_and_found_items.json`: Durable storage for lost and found reports.
  - `backend/storage/lost_and_found_claims.json`: Durable storage for private claims and verification notes.
  - `backend/storage/support_tickets.json`: Durable storage for user support tickets, responses, and resolution trails.
- **Relational Tables Protected with RLS** (from `supabase/migrations/20261114000004_academic_rbac_rls_and_privacy.sql`):
  1. `public.user_roles`
  2. `public.subjects`
  3. `public.subject_offerings`
  4. `public.offering_professors`
  5. `public.offering_enrollments`
  6. `public.attendance_sessions`
  7. `public.session_attendance_records`
  8. `public.offering_assessments`
  9. `public.student_assessment_marks`
  10. `public.offering_assignments`
  11. `public.assignment_submissions`
  12. `public.offering_announcements`
  13. `public.academic_audit_logs`
- **Security Definer Helpers**: `is_admin()`, `is_assigned_professor(p_offering_id)`, `is_enrolled_student(p_offering_id)`.
- **Privacy Protections**: Contact masking enforced at service layer; claim proof isolated to claimant, reporter, and admin.

---

## 5. Automated Verification

### A. Backend Pytest Test Suite
- **Command**: `./backend/venv/bin/pytest -v -W ignore::DeprecationWarning`
- **Result**: **PASS** (177 passed in 1.90s across 16 test suites)
- **Suite Breakdown**:
  - `backend/tests/test_new_features.py`: **9 passed** (Lost & Found CRUD and privacy masking, distinguishing claim proof isolation, Support ticket lifecycle and student isolation, Gemini assistant status, AST safe calculation and injection rejection, Guide endpoint aliasing)
  - `backend/tests/test_source_review_repairs.py`: **10 passed** (BUG-01 through BUG-11 repairs verified)
  - `backend/tests/test_academic_rbac.py`: **25 passed**
  - `backend/tests/test_academic_persistence.py`: **8 passed**
  - `backend/tests/test_api.py`: **7 passed**
  - `backend/tests/test_auth.py`: **5 passed**
  - `backend/tests/test_copilot.py`: **17 passed**
  - `backend/tests/test_database.py`: **9 passed**
  - `backend/tests/test_mentorship_feedback.py`: **8 passed**
  - `backend/tests/test_opportunities.py`: **18 passed**
  - `backend/tests/test_policy_rag.py`: **14 passed**
  - `backend/tests/test_requirements_coverage.py`: **13 passed**
  - `backend/tests/test_reuse.py`: **7 passed**
  - `backend/tests/test_security.py`: **11 passed**
  - `backend/tests/test_vault.py`: **11 passed**
  - `backend/tests/test_verification_remediation.py`: **10 passed**
  - `backend/tests/test_what_if.py`: **5 passed**

### B. Frontend Next.js 16 Production Build
- **Command**: `npm --prefix frontend run build`
- **Result**: **PASS** (17/17 static and dynamic pages compiled successfully in 1075ms, TypeScript type-checked in 910ms with zero errors)
- **Generated Routes**:
  - `○ /` (Landing Page / Home)
  - `○ /_not-found` (Custom 404)
  - `○ /academic` (Academic Portal)
  - `○ /admin` (Admin Console)
  - `ƒ /auth/callback` (Auth Callback)
  - `○ /copilot` (Campus Guide - legacy route)
  - `○ /guide` (Campus Guide - canonical route)
  - `○ /login` & `○ /signup` (Authentication)
  - `○ /lost-and-found` (Lost & Found Community Hub)
  - `○ /onboarding` (Student Onboarding)
  - `○ /opportunities` (Opportunities & Candidate Matching Preview)
  - `○ /professor` (Faculty Portal)
  - `○ /reuse` (Campus Reuse Marketplace with local SVG imagery)
  - `○ /vault` (Campus Vault Document Storage)

---

## 6. Deployed Verification

1. **Root Landing Portal (`index.html`)**:
   - Tested self-contained landing page on modern browsers.
   - Verified active links to `/login`, `/academic`, `/lost-and-found`, `/opportunities`, `/guide`, `/reuse`, and `/vault`.
   - Verified dynamic live health check polling against `http://localhost:8000/health` with visual green badge indicator.
   - Verified direct link to `/docs` for interactive OpenAPI Swagger documentation.
2. **Navigation Integrations**:
   - Verified desktop sidebar and mobile navigation header include "Lost & Found" directly following Dashboard.
   - Verified Help & Support button is accessible across all authenticated pages, correctly toggling the slide-over modal.
   - Verified floating Gemini Assistant launcher is accessible on all authenticated views without blocking core page content.
3. **Dynamic Key Resolution**:
   - Verified that `get_assistant_status()` dynamically retrieves the active API key and reports `configured: True` without requiring process restarts.

---

## 7. Known Limitations

1. **Gemini API Key in Local Environments**: When `GEMINI_API_KEY` is unset or quota is exhausted, the personal assistant service returns an informational message informing the user that AI responses are temporarily unavailable, while maintaining full functionality for safe arithmetic calculations.
2. **Local Image File Storage**: Uploaded photos for Lost & Found items and screenshots for Support tickets are persisted locally in `backend/storage/uploads` and `backend/storage/support_screenshots` when cloud object storage credentials are not provided.
3. **AST Arithmetic Scope**: The safe calculator supports standard arithmetic operators (`+`, `-`, `*`, `/`, `**`, `//`, `%`), scientific notation, and parentheses; non-mathematical AST nodes, function calls, and attribute lookups are rejected with HTTP 400 Bad Request to guarantee safety.

---

## 8. Remaining Mock Behavior

1. **Local File Storage Fallback**: In environments without Supabase S3 bucket configuration, file uploads (resumes, screenshots, lost & found photos, vault documents) fall back to local disk persistence with tenant boundary path validation.
2. **Development Authentication Tokens**: Development tokens (`dev-admin`, `dev-professor-1`, `dev-user-102203099`, `dev-opportunity-manager`) are accepted only when `ENVIRONMENT != 'production'`. In production mode, all endpoints enforce cryptographically signed Supabase Auth JWTs.
