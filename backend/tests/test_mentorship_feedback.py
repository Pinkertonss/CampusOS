import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import db
from app.services.opportunity_engine import OpportunityEngine
from app.services.ingestion import DocumentIngestionService
from app.models.opportunity import Opportunity, StudentExperienceProfile, EducationEntry

client = TestClient(app)

STUDENT_HEADERS = {"Authorization": "Bearer dev-student"}
STUDENT_2_HEADERS = {"Authorization": "Bearer dev-student-2"}
PROFESSOR_HEADERS = {"Authorization": "Bearer dev-professor"}
OPP_MGR_HEADERS = {"Authorization": "Bearer dev-opportunity-manager"}
ADMIN_HEADERS = {"Authorization": "Bearer dev-admin"}


# ============================================================
# 1. Student Experience Profile & Academic Trust Boundary
# ============================================================

def test_student_experience_profile_get_and_update():
    """Verify student experience profile fetch, update, and persistence."""
    res = client.get("/api/opportunities/profile/experience", headers=STUDENT_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] in ("102203099-tiet-user", "student-user-id", "user-student-1")
    assert "education" in data
    assert len(data["education"]) > 0
    # Institutional verified CGPA should be present
    assert data["education"][0]["cgpa_verified"] in (8.52, 7.80)

    # Update skills, projects, and achievements
    update_payload = {
        "skills": ["Python", "FastAPI", "Next.js", "Docker", "PyTorch"],
        "achievements": ["HackCBS Finalist", "GDSC Core Member"],
        "discovery_opt_in": True,
        "preferred_opportunity_types": ["Research", "Internship"],
        "projects": [
            {
                "id": "proj-1",
                "title": "CampusOS Platform",
                "description": "Student operating system with deterministic rule engines",
                "technologies": ["Next.js", "FastAPI", "PostgreSQL"],
                "role": "Lead Architect",
                "link": "https://github.com/campusos/campusos",
            }
        ],
    }
    update_res = client.put("/api/opportunities/profile/experience", json=update_payload, headers=STUDENT_HEADERS)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert "FastAPI" in updated_data["skills"]
    assert len(updated_data["projects"]) == 1
    assert updated_data["projects"][0]["title"] == "CampusOS Platform"
    assert updated_data["discovery_opt_in"] is True


def test_student_cannot_overwrite_institutional_cgpa():
    """Students must not be able to overwrite official CGPA or institutional records."""
    # Attempt to overwrite cgpa_verified in education entry
    malicious_payload = {
        "education": [
            {
                "id": "edu-1",
                "institution": "Thapar Institute of Engineering and Technology",
                "program": "B.Tech",
                "branch": "Computer Engineering",
                "semester": 5,
                "graduation_year": 2026,
                "cgpa_verified": 9.99,  # Malicious attempt
                "student_entered_cgpa": 9.50,
            }
        ]
    }
    res = client.put("/api/opportunities/profile/experience", json=malicious_payload, headers=STUDENT_HEADERS)
    assert res.status_code == 200
    data = res.json()
    # Institutional verified CGPA must remain unchanged at institutional value (not overwritten by 9.99)
    assert data["education"][0]["cgpa_verified"] in (8.52, 7.80)
    assert data["education"][0]["student_entered_cgpa"] == 9.50


# ============================================================
# 2. Resume Upload, Download, and Size/Type Validation
# ============================================================

def test_resume_upload_download_and_delete_lifecycle():
    """Verify resume upload (PDF), download, and deletion lifecycle."""
    # 1. Reject non-PDF files
    fake_txt = io.BytesIO(b"Hello world this is a text file")
    txt_res = client.post(
        "/api/opportunities/profile/experience/resume",
        files={"file": ("resume.txt", fake_txt, "text/plain")},
        headers=STUDENT_HEADERS,
    )
    assert txt_res.status_code == 400
    assert "Only PDF" in txt_res.json()["detail"]

    # 2. Reject files larger than 10MB
    oversized_bytes = b"%PDF-1.4 " + (b"0" * (10 * 1024 * 1024 + 100))
    big_pdf = io.BytesIO(oversized_bytes)
    big_res = client.post(
        "/api/opportunities/profile/experience/resume",
        files={"file": ("large_resume.pdf", big_pdf, "application/pdf")},
        headers=STUDENT_HEADERS,
    )
    assert big_res.status_code == 400
    assert "10 MB" in big_res.json()["detail"] or "10MB" in big_res.json()["detail"]

    # 3. Valid PDF upload
    valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Arjun Mehta Resume) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    valid_pdf = io.BytesIO(valid_pdf_content)
    upload_res = client.post(
        "/api/opportunities/profile/experience/resume",
        files={"file": ("arjun_mehta_resume.pdf", valid_pdf, "application/pdf")},
        headers=STUDENT_HEADERS,
    )
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert upload_data["filename"] == "arjun_mehta_resume.pdf"
    assert upload_data["size_bytes"] == len(valid_pdf_content)

    # 4. Download resume
    dl_res = client.get("/api/opportunities/profile/experience/resume", headers=STUDENT_HEADERS)
    assert dl_res.status_code == 200
    assert dl_res.content == valid_pdf_content

    # 5. Delete resume
    del_res = client.delete("/api/opportunities/profile/experience/resume", headers=STUDENT_HEADERS)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 6. Subsequent download returns 404
    dl_404 = client.get("/api/opportunities/profile/experience/resume", headers=STUDENT_HEADERS)
    assert dl_404.status_code == 404


