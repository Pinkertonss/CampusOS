import os
import json
import uuid
import math
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any, AsyncGenerator

from ..core.config import settings
from ..models.copilot import (
    Citation,
    ActionableSuggestion,
    CopilotQueryRequest,
    CopilotQueryResponse,
    CampusDocument,
    DocumentUploadResponse,
)
from .ai_provider import (
    get_embedding_provider,
    get_llm_provider,
    BaseEmbeddingProvider,
    BaseLLMProvider,
)
from .ingestion import DocumentIngestionService

CORPUS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "thapar_campus_corpus.json"
STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage" / "campus-docs"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

REFUSAL_MESSAGE = "I couldn't find this in the approved campus documents"
UNSUPPORTED_ANSWER = (
    "I couldn't find this in the approved campus documents. "
    "Please check the official Webkiosk portal or contact the Dean of Academic Affairs (DOAA) office."
)

class RagEngine:
    def __init__(self):
        self.embedding_provider: BaseEmbeddingProvider = get_embedding_provider()
        self.llm_provider: BaseLLMProvider = get_llm_provider()
        self.documents: Dict[str, CampusDocument] = {}
        self.chunks: List[Dict[str, Any]] = []
        self.similarity_threshold: float = float(os.getenv("COPILOT_SIMILARITY_THRESHOLD", "0.45"))
        self._initialize_corpus()

    def _initialize_corpus(self):
        """
        Loads pre-approved campus corpus and computes embeddings into memory store.
        """
        if not CORPUS_PATH.exists():
            return

        with open(CORPUS_PATH, "r", encoding="utf-8") as f:
            corpus_data = json.load(f)

        # Group corpus into documents
        doc_map: Dict[str, List[Dict[str, Any]]] = {}
        for item in corpus_data:
            title = item.get("document_title", "Official Notice")
            if title not in doc_map:
                doc_map[title] = []
            doc_map[title].append(item)

        for title, items in doc_map.items():
            doc_id = f"doc-{uuid.uuid5(uuid.NAMESPACE_DNS, title).hex[:8]}"
            source_label = items[0].get("document_type", "campus_circular")
            created_at = "2024-08-01T09:00:00"

            camp_doc = CampusDocument(
                id=doc_id,
                title=title,
                source_label=source_label,
                storage_path=f"campus-docs/{doc_id}.txt",
                uploaded_by="admin",
                is_approved=True,
                chunk_count=len(items),
                file_size_bytes=sum(len(it.get("content", "")) for it in items),
                created_at=created_at,
            )
            self.documents[doc_id] = camp_doc

            for idx, it in enumerate(items):
                content = it.get("content", "")
                page_num = it.get("page_number", 1)
                page_ref = f"Page {page_num}"
                section = it.get("section_title", "")
                full_text = f"{section}\n{content}" if section else content

                # Compute deterministic embedding synchronously during init
                from .ai_provider import LocalEmbeddingProvider
                local_embedder = LocalEmbeddingProvider()
                embeddings = local_embedder.embed_texts_sync([f"{title} {section} {content}"])
                vec = embeddings[0]

                self.chunks.append({
                    "id": f"{doc_id}-chk-{idx}",
                    "document_id": doc_id,
                    "chunk_index": idx,
                    "content": content,
                    "section_title": section,
                    "page_ref": page_ref,
                    "page_number": page_num,
                    "document_title": title,
                    "source_label": source_label,
                    "embedding": vec,
                })

    def list_documents(self) -> List[CampusDocument]:
        return list(self.documents.values())

    def get_document(self, document_id: str) -> Optional[CampusDocument]:
        return self.documents.get(document_id)

    def delete_document(self, document_id: str) -> bool:
        if document_id in self.documents:
            del self.documents[document_id]
            self.chunks = [c for c in self.chunks if c.get("document_id") != document_id]
            return True
        return False

    async def ingest_document(
        self,
        file_bytes: bytes,
        filename: str,
        title: str,
        source_label: str = "circular",
        uploaded_by: str = "admin",
    ) -> DocumentUploadResponse:
        """
        Admin Ingestion Pipeline:
        1. Store file in campus-docs storage bucket / local folder.
        2. Extract text per page preserving page numbers.
        3. Chunk text (~500 tokens, ~80 overlap).
        4. Embed each chunk using swappable embedding provider.
        5. Store chunk records in document_chunks.
        """
        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        storage_rel_path = f"campus-docs/{doc_id}_{filename}"
        local_path = STORAGE_DIR / f"{doc_id}_{filename}"
        with open(local_path, "wb") as f:
            f.write(file_bytes)

        # Extract per page
        pages = DocumentIngestionService.extract_text_per_page(file_bytes, filename)

        # Chunk document
        new_chunks = DocumentIngestionService.chunk_document(
            pages=pages,
            document_id=doc_id,
            document_title=title,
            source_label=source_label,
        )

        if not new_chunks:
            # Create a single fallback chunk if file had very little text
            text = file_bytes.decode("utf-8", errors="ignore").strip()
            if text:
                new_chunks = [{
                    "id": f"{doc_id}-chk-0",
                    "document_id": doc_id,
                    "chunk_index": 0,
                    "content": text,
                    "page_ref": "Page 1",
                    "document_title": title,
                    "source_label": source_label,
                }]

        # Compute embeddings for all chunks
        embed_texts = [f"{c['document_title']} {c.get('page_ref', '')} {c['content']}" for c in new_chunks]
        self.embedding_provider = get_embedding_provider()
        embeddings = await self.embedding_provider.embed_texts(embed_texts)

        for chunk_dict, emb in zip(new_chunks, embeddings):
            chunk_dict["embedding"] = emb
            self.chunks.append(chunk_dict)

        camp_doc = CampusDocument(
            id=doc_id,
            title=title,
            source_label=source_label,
            storage_path=storage_rel_path,
            uploaded_by=uploaded_by,
            is_approved=True,
            chunk_count=len(new_chunks),
            file_size_bytes=len(file_bytes),
            created_at=datetime.now().isoformat(),
        )
        self.documents[doc_id] = camp_doc

        return DocumentUploadResponse(
            document=camp_doc,
            chunks_created=len(new_chunks),
            message=f"Document '{title}' successfully processed into {len(new_chunks)} chunks and indexed.",
        )

    def _cosine_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        if not vec_a or not vec_b:
            return 0.0
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    async def match_chunks(
        self, query: str, top_k: int = 4, threshold: Optional[float] = None
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Embeds the query, runs cosine similarity search over approved chunks,
        and applies the similarity threshold.
        """
        thresh = threshold if threshold is not None else self.similarity_threshold
        self.embedding_provider = get_embedding_provider()
        query_emb = await self.embedding_provider.embed_query(query)

        scored_chunks: List[Tuple[Dict[str, Any], float]] = []
        for chunk in self.chunks:
            chunk_emb = chunk.get("embedding")
            if not chunk_emb:
                continue
            sim = self._cosine_similarity(query_emb, chunk_emb)
            if sim >= thresh:
                scored_chunks.append((chunk, sim))

        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k]

    def _detect_actionable_event(self, text: str, query: str) -> Optional[ActionableSuggestion]:
        """
        Extracts verified actionable deadlines for student confirmation.
        """
        text_lower = text.lower()
        if "fee" in text_lower and ("december 20, 2024" in text_lower or "due" in text_lower):
            return ActionableSuggestion(
                has_action=True,
                title="Pay Even Semester Tuition & Hostel Fees",
                due_date="2024-12-20T23:59:00",
                priority="high",
                course_code="CAMPUS-FEES",
                reason="Official notice states fee must be paid by Dec 20, 2024 to avoid ₹2,000 late surcharge."
            )
        if "minor degree" in text_lower and "november 30, 2024" in text_lower:
            return ActionableSuggestion(
                has_action=True,
                title="Submit Minor Degree Application (AI/ML, Data, Finance)",
                due_date="2024-11-30T17:00:00",
                priority="medium",
                course_code="DOAA-MINOR",
                reason="Minor degree allocation closes on November 30, 2024 for students with CGPA >= 7.00."
            )
        if ("est" in text_lower or "end semester" in text_lower) and "december 2" in text_lower:
            return ActionableSuggestion(
                has_action=True,
                title="Prepare for End-Semester Tests (EST)",
                due_date="2024-12-02T09:00:00",
                priority="high",
                course_code="ACAD-EST",
                reason="TIET Official Academic Calendar lists EST commencement on December 2, 2024."
            )
        return None

    async def aask(self, request: CopilotQueryRequest) -> CopilotQueryResponse:
        """
        Asynchronous source-grounded RAG query handler.
        """
        query_text = request.get_query_text()
        if not query_text:
            return CopilotQueryResponse(
                query="",
                answered=False,
                answer=UNSUPPORTED_ANSWER,
                citations=[],
                confidence=0.0,
                grounded=False,
            )

        matched = await self.match_chunks(query_text)

        # Refusal gating: If no chunk passes similarity threshold, strictly decline
        if not matched:
            return CopilotQueryResponse(
                query=query_text,
                answered=False,
                answer=UNSUPPORTED_ANSWER,
                citations=[],
                confidence=0.0,
                grounded=False,
                actionable_suggestion=None,
            )

        # Format citations [1], [2], ...
        citations: List[Citation] = []
        context_chunks: List[Dict[str, Any]] = []
        for idx, (chunk, score) in enumerate(matched, start=1):
            doc_title = chunk.get("document_title", "Campus Notice")
            page_ref = chunk.get("page_ref", "Page 1")
            snippet = chunk.get("content", "").strip()
            section = chunk.get("section_title", "")

            citations.append(
                Citation(
                    document_title=doc_title,
                    page_ref=page_ref,
                    snippet=snippet,
                    section_title=section,
                    page_number=chunk.get("page_number", 1),
                    source_ref=chunk.get("source_label", "Approved TIET Document"),
                    excerpt=snippet,
                )
            )
            context_chunks.append({
                "document_title": doc_title,
                "page_ref": page_ref,
                "content": snippet,
                "score": score,
            })

        # Synthesize source-grounded response using LLM
        system_prompt = (
            "You are Campus Copilot, a strictly source-grounded AI assistant for students at "
            "Thapar Institute of Engineering & Technology. Answer questions STRICTLY from the provided "
            "campus document excerpts. Cite sources using [1], [2] matching chunk order. "
            "Do not guess, assume, or use outside knowledge."
        )

        self.llm_provider = get_llm_provider()
        answer = await self.llm_provider.generate_response(
            system_prompt=system_prompt,
            user_prompt=query_text,
            context_chunks=context_chunks,
        )

        # Confidence is top matched similarity score
        top_confidence = round(matched[0][1], 3)
        full_context_str = " ".join([c["content"] for c in context_chunks])
        actionable_suggestion = self._detect_actionable_event(full_context_str, query_text)

        return CopilotQueryResponse(
            query=query_text,
            answered=True,
            answer=answer,
            citations=citations,
            confidence=top_confidence,
            grounded=True,
            actionable_suggestion=actionable_suggestion,
        )

    def ask(self, request: CopilotQueryRequest) -> CopilotQueryResponse:
        """
        Synchronous wrapper for aask, providing seamless backwards compatibility.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, self.aask(request)).result()
            else:
                return loop.run_until_complete(self.aask(request))
        except RuntimeError:
            return asyncio.run(self.aask(request))

    async def ask_stream(self, request: CopilotQueryRequest) -> AsyncGenerator[str, None]:
        """
        Streams response chunks over Server-Sent Events (SSE).
        """
        query_text = request.get_query_text()
        matched = await self.match_chunks(query_text)

        if not matched:
            payload = {
                "event": "refusal",
                "answer": UNSUPPORTED_ANSWER,
                "grounded": False,
                "confidence": 0.0,
                "citations": []
            }
            yield f"data: {json.dumps(payload)}\n\n"
            return

        citations = []
        context_chunks = []
        for idx, (chunk, score) in enumerate(matched, start=1):
            doc_title = chunk.get("document_title", "Campus Notice")
            page_ref = chunk.get("page_ref", "Page 1")
            snippet = chunk.get("content", "").strip()
            citations.append({
                "index": idx,
                "document_title": doc_title,
                "page_ref": page_ref,
                "snippet": snippet,
            })
            context_chunks.append({
                "document_title": doc_title,
                "page_ref": page_ref,
                "content": snippet,
            })

        # Yield initial metadata
        yield f"data: {json.dumps({'event': 'citations', 'citations': citations, 'confidence': round(matched[0][1], 3)})}\n\n"

        system_prompt = (
            "You are Campus Copilot, a strictly source-grounded assistant for Thapar Institute students. "
            "Answer strictly from the source chunks using [1], [2] citations. Do not use outside knowledge."
        )
        self.llm_provider = get_llm_provider()
        async for token in self.llm_provider.generate_stream(system_prompt, query_text, context_chunks):
            yield f"data: {json.dumps({'event': 'token', 'text': token})}\n\n"

        yield f"data: {json.dumps({'event': 'done'})}\n\n"


rag_engine = RagEngine()
