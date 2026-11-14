-- CampusOS: Supabase PostgreSQL Schema & Security Policies
-- Pilot Deployment: Thapar Institute of Engineering & Technology (TIET)

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    roll_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT DEFAULT 'Computer Science & Engineering',
    semester INTEGER DEFAULT 5,
    consent_academic_sync BOOLEAN DEFAULT false,
    consent_vault_storage BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Academic Courses & Grades
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    credits NUMERIC(3, 1) NOT NULL DEFAULT 4.0,
    grade TEXT, -- Letter grade: A+, A, A-, B, B-, C, C-, D, E, F
    target_grade TEXT,
    semester INTEGER DEFAULT 5,
    academic_year TEXT DEFAULT '2024-2025',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Attendance Records
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    attended_classes INTEGER NOT NULL DEFAULT 0,
    total_classes INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Timetable Schedule Slots
CREATE TABLE IF NOT EXISTS public.timetable_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    day_of_week TEXT NOT NULL, -- Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue TEXT NOT NULL, -- e.g. LP101, LT202, C-Hall, CS Lab 3
    slot_type TEXT NOT NULL DEFAULT 'Lecture', -- Lecture, Tutorial, Lab
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Deadlines & Tasks (including Actionable AI items from Copilot)
CREATE TABLE IF NOT EXISTS public.deadlines_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    course_code TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed
    priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high
    source TEXT NOT NULL DEFAULT 'manual', -- manual, copilot_action, syllabus
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Digital Vault (Private Documents)
CREATE TABLE IF NOT EXISTS public.vault_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- marksheets, certificates, receipts, identity, notes
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    consent_verified BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Campus Reuse Marketplace
CREATE TABLE IF NOT EXISTS public.reuse_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- books, electronics, lab_gear, hostel_essentials
    listing_type TEXT NOT NULL DEFAULT 'donate', -- donate, exchange, borrow
    condition TEXT NOT NULL DEFAULT 'good', -- like_new, good, fair
    estimated_retail_price NUMERIC(10, 2) NOT NULL DEFAULT 500.00, -- INR
    estimated_weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
    status TEXT NOT NULL DEFAULT 'available', -- available, requested, completed
    contact_info TEXT NOT NULL,
    image_url TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Campus Official Documents & RAG Vector Chunks
CREATE TABLE IF NOT EXISTS public.campus_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    document_type TEXT NOT NULL, -- ordinance, calendar, hostel_rules, exam_rules, notice
    source_ref TEXT NOT NULL,
    effective_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campus_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.campus_documents(id) ON DELETE CASCADE,
    document_title TEXT NOT NULL,
    section_title TEXT NOT NULL,
    page_number INTEGER DEFAULT 1,
    content TEXT NOT NULL,
    embedding VECTOR(768), -- pgvector embedding (768-dim for Gemini text-embedding-004 or standard 768-dim models)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS campus_chunks_embedding_idx 
ON public.campus_document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Vector Search RPC Function
CREATE OR REPLACE FUNCTION match_campus_documents (
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 4
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    document_title TEXT,
    section_title TEXT,
    page_number INT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        chunks.id,
        chunks.document_id,
        chunks.document_title,
        chunks.section_title,
        chunks.page_number,
        chunks.content,
        1 - (chunks.embedding <=> query_embedding) AS similarity
    FROM public.campus_document_chunks chunks
    WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict user isolation on all private data
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_document_chunks ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only view/update their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Courses: User isolation
CREATE POLICY "Users can manage their courses"
ON public.courses FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Attendance: User isolation
CREATE POLICY "Users can manage their attendance"
ON public.attendance_records FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Timetable: User isolation
CREATE POLICY "Users can manage their timetable"
ON public.timetable_slots FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Deadlines: User isolation
CREATE POLICY "Users can manage their deadlines"
ON public.deadlines_tasks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Vault: Strict user isolation (Private documents)
CREATE POLICY "Users can manage their vault documents"
ON public.vault_documents FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Reuse Marketplace:
-- Any authenticated student can see available/requested/completed items
CREATE POLICY "Anyone can browse reuse items"
ON public.reuse_items FOR SELECT
USING (true);

-- Only owner can insert, edit, or delete their item
CREATE POLICY "Users can create their reuse items"
ON public.reuse_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their reuse items"
ON public.reuse_items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their reuse items"
ON public.reuse_items FOR DELETE
USING (auth.uid() = user_id);

-- Official campus documents: Public read for all users
CREATE POLICY "Public read for campus documents"
ON public.campus_documents FOR SELECT
USING (true);

CREATE POLICY "Public read for campus chunks"
ON public.campus_document_chunks FOR SELECT
USING (true);

-- ---------------------------------------------------------------------------
-- 11. STORAGE BUCKET CONFIGURATION & POLICIES
-- ---------------------------------------------------------------------------
-- Insert storage buckets (if storage schema exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault-private', 'vault-private', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('reuse-images', 'reuse-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: vault-private only accessible by owner folder
CREATE POLICY "Vault private owner read"
ON storage.objects FOR SELECT
USING (bucket_id = 'vault-private' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Vault private owner insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vault-private' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Vault private owner delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'vault-private' AND (storage.foldername(name))[1] = auth.uid()::text);
