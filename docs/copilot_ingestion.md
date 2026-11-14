# Campus Copilot: Document Ingestion & RAG Guide

Campus Copilot is a source-grounded Retrieval-Augmented Generation (RAG) assistant designed for university campuses (pilot: Thapar Institute of Engineering & Technology). It strictly grounds answers in approved campus documents, emits source citations (`[1]`, `[2]`), and refuses questions that lack authoritative source backing.

---

## 1. Document Ingestion Overview

Approved documents (academic ordinances, exam circulars, hostel rules, fee schedules, library policies) are ingested through the admin-only endpoint:

```http
POST /api/copilot/documents
(or POST /copilot/documents)
Content-Type: multipart/form-data
```

### Parameters:
- `file`: The document binary (`.pdf`, `.docx`, or `.txt`, max 25 MB).
- `title`: Human-readable document name (e.g., `TIET Academic Regulations 2024-25`).
- `source_label`: Category or reference tag (e.g., `academic_ordinance`, `hostel_rules`, `calendar`, `circular`).

---

## 2. Ingestion Pipeline Mechanics

1. **Storage**:
   The uploaded file is stored in the `campus-docs` Supabase storage bucket (with fallback to local disk storage at `storage/campus-docs/`).

2. **Per-Page Text Extraction**:
   - **PDF**: Decompresses stream objects and parses text operators (`BT ... ET`, `Tj`, `TJ`) into page-level text.
   - **DOCX**: Unzips OpenXML structure, reads `word/document.xml`, recognizes page breaks (`w:lastRenderedPageBreak`, `w:br[type=page]`), and collects paragraphs per page.
   - **TXT**: Detects form-feed characters (`\f`), page dividers (`--- Page X ---`), or ~2,500-character logical page blocks.

3. **Page-Preserving Chunking**:
   - Target chunk size: **~500 tokens** (~2,000 characters).
   - Overlap: **~80 tokens** (~320 characters) across consecutive chunks to preserve contextual continuity.
   - Chunks inherit and preserve exact `page_ref` tags (e.g., `Page 1`, `Page 14`) for citation transparency.

4. **Vector Embedding**:
   - Each chunk text is embedded into a 768-dimensional normalized vector.
   - Stored in the `document_chunks` table (`pgvector`) linked to `campus_documents`.

---

## 3. Provider Abstraction (Swappable Models)

The embedding model and LLM are abstracted behind `BaseEmbeddingProvider` and `BaseLLMProvider` in `app/services/ai_provider.py`. You can swap providers simply by configuring environment variables in `.env`:

| Environment Variable | Options | Description |
|---|---|---|
| `EMBEDDING_PROVIDER` | `local` (default), `gemini`, `openai` | Embedding model (`text-embedding-004` for Gemini, `text-embedding-3-small` for OpenAI) |
| `LLM_PROVIDER` | `local` (default), `gemini`, `openai` | LLM generation (`gemini-1.5-flash`, `gpt-4o-mini`, or local deterministic generator) |
| `COPILOT_SIMILARITY_THRESHOLD` | Float, e.g. `0.45` | Cosine similarity gating threshold for refusing unsupported questions |
| `GEMINI_API_KEY` | string | Google AI Gemini API key |
| `OPENAI_API_KEY` | string | OpenAI API key |

When running locally without external API keys, the local deterministic provider generates embeddings and source-grounded answers out of the box with zero network dependencies.

---

## 4. Query & Refusal Path

Students query the Copilot via:

```http
POST /api/copilot/ask
Content-Type: application/json

{
  "question": "What is the minimum attendance requirement to appear in exams?"
}
```

### Retrieval & Refusal Logic:
1. The question is embedded and compared against all approved chunks via cosine similarity (`match_chunks`).
2. **Strict Refusal**: If no chunk exceeds the similarity threshold, the model immediately refuses:
   ```json
   {
     "answered": false,
     "grounded": false,
     "confidence": 0.0,
     "answer": "I couldn't find this in the approved campus documents. Please check the official Webkiosk portal or contact the Dean of Academic Affairs (DOAA) office.",
     "citations": []
   }
   ```
   **Zero guessing or hallucinating is permitted.**
3. **Grounded Answer**: If chunks pass the threshold, the LLM is prompted with *only* retrieved chunks and instructed to cite sources as `[1]`, `[2]`:
   ```json
   {
     "answered": true,
     "grounded": true,
     "confidence": 0.89,
     "answer": "According to **TIET Academic Regulations 2024-25** (Page 14) [1]:\nA student must maintain a minimum attendance of 75%...",
     "citations": [
       {
         "document_title": "TIET Academic Regulations 2024-25",
         "page_ref": "Page 14",
         "snippet": "A student must maintain a minimum attendance of 75% in each registered course..."
       }
     ]
   }
   ```

---

## 5. Streaming Real-Time Responses

Copilot also provides an SSE streaming endpoint for real-time token delivery:

```http
POST /api/copilot/ask/stream
Content-Type: application/json

{
  "question": "What is the hostel curfew timing?"
}
```

Events delivered:
- `event: citations`: JSON containing retrieved source citations and top similarity score.
- `event: token`: Incremental text tokens streamed as generated.
- `event: done`: Signal marking completion.

---

## 6. How to Add New Documents via CLI / cURL

```bash
# Upload a new circular
curl -X POST "http://localhost:8000/api/copilot/documents" \
  -F "title=Hostel Appliance Guidelines Winter 2024" \
  -F "source_label=hostel_rules" \
  -F "file=@/path/to/hostel_rules.pdf"

# List indexed documents
curl -X GET "http://localhost:8000/api/copilot/documents"

# Delete an obsolete document
curl -X DELETE "http://localhost:8000/api/copilot/documents/{document_id}"
```
