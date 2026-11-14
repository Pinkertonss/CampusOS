# CampusOS (TIET Pilot)

> **One personalized platform that fixes fragmented campus information for Thapar Institute of Engineering & Technology (Patiala).**

CampusOS eliminates fragmented campus portals (Webkiosk, Moodle LMS, disparate WhatsApp circulars, hostel notices, and unofficial groups) by uniting academic intelligence, grounded campus policies, privacy-first vaults, and circular campus economics into a single unified operating system.

---

## 🎯 The 4 Core Modules

### 1. Academic Dashboard & What-If Planner
- **Grades & Timetable**: Real-time view of registered semester courses, credits, letter grades, and weekly classroom schedules (e.g., LT202, LP105, C-Hall labs).
- **Thapar 75% Attendance Guard**:
  - Automatically assesses courses against **TIET Section 6.2 Attendance Regulations**:
    - **Safe ($\ge 75\%$)**: Calculates exact number of consecutive lectures you can safely bunk without falling below 75%.
    - **Medical Warning ($65\% - 74.9\%$)**: Flags courses where you need medical dispensary condonation or DOAA approval to avoid being debarred from End-Semester Tests (EST).
    - **Critical ($< 65\%$)**: Flags automatic attendance detention / 'F' grade risk.
- **Dynamic What-If Simulator**:
  - **Attendance Slider**: Test scenarios such as *"If I attend 6 out of the next 8 classes, will I cross 75%?"*
  - **Grade & CGPA Predictor**: Set desired target grades across your courses to see projected SGPA and cumulative CGPA.
- **Manual Entry & CSV Import**: Import attendance and course rosters via `.csv` file uploads.

### 2. Campus Copilot (Grounded RAG with Actionable AI)
- **Zero-Hallucination RAG**: Grounded exclusively on official Thapar Institute documentation:
  - TIET Academic Regulations 2024-25 (Attendance, Grading, Exam Makeup)
  - Official Academic Calendar 2024-2025 (MST, EST, Breaks)
  - Hostel Regulations & Code of Conduct (10:30 PM curfew, high-wattage heater penalties)
  - Central Library Regulations (borrowing limits, overdue fines)
  - Official Circulars (Fee payment deadlines, minor degree allocations)
- **Strict Citation Guarantee**: Every claim cites the official document, section, and page number. Unsupported or out-of-scope questions are categorically declined.
- **Actionable AI**: Detects deadlines inside official circulars (e.g. Even Sem fee payment by Dec 20, 2024) and prompts the student with a 1-click **"Confirm & Add to Tasks"** action. Tasks are only created after explicit confirmation.

### 3. Digital Vault
- **Zero-Knowledge Privacy**: Private storage for transcripts, grade cards, tuition fee receipts, certificates, and student ID cards.
- **Strict Row Level Security (RLS)**: Enforced via PostgreSQL policies (`auth.uid() = user_id`) and private storage buckets (`vault-private`).
- **Explicit Consent**: Requires student authorization acknowledging data sovereignty before document uploads are permitted.

### 4. Campus Reuse & Impact Tracking
- **Circular Campus Economy**: Exchange, donate, or borrow calculators (Casio FX-991EX), lab coats, mini drafters, kettle/mattresses, and textbooks.
- **Real-Time Impact Engine**:
  - **₹ Saved**: Cumulative student money saved from avoided retail purchases.
  - **kg Waste Diverted**: Landfill waste diverted from campus disposal.
  - **CO₂ Avoided**: Calculated equivalent emissions avoided from circular reuse.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js (App Router, TypeScript) + Tailwind CSS + Lucide Icons |
| **Backend** | Python 3.14 + FastAPI (Academic calculations, RAG, Vault, Reuse services) |
| **Database & Auth** | Supabase PostgreSQL + Supabase Auth + Row Level Security (RLS) |
| **Storage** | Supabase Storage (Private `vault-private` bucket) |
| **Vector Engine** | Supabase `pgvector` (`vector(768)`) + Grounded Citation Pipeline |

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- Node.js $\ge 18$ (Tested on v26)
- Python $\ge 3.10$ (Tested on v3.14)

### 2. Clone and Configure Secrets
```bash
git clone https://github.com/your-username/CampusOS.git
cd CampusOS

# Copy example environment file
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

### 3. Run Backend (FastAPI)
```bash
# Set up Python virtual environment
python3 -m venv backend/venv
source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run test suite
pytest -v

# Start FastAPI server (runs on http://localhost:8000)
uvicorn app.main:app --app-dir backend --reload --port 8000
```

### 4. Run Frontend (Next.js)
```bash
# In a separate terminal tab:
cd frontend
npm install
npm run dev
# App available at http://localhost:3000
```

---

## 🧪 Testing Verification

Run the automated backend test suite:
```bash
./backend/venv/bin/pytest -v
```
Tests cover:
- What-if attendance calculations & 75% TIET threshold
- Safe bunk and makeup attendance class math
- SGPA & CGPA feasibility projections
- RAG strict citation retrieval and rejection of unsupported queries
- Actionable AI fee deadline extraction
- Reuse environmental and economic impact calculations
- API endpoints (courses, attendance, what-if, copilot, vault consent, reuse)

---

## 📁 Repository Structure
```
CampusOS/
├── backend/
│   ├── app/
│   │   ├── config.py             # App settings & env loading
│   │   ├── database.py           # In-memory repo & Supabase sync
│   │   ├── main.py               # FastAPI entrypoint & CORS
│   │   ├── models/               # Pydantic schemas (academic, copilot, vault, reuse)
│   │   ├── routers/              # API endpoints for each module
│   │   └── services/             # What-if math, RAG citation engine, Impact metrics
│   ├── data/
│   │   └── thapar_campus_corpus.json # Authentic TIET regulations & circulars
│   ├── tests/                    # Comprehensive pytest test suite
│   ├── requirements.txt
│   └── seed_data.py
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        # Shell layout with Navigation
│   │   │   ├── page.tsx          # Overview dashboard with alerts & schedule
│   │   │   ├── academic/         # Academic dashboard & What-if sliders
│   │   │   ├── copilot/          # RAG Copilot with citations & task confirmation
│   │   │   ├── vault/            # Private vault with RLS & consent
│   │   │   └── reuse/            # Reuse marketplace & live impact tracking
│   │   ├── components/
│   │   ├── lib/                  # API client, Supabase client, mock fallback
│   │   └── types/
│   ├── package.json
│   └── tsconfig.json
├── data/
│   ├── sample_attendance.csv     # Sample attendance roster for CSV import
│   └── sample_courses.csv        # Sample course roster for CSV import
├── supabase/
│   └── migrations/
│       └── 20240101_initial_schema.sql # PostgreSQL schema, pgvector, and RLS policies
├── .env.example
├── pytest.ini
└── README.md
```
