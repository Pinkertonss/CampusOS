# CampusOS Persistent Agent Guidelines

## 1. Branch Policy
- **Dedicated Branch**: All development, testing, and implementation tasks must be performed on the `antigravity` branch.
- **Default Branch Protection**: Never push directly to the `main` branch. Never merge automatically, force-push (`git push -f`), or discard commit histories.
- **Upstream Tracking**: Maintain branch upstream tracking with `origin/antigravity`.

## 2. Commit & Push Workflow
Before every final response for a task that modifies files:
1. **Security & Cleanliness Review**:
   - Inspect `git diff` for secrets, tokens, personal data, or `.env` credential leaks.
   - Remove temporary files, build caches (`.next/`, `.pytest_cache/`, `__pycache__/`), and scratch artifacts.
2. **Pre-Commit Verification**:
   - Run backend tests: `./backend/venv/bin/pytest -v -W ignore::DeprecationWarning`.
   - Run frontend build & type-checking: `npm --prefix frontend run build`.
3. **Staging & Commit**:
   - Stage only files relevant to the completed task.
   - Write structured, descriptive conventional commit messages (e.g. `feat(reuse): ...`, `fix(planner): ...`).
4. **Push & Remote Verification**:
   - Push to `origin antigravity`.
   - Confirm remote branch contains the commit.
   - If blocked by authentication or permission (e.g. 403 Forbidden / terminal prompts disabled), clearly report the exact blocker and confirm that the commit exists locally. Never claim a successful push without confirmation.
5. **No File Changes**:
   - If no project files were modified, report "No file changes; no commit required." Do not create empty commits.

## 3. Evidence-Based Verification Reports
- Maintain and update `docs/verification/latest.md` with every implementation task.
- Include the updated verification report in the task commit.
- Cover all 8 required sections:
  1. Scope and source
  2. Files changed
  3. Endpoints added or modified
  4. Database migrations
  5. Automated verification
  6. Deployed verification
  7. Known limitations
  8. Remaining mock behavior

## 4. Architecture & Stack Conventions
- **Frontend**: Next.js 16 (App Router, Tailwind CSS v4, TypeScript).
- **Backend**: FastAPI (Python 3.11+, Pydantic v2, uvicorn).
- **Database & Storage**: Supabase PostgreSQL with Row Level Security (RLS) and private buckets.
- **Design Tokens**: Standardized Slate / Teal palette with dark-mode support via `globals.css`.
- **Determinism**: Attendance, grading, and scheduling decisions are computed via deterministic rule engines (`AttendanceEngine`, `GradeEngine`, `ActionPlanEngine`).
