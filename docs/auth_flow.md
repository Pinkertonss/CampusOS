# Supabase Auth & JWT Verification Flow

CampusOS utilizes Supabase Auth for student authentication and session management.

## Authentication Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student (Browser)
    participant Front as Next.js Client
    participant Supa as Supabase Auth & DB
    participant Back as FastAPI Backend (Python)

    Student->>Front: Sign in with credentials / Magic Link
    Front->>Supa: Authenticate (supabase.auth.signInWithPassword)
    Supa-->>Front: Session (access_token, refresh_token, user_id)
    Note over Front: Token stored in Supabase Browser Client
    
    Student->>Front: Navigate to Academic Dashboard / Digital Vault
    Front->>Back: GET /api/academic/courses (Authorization: Bearer <access_token>)
    Back->>Back: verify_supabase_jwt(token) via get_current_user_id
    Note over Back: 1. Checks JWT signature with SUPABASE_JWT_SECRET<br/>2. Or calls supabase.auth.get_user(token)<br/>3. Returns authenticated user_id
    Back-->>Front: HTTP 200 OK + Personalized Data
    Front-->>Student: Render dashboard with verified student records
```

## Security Guarantees

1. **Row Level Security (RLS)**:
   Every PostgreSQL table enables RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Student records are strictly accessible when `auth.uid() = user_id`.

2. **Private Storage Buckets**:
   Storage bucket `vault-private` restricts access to files prefixed with the student's authenticated user ID.

3. **Backend Authorization Dependency**:
   Protected FastAPI endpoints utilize `user_id: str = Depends(get_current_user_id)`, ensuring unauthenticated requests are rejected with `HTTP 401 Unauthorized`.