# ============================================================
# 3. Deterministic Opportunity Eligibility Engine
# ============================================================

def test_opportunity_eligibility_deterministic_evaluations():
    """Verify deterministic eligibility evaluation across branches, semester, CGPA, and skills."""
    profile = StudentExperienceProfile(
        user_id="test-student",
        full_name="Test Student",
        roll_no="102203999",
        email="test@thapar.edu",
        education=[
            EducationEntry(
                id="e1",
                institution="TIET",
                program="B.Tech",
                branch="Computer Engineering",
                semester=5,
                graduation_year=2026,
                cgpa_verified=8.50,
            )
        ],
        skills=["Python", "FastAPI", "Docker", "PyTorch"],
    )

    # 1. ELIGIBLE Case: Meets all mandatory criteria
    opp_eligible = Opportunity(
        id="opp-test-1",
        title="AI Lab Research",
        organization="Computer Science Dept",
        category="research",
        description="Machine learning research",
        eligible_branches=["Computer Engineering", "COE", "Any"],
        min_semester=3,
        max_semester=7,
        min_cgpa=8.0,
        required_skills=["Python", "PyTorch"],
        required_skills_mode="all",
        preferred_skills=["Docker", "CUDA"],
        time_commitment_hrs_week=10,
        location="Patiala",
        created_at="2026-11-14T00:00:00Z",
    )
    res_eligible = OpportunityEngine.evaluate_eligibility(profile, opp_eligible)
    assert res_eligible.status == "ELIGIBLE"
    assert res_eligible.mandatory_passed is True
    assert len(res_eligible.missing_requirements) == 0
    assert "Python" in res_eligible.matched_mandatory_skills
    assert "PyTorch" in res_eligible.matched_mandatory_skills
    assert "Docker" in res_eligible.matched_preferred_skills
    assert res_eligible.preference_score > 0

    # 2. NOT_ELIGIBLE Case: Fails CGPA threshold
    opp_high_cgpa = Opportunity(
        id="opp-test-2",
        title="Dean's Honors Research",
        organization="Academic Council",
        category="research",
        description="Ultra-high CGPA requirement",
        eligible_branches=["Computer Engineering"],
        min_cgpa=9.0,  # Student has 8.50
        required_skills=["Python"],
        created_at="2026-11-14T00:00:00Z",
    )
    res_ineligible_cgpa = OpportunityEngine.evaluate_eligibility(profile, opp_high_cgpa)
    assert res_ineligible_cgpa.status == "NOT_ELIGIBLE"
    assert res_ineligible_cgpa.mandatory_passed is False
    assert any("CGPA" in reason for reason in res_ineligible_cgpa.missing_requirements)

    # 3. NOT_ELIGIBLE Case: Fails Branch requirement
    opp_mech_only = Opportunity(
        id="opp-test-3",
        title="Robotics Mechanical Design",
        organization="Mechanical Dept",
        category="project",
        description="CAD and thermal analysis",
        eligible_branches=["Mechanical Engineering"],
        required_skills=["SolidWorks"],
        created_at="2026-11-14T00:00:00Z",
    )
    res_ineligible_branch = OpportunityEngine.evaluate_eligibility(profile, opp_mech_only)
    assert res_ineligible_branch.status == "NOT_ELIGIBLE"
    assert any("branch" in reason.lower() for reason in res_ineligible_branch.missing_requirements)

    # 4. NOT_ELIGIBLE Case: Required skills mode 'all' where student is missing one
    opp_all_skills = Opportunity(
        id="opp-test-4",
        title="Full Stack Cloud Architect",
        organization="TIET Cloud Cell",
        category="project",
        description="Complex full stack stack",
        eligible_branches=["Any"],
        required_skills=["Python", "Rust", "Kubernetes"],
        required_skills_mode="all",
        created_at="2026-11-14T00:00:00Z",
    )
    res_all_skills = OpportunityEngine.evaluate_eligibility(profile, opp_all_skills)
    assert res_all_skills.status == "NOT_ELIGIBLE"
    assert "Rust" in res_all_skills.missing_mandatory_skills

    # 5. INCOMPLETE_PROFILE Case: Profile has missing semester/branch
    opp_incomplete_check = Opportunity(
        id="opp-inc",
        title="General Campus Project",
        organization="TIET Design Cell",
        category="project",
        description="Open to all branches with min sem 3",
        eligible_branches=["Any"],
        min_semester=3,
        required_skills=[],
        created_at="2026-11-14T00:00:00Z",
    )
    profile_incomplete = StudentExperienceProfile(
        user_id="test-incomplete",
        full_name="Incomplete Student",
        roll_no="102203000",
        email="inc@thapar.edu",
        education=[],  # Missing education entries
        skills=[],
    )
    res_incomplete = OpportunityEngine.evaluate_eligibility(profile_incomplete, opp_incomplete_check)
    assert res_incomplete.status == "INCOMPLETE_PROFILE"
    assert len(res_incomplete.missing_profile_fields) > 0


