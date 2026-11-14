import json
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from ..config import settings
from ..models.copilot import (
    Citation,
    ActionableSuggestion,
    CopilotQueryRequest,
    CopilotQueryResponse,
)

CORPUS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "thapar_campus_corpus.json"

UNSUPPORTED_ANSWER = (
    "I cannot answer this question because no relevant information was found in the "
    "official Thapar Institute documents. Please check the Webkiosk portal or contact "
    "the Dean of Academic Affairs (DOAA) office."
)

class RagEngine:
    def __init__(self):
        self.corpus: List[Dict] = []
        self._load_corpus()

    def _load_corpus(self):
        if CORPUS_PATH.exists():
            with open(CORPUS_PATH, "r", encoding="utf-8") as f:
                self.corpus = json.load(f)
        else:
            self.corpus = []

    def _calculate_chunk_relevance(self, query: str, chunk: Dict) -> float:
        """
        Calculates lexical & semantic relevance score between query and document chunk.
        """
        text = f"{chunk['document_title']} {chunk['section_title']} {chunk['content']}".lower()
        query_words = [w for w in re.findall(r"\b\w+\b", query.lower()) if len(w) > 2]
        
        if not query_words:
            return 0.0

        # Comprehensive stop words to prevent false positives on common English words
        stopwords = {
            "what", "when", "where", "which", "who", "whom", "this", "that", "there", 
            "have", "from", "with", "about", "does", "will", "would", "could", "should",
            "the", "and", "for", "are", "can", "any", "all", "how", "you", "your",
            "not", "but", "our", "out", "per", "into", "over", "after", "also", "been"
        }
        filtered_words = [w for w in query_words if w not in stopwords]
        if not filtered_words:
            return 0.0

        matched_count = 0
        weight_sum = 0.0
        total_weight = 0.0

        # Special domain keyword weighting for Thapar campus
        thapar_keywords = {
            "attendance": 4.0, "bunk": 3.5, "debarred": 4.0, "condonation": 4.0, "65%": 4.0, "75%": 4.0,
            "hostel": 3.5, "curfew": 4.0, "timing": 3.0, "warden": 3.5, "cooler": 3.5, "heater": 3.5,
            "grade": 3.5, "grading": 3.5, "cgpa": 3.5, "sgpa": 3.5, "makeup": 4.0, "exam": 3.0,
            "mst": 4.0, "est": 4.0, "library": 3.5, "book": 3.0, "fine": 3.5, "fee": 3.5,
            "fees": 3.5, "tuition": 3.5, "registration": 3.5, "minor": 3.5, "calendar": 3.0,
            "break": 3.0, "turnstile": 3.5, "dispensary": 3.5, "medical": 3.5, "doctor": 3.0
        }

        for word in filtered_words:
            kw_weight = thapar_keywords.get(word, 1.0)
            total_weight += kw_weight
            
            # Match word in chunk text or section/title
            pattern = rf"\b{re.escape(word)}\b"
            if re.search(pattern, text):
                matched_count += 1
                weight_sum += kw_weight
            elif len(word) > 4 and (word in text):
                matched_count += 0.7
                weight_sum += kw_weight * 0.7

        if total_weight == 0 or matched_count == 0:
            return 0.0

        score = weight_sum / total_weight
        return score

    def retrieve_relevant_chunks(
        self, query: str, threshold: float = 0.28, top_k: int = 3
    ) -> List[Tuple[Dict, float]]:
        """
        Retrieves top relevant chunks from campus corpus with strict threshold gating.
        """
        scored_chunks = []
        for chunk in self.corpus:
            score = self._calculate_chunk_relevance(query, chunk)
            if score >= threshold:
                scored_chunks.append((chunk, score))

        # Sort descending by relevance score
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k]

    def _detect_actionable_event(self, text: str, query: str) -> Optional[ActionableSuggestion]:
        """
        Extracts actionable deadlines, exam schedules, or fee notices for student confirmation.
        """
        text_lower = text.lower()
        
        # Check for fee payment deadline
        if "fee" in text_lower and ("december 20, 2024" in text_lower or "due" in text_lower):
            return ActionableSuggestion(
                has_action=True,
                title="Pay Even Semester Tuition & Hostel Fees",
                due_date="2024-12-20T23:59:00",
                priority="high",
                course_code="CAMPUS-FEES",
                reason="Official notice states fee must be paid by Dec 20, 2024 to avoid ₹2,000 late surcharge."
            )

        # Check for Minor Degree application
        if "minor degree" in text_lower and "november 30, 2024" in text_lower:
            return ActionableSuggestion(
                has_action=True,
                title="Submit Minor Degree Application (AI/ML, Data, Finance)",
                due_date="2024-11-30T17:00:00",
                priority="medium",
                course_code="DOAA-MINOR",
                reason="Minor degree allocation closes on November 30, 2024 for students with CGPA >= 7.00."
            )

        # Check for End Semester Examination
        if ("est" in text_lower or "end semester" in text_lower) and "december 2" in text_lower:
            return ActionableSuggestion(
                has_action=True,
                title="Prepare for End-Semester Tests (EST)",
                due_date="2024-12-02T09:00:00",
                priority="high",
                course_code="ACAD-EST",
                reason="TIET Official Academic Calendar lists EST commencement on December 2, 2024."
            )

        # Check for Mid Semester Examination (Even Sem)
        if ("mid semester" in text_lower or "mst" in text_lower) and "march 10" in text_lower:
            return ActionableSuggestion(
                has_action=True,
                title="Even Semester Mid-Semester Tests (MST)",
                due_date="2025-03-10T09:00:00",
                priority="high",
                course_code="ACAD-MST",
                reason="TIET Academic Calendar sets Even Semester MST from March 10 to March 15, 2025."
            )

        return None

    def ask(self, request: CopilotQueryRequest) -> CopilotQueryResponse:
        query = request.query.strip()
        matched_chunks = self.retrieve_relevant_chunks(query)

        # Strict requirement: if nothing relevant is retrieved, decline immediately
        if not matched_chunks:
            return CopilotQueryResponse(
                query=query,
                answered=False,
                answer=UNSUPPORTED_ANSWER,
                citations=[],
                actionable_suggestion=None,
            )

        # Format citations
        citations: List[Citation] = []
        context_snippets = []
        for chunk, score in matched_chunks:
            citations.append(
                Citation(
                    document_title=chunk["document_title"],
                    section_title=chunk["section_title"],
                    page_number=chunk.get("page_number", 1),
                    source_ref=chunk.get("source_ref", "Official TIET Document"),
                    excerpt=chunk["content"],
                )
            )
            context_snippets.append(
                f"[{chunk['document_title']} - {chunk['section_title']}]: {chunk['content']}"
            )

        # Build synthesized verified answer with citations
        full_context = "\n\n".join(context_snippets)
        primary_chunk = matched_chunks[0][0]
        
        # Compose factual answer referencing the cited sources
        answer_paragraphs = []
        answer_paragraphs.append(
            f"Based on **{primary_chunk['document_title']}** ({primary_chunk['section_title']}):\n"
            f"{primary_chunk['content']}"
        )
        
        if len(matched_chunks) > 1:
            sec_chunk = matched_chunks[1][0]
            answer_paragraphs.append(
                f"Furthermore, per **{sec_chunk['document_title']}** ({sec_chunk['section_title']}):\n"
                f"{sec_chunk['content']}"
            )

        final_answer = "\n\n".join(answer_paragraphs)

        # Actionable AI: inspect context for actionable deadlines
        actionable_suggestion = self._detect_actionable_event(full_context, query)

        return CopilotQueryResponse(
            query=query,
            answered=True,
            answer=final_answer,
            citations=citations,
            actionable_suggestion=actionable_suggestion,
        )

# Singleton instance
rag_engine = RagEngine()