# ============================================================
# 4. Candidate Discovery Visibility and In-App Invitations
# ============================================================

def test_candidate_discovery_opt_in_filtering():
    """Creators searching candidates must only discover students with discovery_opt_in=True."""
    # Ensure student profile has discovery_opt_in=True and required skills for opp-1
    client.put(
        "/api/opportunities/profile/experience",
        json={"discovery_opt_in": True, "skills": ["Python", "Machine Learning", "FastAPI"]},
        headers=STUDENT_HEADERS,
    )

    # Opportunity manager discovers candidates for opp-1
    res = client.get("/api/opportunities/opp-1/candidates", headers=OPP_MGR_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert "candidates" in data
    found_student = any(c["student_id"] == "102203099-tiet-user" for c in data["candidates"])
    assert found_student is True

    # Student turns off discovery_opt_in
    client.put(
        "/api/opportunities/profile/experience",
        json={"discovery_opt_in": False},
        headers=STUDENT_HEADERS,
    )

    # Candidate search now excludes the opted-out student
    res_opted_out = client.get("/api/opportunities/opp-1/candidates", headers=OPP_MGR_HEADERS)
    assert res_opted_out.status_code == 200
    opted_out_data = res_opted_out.json()
    found_opted_out = any(c["student_id"] == "102203099-tiet-user" for c in opted_out_data["candidates"])
    assert found_opted_out is False

    # Restore opt_in for future tests
    client.put(
        "/api/opportunities/profile/experience",
        json={"discovery_opt_in": True},
        headers=STUDENT_HEADERS,
    )


def test_send_opportunity_invitations():
    """Opportunity creator sends invitation to candidates."""
    invite_payload = {
        "candidate_ids": ["student-user-id"],
        "message": "We reviewed your GitHub projects and invite you to interview for our AI research role.",
    }
    res = client.post("/api/opportunities/opp-1/invite", json=invite_payload, headers=OPP_MGR_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["opportunity_id"] == "opp-1"
    assert data["invited_count"] >= 1
    assert "student-user-id" in data["student_ids"]


# ============================================================
# 5. Copilot Document Administration Authorization & Scanned PDF
# ============================================================

def test_copilot_document_admin_endpoints_require_admin():
    """Document administration must return 401 for anonymous, 403 for students, and 200 for admins."""
    # 1. Anonymous -> 401
    anon_res = client.get("/api/copilot/documents")
    assert anon_res.status_code == 401

    # 2. Student -> 403 Forbidden
    student_res = client.get("/api/copilot/documents", headers=STUDENT_HEADERS)
    assert student_res.status_code == 403

    # 3. Professor -> 403 Forbidden
    prof_res = client.get("/api/copilot/documents", headers=PROFESSOR_HEADERS)
    assert prof_res.status_code == 403

    # 4. Admin -> 200 OK
    admin_res = client.get("/api/copilot/documents", headers=ADMIN_HEADERS)
    assert admin_res.status_code == 200
    assert isinstance(admin_res.json(), list)


def test_scanned_pdf_without_extractable_text_fails_with_actionable_error():
    """Scanned PDF upload without text must fail with clear actionable error."""
    # Create empty/blank PDF bytes
    blank_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
    )
    with pytest.raises(ValueError) as excinfo:
        DocumentIngestionService.extract_text_per_page(blank_pdf, "scanned_doc.pdf")
    assert "no extractable" in str(excinfo.value).lower()
    assert "ocr" in str(excinfo.value).lower()
